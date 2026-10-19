/* global window, document, performance, fetch, createImageBitmap, AbortController */
import { chromium } from '@playwright/test'
import { build } from 'vite'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

await build({
  build: {
    outDir: '.cache/pdf-memory',
    emptyOutDir: true,
    minify: true,
    lib: { entry: 'scripts/pdf-memory-fixture.ts', formats: ['es'], fileName: () => 'memory.js' },
  },
})
const root = resolve('.cache/pdf-memory')
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<title>PDF memory check</title>')
      return
    }
    if (request.url === '/sample.png') {
      response.setHeader('Content-Type', 'image/png')
      response.end(await readFile('output/exports/recortes-bilhetes-a4.png'))
      return
    }
    const path = resolve(root, '.' + request.url)
    if (!path.startsWith(root + sep)) {
      response.writeHead(403).end()
      return
    }
    response.setHeader(
      'Content-Type',
      path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
    )
    response.end(await readFile(path))
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(4187, '127.0.0.1', resolve))
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] })
const results = []
try {
  for (const encoding of ['jpeg', 'png']) {
    const page = await browser.newPage()
    await page.goto('http://127.0.0.1:4187/')
    await page.evaluate(async (encoding) => {
      window.__api = await import('/memory.js')
      const png = await (await fetch('/sample.png')).blob()
      if (encoding === 'png') window.__input = png
      else {
        const image = await createImageBitmap(png), canvas = document.createElement('canvas')
        canvas.width = image.width; canvas.height = image.height
        canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0)
        window.__input = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96))
        image.close(); canvas.width = canvas.height = 0
      }
    }, encoding)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('HeapProfiler.collectGarbage')
    const row = await page.evaluate(async (encoding) => {
      const samples = []
      const sample = (stage) => samples.push({ stage, bytes: performance.memory.usedJSHeapSize })
      for (const method of [encoding === 'png' ? 'embedPng' : 'embedJpg', 'save']) {
        const native = window.__api.PDFDocument.prototype[method]
        window.__api.PDFDocument.prototype[method] = async function (...args) {
          sample(`before-${method}`)
          const result = await Reflect.apply(native, this, args)
          sample(`after-${method}`)
          return result
        }
      }
      sample('before')
      const start = performance.now()
      const result = await window.__api.createPdf(
        window.__input,
        'a4',
        encoding,
        new AbortController().signal,
      )
      sample('after')
      return {
        encoding,
        inputBytes: window.__input.size,
        pdfBytes: result.size,
        duration: performance.now() - start,
        samples,
      }
    }, encoding)
    await cdp.send('HeapProfiler.collectGarbage')
    row.afterGcBytes = await page.evaluate(() => performance.memory.usedJSHeapSize)
    results.push(row)
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
await writeFile(
  'docs/pdf-memory-fase-4.json',
  JSON.stringify(
    {
      method:
        'Fresh Chromium context per encoding, precise-memory-info, GC before the operation only. Samples at embedding/save boundaries; observed JS heap, not total RAM, native buffers or exact peak. Input is output/exports/recortes-bilhetes-a4.png, also encoded to JPEG .96 before timing. Generate it with capture-release.mjs first.',
      results,
    },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify(results, null, 2))
