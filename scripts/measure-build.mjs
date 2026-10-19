import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const phase = Number(process.argv.find(arg => arg.startsWith('--phase='))?.split('=')[1] ?? 2)
const html = await readFile(path.join(root, 'dist/index.html'), 'utf8')
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1]
const assets = await readdir(path.join(root, 'dist/assets'))
const files = []
for (const file of assets) {
  const data = await readFile(path.join(root, 'dist/assets', file))
  files.push({ file, bytes: data.length, gzipBytes: gzipSync(data).length })
}
async function directoryBytes(name) {
  let sum = 0
  const entries = await readdir(path.join(root, 'dist', name)).catch(error => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  for (const file of entries)
    sum += (await readFile(path.join(root, 'dist', name, file))).length
  return sum
}
const metrics = {
  phase,
  initialJavaScriptGzipBytes: files.find(file => file.file === entry)?.gzipBytes,
  javascriptGzipBytes: files
    .filter((file) => file.file.endsWith('.js'))
    .reduce((sum, file) => sum + file.gzipBytes, 0),
  cssGzipBytes: files
    .filter((file) => file.file.endsWith('.css'))
    .reduce((sum, file) => sum + file.gzipBytes, 0),
  demoBytes: await directoryBytes('demos'),
  referenceBytes: await directoryBytes('references'),
  files,
  note: 'Metas orientam medição. Referências originais preservadas em public/references para comparação; sua cópia não integra o dist. Worker e PDF são carregados sob demanda; javascriptGzipBytes soma todos os caminhos, inclusive fallback.',
}
await mkdir(path.join(root, 'docs'), { recursive: true })
await writeFile(
  path.join(root, `docs/build-metrics-fase-${phase}.json`),
  JSON.stringify(metrics, null, 2) + '\n',
)
console.log(JSON.stringify(metrics, null, 2))
