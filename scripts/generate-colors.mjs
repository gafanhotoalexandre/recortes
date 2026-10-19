/* global document */
// Original chromatic study for recortes: six gradient paper strips, no external inputs.
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath, URL } from 'node:url'

const root = new URL('../', import.meta.url)
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 460
    canvas.height = 560
    const ctx = canvas.getContext('2d', { alpha: false })
    ctx.fillStyle = '#f6efe6'
    ctx.fillRect(0, 0, 460, 560)
    const colors = [
      ['#ef8574', '#bf415c'], ['#f4cd72', '#d88a49'],
      ['#b8dba4', '#499c86'], ['#85d4d9', '#3b8daf'],
      ['#929edf', '#6355a5'], ['#d7a8cf', '#a95683'],
    ]
    ctx.translate(230, 280)
    ctx.rotate(-Math.PI / 7)
    colors.forEach(([light, dark], index) => {
      const x = -345 + index * 112
      const y = -385 + (index % 2) * 48
      ctx.save()
      ctx.shadowColor = '#35244124'
      ctx.shadowBlur = 12
      ctx.shadowOffsetY = 7
      const gradient = ctx.createLinearGradient(x, y, x + 112, y + 680)
      gradient.addColorStop(0, light)
      gradient.addColorStop(1, dark)
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, 104, 690, 45)
      ctx.fill()
      ctx.restore()
      ctx.strokeStyle = '#ffffff55'
      ctx.lineWidth = 1
      ctx.stroke()
    })
    ctx.resetTransform()
    // Deterministic, subtle paper grain; not sampled from a photograph/texture.
    let seed = 271828
    const pixels = ctx.getImageData(0, 0, 460, 560)
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const grain = ((seed >>> 24) / 255 - 0.5) * 3
      for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] += grain
    }
    ctx.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.93).split(',')[1]
  })
  const bytes = Buffer.from(data, 'base64')
  await writeFile(new URL('public/demos/photo-8.jpg', root), bytes)
  const catalogFile = new URL('src/features/editor/demo-assets.json', root)
  const catalog = JSON.parse(await readFile(catalogFile, 'utf8'))
  catalog.replacement = {
    id: 'demo-8',
    source: 'scripts/generate-colors.mjs',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    description: 'Estudo cromático original: seis faixas de papel com gradientes e grão procedural.',
  }
  await writeFile(catalogFile, JSON.stringify(catalog, null, 2) + '\n')
  console.log(`Cores: 460 × 560 px, ${bytes.length} bytes. ${fileURLToPath(catalogFile)}`)
} finally {
  await browser.close()
}
