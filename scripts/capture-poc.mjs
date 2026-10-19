/* global document, state:writable, MODELS, FORMATS, paint, images, loadImage */
// Executes the preserved POC with only demo-8 replaced in memory. Never extracts old photos.
import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'
import path from 'node:path'
import { approvedColors } from './demo-assets.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.resolve(root, '../recortes-poc-final.html')
const { bytes: colors } = await approvedColors()
const onlyModel = process.argv.find((arg) => arg.startsWith('--model='))?.slice(8)
const hash = createHash('sha256')
  .update(await readFile(source))
  .digest('hex')
await mkdir(path.join(root, 'public/references'), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.goto(pathToFileURL(source).href)
  await page.waitForFunction(
    () =>
      document.getElementById('modelName')?.textContent === 'Janela' &&
      document.getElementById('busyLine')?.hidden,
  )
  await page.evaluate(async (url) => {
    images.set('demo-8', await loadImage(url))
  }, `data:image/jpeg;base64,${colors.toString('base64')}`)
  const data = await page.evaluate((onlyModel) => {
    const refs = []
    const original = state
    if (onlyModel && !MODELS.some((model) => model.id === onlyModel)) throw Error('Modelo inválido.')
    for (const m of MODELS) {
      if (onlyModel && m.id !== onlyModel) continue
      for (const format of Object.keys(FORMATS)) {
        state = { ...original, model: m.id, format }
        const ratio = FORMATS[format].ratio
        const canvas = document.createElement('canvas')
        paint(canvas, Math.round(1000 * Math.min(1, ratio)), Math.round(1000 / Math.max(1, ratio)))
        refs.push({ file: `${m.id}-${format}.webp`, url: canvas.toDataURL('image/webp', 0.94) })
      }
      state = { ...original, model: m.id, format: 'portrait', margin: 0, caption: '', date: '' }
      const thumb = document.createElement('canvas')
      paint(thumb, 160, 200, { mini: true })
      refs.push({ file: `${m.id}-thumb.webp`, url: thumb.toDataURL('image/webp', 0.94) })
    }
    state = original
    return { refs }
  }, onlyModel)
  for (const ref of data.refs)
    await writeFile(
      path.join(root, 'public/references', ref.file),
      Buffer.from(ref.url.split(',')[1], 'base64'),
    )
  const after = createHash('sha256')
    .update(await readFile(source))
    .digest('hex')
  if (hash !== after) throw new Error('A referência original foi alterada.')
  console.log(`${data.refs.length} referências capturadas com demo-8 original do recortes. Fotos/catálogo não sobrescritos. POC preservada: ${hash}`)
} finally {
  await browser.close()
}
