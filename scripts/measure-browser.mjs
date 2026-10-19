/* global window, PerformanceObserver, document, requestAnimationFrame, MutationObserver, performance, Event */
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const phase = Number(process.argv.find(arg => arg.startsWith('--phase='))?.split('=')[1] ?? 2)
const server = await preview({
  preview: { host: '127.0.0.1', port: 4175, strictPort: true, open: false },
})
const browser = await chromium.launch()
const runs = []
try {
  for (let i = 0; i < 5; i++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__recortesCLS = 0
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift'))
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (!entry.hadRecentInput) window.__recortesCLS += entry.value
        }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('http://127.0.0.1:4175/')
    await page.locator('.paper canvas[data-ready=true]').waitFor()
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
    const initial = await page.evaluate(() => ({
      firstContentfulPaintMs:
        performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      cumulativeLayoutShift: window.__recortesCLS,
    }))
    const changes = []
    for (const format of ['square', 'landscape', 'a4', 'portrait']) {
      changes.push(
        await page.evaluate(async (format) => {
          const select = document.querySelector('select')
          const image = document.querySelector('.paper canvas')
          const start = performance.now()
          const changed = new Promise((resolve) => {
            const observer = new MutationObserver(() => {
              if (image.dataset.format === format) {
                observer.disconnect()
                resolve()
              }
            })
            observer.observe(image, { attributes: true, attributeFilter: ['data-format'] })
          })
          select.value = format
          select.dispatchEvent(new Event('change', { bubbles: true }))
          await changed
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
          return performance.now() - start
        }, format),
      )
    }
    const rendering = await page.locator('.paper canvas').evaluate((canvas) => ({
      resolveMs: Number(canvas.dataset.resolveMs),
      renderAndCopyMs: Number(canvas.dataset.renderMs),
      bitmapWidth: canvas.width,
      bitmapHeight: canvas.height,
      approximateRgbaCanvasBytes: [...document.querySelectorAll('canvas')].reduce(
        (sum, item) => sum + item.width * item.height * 8,
        0,
      ),
    }))
    runs.push({ ...initial, formatChangeMs: changes, rendering })
    await context.close()
  }
  const times = runs.flatMap((run) => run.formatChangeMs).sort((a, b) => a - b)
  const result = {
    environment: `Chromium ${browser.version()}, headless, Windows, viewport 1440x1000, localhost, sem throttling`,
    description:
      '5 contextos novos; 20 trocas de formato. Tempos incluem resolução/desenho Canvas e duas oportunidades de pintura. Memória estima apenas pixels RGBA dos canvases e buffers auxiliares, sem decodificadores, GPU ou heap. Não mede arraste, aparelho físico ou rede real.',
    formatChangeP95Ms: times[Math.ceil(times.length * 0.95) - 1],
    runs,
  }
  await mkdir(path.join(root, 'docs'), { recursive: true })
  await writeFile(
    path.join(root, `docs/browser-metrics-fase-${phase}.json`),
    JSON.stringify(result, null, 2) + '\n',
  )
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
