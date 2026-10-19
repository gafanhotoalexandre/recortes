/* global window, document, performance, requestAnimationFrame, PerformanceObserver, URL, ImageBitmap, CanvasRenderingContext2D */
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const server = await preview({ preview: { host: '127.0.0.1', port: 4177, strictPort: true } })
const browser = await chromium.launch()
const runs = []
await mkdir('.cache/performance-photos', { recursive: true })
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.addInitScript(() => {
      const canvases = new Set(),
        liveBitmaps = new Set(),
        urls = new Set()
      const stats = {
        phaseStart: 0,
        preprocessingCalls: [],
        canvases,
        liveBitmaps,
        urls,
        maxBitmapBytes: 0,
        maxCanvasBytes: 0,
        decoded: 0,
        closed: 0,
        longTasks: [],
        sampling: true,
        frames: [],
        previous: 0,
      }
      window.__resources = stats
      const drawImage = CanvasRenderingContext2D.prototype.drawImage
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        const start = performance.now()
        try {
          return Reflect.apply(drawImage, this, args)
        } finally {
          if (this.canvas.dataset.resource)
            stats.preprocessingCalls.push({
              kind: this.canvas.dataset.resource,
              ms: performance.now() - start,
            })
        }
      }
      const createElement = document.createElement.bind(document)
      document.createElement = (name, options) => {
        const element = createElement(name, options)
        if (name === 'canvas') canvases.add(element)
        return element
      }
      const decode = window.createImageBitmap.bind(window),
        close = ImageBitmap.prototype.close
      window.createImageBitmap = async (...args) => {
        const image = await Reflect.apply(decode, window, args)
        stats.decoded++
        liveBitmaps.add(image)
        stats.maxBitmapBytes = Math.max(
          stats.maxBitmapBytes,
          [...liveBitmaps].reduce((n, b) => n + b.width * b.height * 4, 0),
        )
        return image
      }
      ImageBitmap.prototype.close = function () {
        if (liveBitmaps.delete(this)) stats.closed++
        return close.call(this)
      }
      const createURL = URL.createObjectURL.bind(URL),
        revokeURL = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = (object) => {
        const url = createURL(object)
        urls.add(url)
        return url
      }
      URL.revokeObjectURL = (url) => {
        urls.delete(url)
        revokeURL(url)
      }
      if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
        new PerformanceObserver((list) => {
          stats.longTasks.push(
            ...list
              .getEntries()
              .filter((e) => e.startTime >= stats.phaseStart)
              .map((e) => ({ start: e.startTime, duration: e.duration })),
          )
        }).observe({ type: 'longtask', buffered: true })
      const sample = (time) => {
        if (!stats.sampling) return
        if (stats.previous) stats.frames.push(time - stats.previous)
        stats.previous = time
        stats.maxCanvasBytes = Math.max(
          stats.maxCanvasBytes,
          [...canvases].reduce((n, c) => n + c.width * c.height * 4, 0),
        )
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.goto('http://127.0.0.1:4177/')
    await page.locator('.paper canvas[data-ready=true]').waitFor()
    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas')
      c.width = 4000
      c.height = 3000
      const ctx = c.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, c.width, c.height)
      gradient.addColorStop(0, '#ebbb65')
      gradient.addColorStop(0.5, '#765884')
      gradient.addColorStop(1, '#588981')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, c.width, c.height)
      const data = c.toDataURL('image/jpeg', 0.9).split(',')[1]
      c.width = c.height = 0
      return data
    })
    const files = Array.from({ length: 12 }, (_, i) => ({
      name: `fixture-${i}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(fixture, 'base64'),
    }))
    await page.evaluate(() => {
      window.__resources.longTasks = []
      window.__resources.phaseStart = performance.now()
      window.__resources.frames = []
      window.__resources.previous = 0
    })
    const start = performance.now()
    const paths = files.map((file) => resolve('.cache/performance-photos', file.name))
    await Promise.all(files.map((file, i) => writeFile(paths[i], file.buffer)))
    await page.locator('input[type=file]').setInputFiles(paths)
    await page.getByRole('button', { name: 'Selecionar foto: fixture-11', exact: true }).waitFor()
    await page
      .getByRole('button', { name: 'Cancelar processamento' })
      .waitFor({ state: 'detached' })
    const importMs = performance.now() - start
    const resources = await page.evaluate(() => {
      const s = window.__resources
      return {
        decoded: s.decoded,
        closed: s.closed,
        liveBitmaps: s.liveBitmaps.size,
        activeObjectUrls: s.urls.size,
        retainedPreviewRgbaBytes: [...s.canvases]
          .filter((c) => c.dataset.resource === 'photo-preview')
          .reduce((n, c) => n + c.width * c.height * 4, 0),
        decodedLibraryThumbnailRgbaBytes: [...document.querySelectorAll('.photo-list img')].reduce(
          (n, i) => n + i.naturalWidth * i.naturalHeight * 4,
          0,
        ),
        trackedCanvasPeakRgbaBytes: s.maxCanvasBytes,
        nativeBitmapPeakRgbaBytes: s.maxBitmapBytes,
        importLongTasks: s.longTasks,
        preprocessingCalls: s.preprocessingCalls,
        importFrameIntervals: s.frames,
      }
    })
    await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
    const frame = page.locator('[data-placement=position-1]')
    await frame.focus()
    await page.keyboard.press('Enter')
    await page.locator('#zoom').fill('2')
    await page.locator('#zoom').dispatchEvent('pointerup')
    await page.waitForTimeout(220)
    const thumbnailCounts = () =>
      page
        .locator('.model-thumbnail canvas')
        .evaluateAll((cs) => cs.map((c) => Number(c.dataset.renderCount)))
    const before = await thumbnailCounts()
    const box = await frame.boundingBox(),
      x = box.x + box.width / 2,
      y = box.y + box.height / 2
    await page.evaluate(() => {
      window.__resources.frames = []
      window.__resources.previous = 0
      window.__resources.longTasks = []
      window.__resources.phaseStart = performance.now()
    })
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 65, y + 35, { steps: 60 })
    const during = await thumbnailCounts()
    const dragging = await page.evaluate(() => ({
      frameIntervals: window.__resources.frames,
      longTasks: window.__resources.longTasks,
      renderAndCopyMs: Number(document.querySelector('.paper canvas').dataset.renderMs),
    }))
    await page.mouse.up()
    await page.waitForTimeout(220)
    const after = await thumbnailCounts()
    await page.getByRole('button', { name: 'Recomeçar', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Recomeçar', exact: true }).click()
    await page
      .getByRole('button', { name: 'Selecionar foto de exemplo: Um café', exact: true })
      .waitFor()
    const afterReset = await page.evaluate(() => {
      const s = window.__resources
      s.sampling = false
      return {
        activeObjectUrls: s.urls.size,
        liveBitmaps: s.liveBitmaps.size,
        retainedPreviewRgbaBytes: [...s.canvases]
          .filter((c) => c.dataset.resource === 'photo-preview')
          .reduce((n, c) => n + c.width * c.height * 4, 0),
      }
    })
    const p95 = (values) =>
      values.length
        ? values.slice().sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
        : null
    runs.push({
      importMs,
      originalCompressedBytes: files.reduce((n, f) => n + f.buffer.length, 0),
      resources,
      drag: {
        sampleCount: dragging.frameIntervals.length,
        frameIntervalP95Ms: p95(dragging.frameIntervals),
        renderAndCopyMs: dragging.renderAndCopyMs,
        longTasks: dragging.longTasks,
        thumbnailDrawsDuring: during.map((n, i) => n - before[i]),
        thumbnailDrawsAfter: after.map((n, i) => n - before[i]),
      },
      afterReset,
    })
    await context.close()
  }
  const result = {
    environment: `Chromium ${browser.version()}, headless, Windows, 1440×1000 DPR1, localhost, sem throttling`,
    fixture:
      '12 JPEG sintéticos de 4000×3000 (12MP), três contextos; 60 movimentos por arraste inclinado com zoom2.',
    limitations:
      'Instrumentação retém referências aos canvases para contar dimensões; não mede heap, RAM, GPU, buffers internos ou pressão de memória em aparelho físico. Picos separados não ocorreram necessariamente juntos. Não mede navegação real sob rede móvel.',
    runs,
  }
  const phase = Number(process.argv.find(arg => arg.startsWith('--phase='))?.split('=')[1] ?? 3)
  await writeFile(`docs/editing-metrics-fase-${phase}.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
