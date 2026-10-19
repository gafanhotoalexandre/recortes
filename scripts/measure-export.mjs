/* global window, self, document, performance, requestAnimationFrame, PerformanceObserver, ImageBitmap, OffscreenCanvas, URL, AbortController, setTimeout */
import { chromium } from '@playwright/test'
import { build } from 'vite'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

await build({
  build: {
    outDir: '.cache/export-bench',
    emptyOutDir: true,
    minify: true,
    lib: { entry: 'scripts/export-fixture.ts', formats: ['es'], fileName: () => 'bench.js' },
  },
})
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<!doctype html><title>Export benchmark</title>')
      return
    }
    const file = resolve('.cache/export-bench', '.' + request.url)
    if (!file.startsWith(resolve('.cache/export-bench') + '\\')) {
      response.writeHead(403).end()
      return
    }
    const bytes = await readFile(file)
    response.setHeader(
      'Content-Type',
      extname(file) === '.js' ? 'text/javascript' : 'application/octet-stream',
    )
    response.end(bytes)
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(4186, '127.0.0.1', resolve))
await mkdir('output/pdf', { recursive: true })
await mkdir('output/exports', { recursive: true })
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
const results = []
const useWorker = process.argv.includes('--worker')
try {
  for (const rate of [1, 4]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const cdp = await page.context().newCDPSession(page)
    await page.goto('http://127.0.0.1:4186/')
    // Fixture creation is excluded from timings and CPU throttling.
    await page.evaluate(async () => {
      const api = await import('/bench.js')
      window.__exportApi = api
      const make = async (width, height, type) => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        const data = ctx.createImageData(width, height)
        let seed = 12345
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
            const i = (y * width + x) * 4,
              noise = (seed >>> 24) * 0.24
            data.data[i] = 40 + (140 * x) / width + noise
            data.data[i + 1] = 30 + (150 * y) / height + noise
            data.data[i + 2] = 120 + 70 * Math.sin(x / 130) + noise
            data.data[i + 3] = type === 'image/png' && x < width / 3 ? 100 : 255
          }
        ctx.putImageData(data, 0, 0)
        ctx.fillStyle = '#fffaf4'
        ctx.fillRect(width * 0.1, height * 0.2, width * 0.65, height * 0.17)
        ctx.fillStyle = '#35233f'
        ctx.font = `${width / 28}px Georgia`
        ctx.fillText('recortes. · café, bordas e memória', width * 0.12, height * 0.31)
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.82))
        canvas.width = canvas.height = 0
        return blob
      }
      window.__fixtures = {
        jpeg: await make(4000, 3000, 'image/jpeg'),
        large: await make(8000, 4000, 'image/jpeg'),
        alpha: await make(1200, 900, 'image/png'),
      }
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    for (const scenario of [
      {
        model: 'bilhetes',
        format: 'a4',
        type: 'pdf',
        encoding: 'jpeg',
        size: 'high',
        fixture: 'jpeg',
      },
      {
        model: 'bilhetes',
        format: 'a4',
        type: 'pdf',
        encoding: 'png',
        size: 'high',
        fixture: 'jpeg',
      },
      {
        model: 'arcos',
        format: 'square',
        type: 'pdf',
        encoding: 'jpeg',
        size: 'share',
        fixture: 'alpha',
      },
      {
        model: 'arcos',
        format: 'square',
        type: 'pdf',
        encoding: 'png',
        size: 'share',
        fixture: 'alpha',
      },
      { model: 'fotogramas', format: 'a4', type: 'png', size: 'high', fixture: 'large' },
      { model: 'mural', format: 'a4', type: 'jpeg', size: 'high', fixture: 'jpeg' },
      {
        model: 'bilhetes',
        format: 'a4',
        type: 'pdf',
        encoding: 'jpeg',
        size: 'high',
        fixture: 'jpeg',
        warm: true,
      },
    ]) {
      await page.evaluate(() => {
        window.__lastExport = null
      })
      await cdp.send('HeapProfiler.collectGarbage')
      if (useWorker) {
        await page.evaluate(() => window.__exportApi.prepareExecution())
        await page.workers()[0].evaluate(() => {
          const original = self.createImageBitmap,
            close = ImageBitmap.prototype.close
          const stats = {
            active: 0,
            peak: 0,
            decoded: 0,
            closed: 0,
            maxBitmapBytes: 0,
            decodeInvokeMs: [],
            encodeInvokeMs: [],
            heapBefore: performance.memory?.usedJSHeapSize,
          }
          self.__bitmapStats = stats
          self.createImageBitmap = async (...args) => {
            const start = performance.now(),
              pending = Reflect.apply(original, self, args)
            stats.decodeInvokeMs.push(performance.now() - start)
            const image = await pending
            stats.decoded++
            stats.peak = Math.max(stats.peak, ++stats.active)
            stats.maxBitmapBytes = Math.max(stats.maxBitmapBytes, image.width * image.height * 4)
            return image
          }
          ImageBitmap.prototype.close = function () {
            stats.closed++
            stats.active--
            return close.call(this)
          }
          const encode = OffscreenCanvas.prototype.convertToBlob
          OffscreenCanvas.prototype.convertToBlob = function (...args) {
            const start = performance.now()
            const pending = Reflect.apply(encode, this, args)
            stats.encodeInvokeMs.push(performance.now() - start)
            return pending
          }
          self.__restoreStats = () => {
            self.createImageBitmap = original
            ImageBitmap.prototype.close = close
            OffscreenCanvas.prototype.convertToBlob = encode
          }
        })
      }
      const measurement = await page.evaluate(
        async (scenario) => {
          const api = window.__exportApi
          const ids = Array.from({ length: 12 }, (_, i) => `fixture-${i}`)
          const composition = {
            ...api.createComposition(ids),
            modelId: scenario.model,
            formatId: scenario.format,
          }
          composition.appearance.caption = 'café, pequenos textos e memórias'
          composition.appearance.date = '18 · outubro · 2026'
          composition.appearance.border = true
          const blob = window.__fixtures[scenario.fixture]
          const dims =
            scenario.fixture === 'large'
              ? [8000, 4000]
              : scenario.fixture === 'alpha'
                ? [1200, 900]
                : [4000, 3000]
          const snapshot = {
            composition,
            originals: new Map(ids.map((id) => [id, blob])),
            metadata: new Map(ids.map((id) => [id, { id, width: dims[0], height: dims[1] }])),
          }
          const nativeDecode = window.createImageBitmap.bind(window),
            nativeClose = ImageBitmap.prototype.close
          let active = 0,
            peak = 0,
            decoded = 0,
            closed = 0
          window.createImageBitmap = async (...args) => {
            const image = await Reflect.apply(nativeDecode, window, args)
            decoded++
            peak = Math.max(peak, ++active)
            return image
          }
          ImageBitmap.prototype.close = function () {
            closed++
            active--
            return nativeClose.call(this)
          }
          const longTasks = [],
            frames = []
          const observer = new PerformanceObserver((list) =>
            longTasks.push(...list.getEntries().map((e) => e.duration)),
          )
          observer.observe({ type: 'longtask' })
          let sampling = true,
            previous = performance.now()
          const sample = (time) => {
            frames.push(time - previous)
            previous = time
            if (sampling) requestAnimationFrame(sample)
          }
          requestAnimationFrame(sample)
          const start = performance.now(),
            heapBefore = performance.memory?.usedJSHeapSize
          try {
            const output = await (scenario.useWorker ? api.exportCollage : api.renderExport)(
              { snapshot, type: scenario.type, size: scenario.size, pdfImage: scenario.encoding },
              new AbortController().signal,
            )
            const duration = performance.now() - start
            const heapAfter = performance.memory?.usedJSHeapSize
            sampling = false
            await new Promise((resolve) => setTimeout(resolve, 80))
            const measures = performance
              .getEntriesByType('measure')
              .filter((e) => e.name.startsWith('recortes-export-'))
              .map((e) => ({ stage: e.name.replace('recortes-export-', ''), ms: e.duration }))
            window.__lastExport = output
            return {
              duration,
              bytes: output.size,
              mime: output.type,
              inputBytes: blob.size,
              decoded,
              closed,
              peakBitmaps: peak,
              activeBitmaps: active,
              maxBitmapBytes: dims[0] * dims[1] * 4,
              outputCanvasBytes:
                api.outputSize(composition, scenario.size).width *
                api.outputSize(composition, scenario.size).height *
                4,
              longTasks,
              maxFrameGap: Math.max(...frames),
              measures,
              heapBefore,
              heapAfter,
              offscreen: typeof OffscreenCanvas === 'function',
            }
          } finally {
            sampling = false
            observer.disconnect()
            window.createImageBitmap = nativeDecode
            ImageBitmap.prototype.close = nativeClose
          }
        },
        { ...scenario, useWorker },
      )
      const row = { rate, ...scenario, ...measurement }
      if (useWorker) {
        const stats = await page.workers()[0].evaluate(() => {
          const result = { ...self.__bitmapStats, heapAfter: performance.memory?.usedJSHeapSize }
          self.__restoreStats()
          return result
        })
        Object.assign(row, {
          decoded: stats.decoded,
          closed: stats.closed,
          peakBitmaps: stats.peak,
          activeBitmaps: stats.active,
          maxBitmapBytes: stats.maxBitmapBytes,
          workerInstrumentation: stats,
        })
      }
      results.push(row)
      console.log(
        JSON.stringify({
          rate,
          ...scenario,
          ms: row.duration,
          bytes: row.bytes,
          longestTask: Math.max(0, ...row.longTasks),
          maxFrameGap: row.maxFrameGap,
        }),
      )
      if (rate === 1 && !scenario.warm) {
        const filename = `recortes-${scenario.model}-${scenario.format}-${scenario.size}${scenario.encoding ? '-' + scenario.encoding : ''}.${scenario.type === 'jpeg' ? 'jpg' : scenario.type}`
        const downloaded = page.waitForEvent('download')
        await page.evaluate((filename) => {
          const anchor = document.createElement('a')
          anchor.href = URL.createObjectURL(window.__lastExport)
          anchor.download = filename
          anchor.click()
        }, filename)
        await (
          await downloaded
        ).saveAs(`${scenario.type === 'pdf' ? 'output/pdf' : 'output/exports'}/${filename}`)
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
await writeFile(
  `docs/export-metrics-${useWorker ? 'worker' : 'main'}-fase-4.json`,
  JSON.stringify(
    {
      environment:
        'Chromium local, synthetic textured fixtures. CDP x4 throttles the page target; worker CPU is not throttled. Total times across executors at x4 are not equivalent hardware comparisons. These checks are not a physical phone.',
      runs: results,
    },
    null,
    2,
  ) + '\n',
)
