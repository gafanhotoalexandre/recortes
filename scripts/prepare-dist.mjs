import { readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { approvedColors } from './demo-assets.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, 'dist')
const target = resolve(output, 'references')
const { bytes: approvedImage } = await approvedColors()
if (!approvedImage.equals(await readFile(resolve(output, 'demos/photo-8.jpg'))))
  throw Error('O exemplo cromático distribuído difere do original aprovado.')
// Remove only the generated copy. Original comparison assets stay in public/references.
if (!output.startsWith(resolve(root) + sep) || dirname(target) !== output)
  throw Error('Diretório de saída inválido.')
await rm(target, { recursive: true, force: true })

// The static distribution must carry the notices, not depend on node_modules.
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
const notices = [
  await readFile(resolve(root, 'THIRD-PARTY-NOTICES.md'), 'utf8'),
  await readFile(resolve(root, 'docs/fotografias-demonstrativas.md'), 'utf8'),
]
for (const [entry, pkg] of Object.entries(lock.packages)) {
  if (!entry || pkg.dev || pkg.link) continue
  const directory = resolve(root, entry)
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((file) => file.isFile() && /^(licen[sc]e|copying|notice)([.\-_]|$)/i.test(file.name))
    .map((file) => file.name)
    .sort()
  // This package declares MIT but omits LICENSE from its npm tarball.
  const texts = entry === 'node_modules/react-remove-scroll-bar' && !files.length
    ? [await readFile(resolve(root, 'licenses/react-remove-scroll-bar.LICENSE'), 'utf8')]
    : await Promise.all(files.map((file) => readFile(resolve(directory, file), 'utf8')))
  if (!texts.length) throw Error(`Aviso de licença ausente: ${entry}`)
  if (entry === 'node_modules/pako') {
    // pako's root LICENSE covers MIT; its zlib port carries an additional notice.
    const source = await readFile(resolve(directory, 'lib/zlib/deflate.js'), 'utf8')
    const header = source.slice(source.indexOf('// (C)'), source.indexOf('\nvar ')).trim()
    if (!header.includes('This notice may not be removed')) throw Error('Aviso Zlib ausente.')
    texts.push(header)
  }
  notices.push(`\n---\n${entry.replace(/^node_modules\//, '')} ${pkg.version} (${pkg.license})\n\n${texts.join('\n\n')}`)
}
await writeFile(resolve(output, 'third-party-licenses.txt'), notices.join('\n'), 'utf8')
