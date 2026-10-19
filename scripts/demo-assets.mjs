import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { URL } from 'node:url'

export const retiredColorHash = 'c6b81f9247fb3950987804137db973ab988776b3d948d8778eea9cc55b12249e'
export async function approvedColors() {
  const root = new URL('../', import.meta.url)
  const catalog = JSON.parse(await readFile(new URL('src/features/editor/demo-assets.json', root), 'utf8'))
  const bytes = await readFile(new URL('public/demos/photo-8.jpg', root))
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash === retiredColorHash || hash !== catalog.replacement?.sha256 || catalog.replacement?.id !== 'demo-8')
    throw Error('Exemplo cromático não aprovado. Execute node scripts/generate-colors.mjs; não restaure a roda antiga.')
  return { catalog, bytes, hash }
}
