/* global window, document, createImageBitmap, AbortController, URL, setTimeout */
import { chromium, firefox, webkit } from '@playwright/test'
import { build } from 'vite'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { PDFDocument } from 'pdf-lib'

await build({
  build: {
    outDir: '.cache/export-bench',
    emptyOutDir: true,
    minify: true,
    lib: { entry: 'scripts/export-fixture.ts', formats: ['es'], fileName: () => 'bench.js' },
  },
})
const root = resolve('.cache/export-bench')
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html')
      response.end('<!doctype html><title>Export verification</title>')
      return
    }
    const file = resolve(root, '.' + request.url)
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end()
      return
    }
    response.setHeader('Content-Type', 'text/javascript')
    response.end(await readFile(file))
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(4186, '127.0.0.1', resolve))
await mkdir('.cache/export-verification', { recursive: true })
const results = [],
  files = []
try {
  for (const [browserName, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch()
    try {
      const page = await browser.newPage()
      await page.goto('http://127.0.0.1:4186/')
      await page.evaluate(async () => {
        const api = await import('/bench.js')
        window.__api = api
        const canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 400
        const ctx = canvas.getContext('2d')
        for (let y = 0; y < 400; y += 20)
          for (let x = 0; x < 600; x += 20) {
            ctx.fillStyle = `rgb(${x % 255},${y % 255},${(x + y) % 255})`
            ctx.fillRect(x, y, 20, 20)
          }
        ctx.fillStyle = '#fff'
        ctx.fillRect(100, 100, 400, 90)
        ctx.fillStyle = '#3c2343'
        ctx.font = '24px Georgia'
        ctx.fillText('mesma foto, recortes diferentes', 110, 150)
        window.__photo = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        canvas.width = canvas.height = 0
        window.__compare = async (expected, actual) => {
          const first = await createImageBitmap(expected),
            second = await createImageBitmap(actual)
          if (first.width !== second.width || first.height !== second.height)
            throw Error('Dimensões diferentes')
          const canvas = document.createElement('canvas'),
            scale = Math.min(1, 1000 / Math.max(first.width, first.height))
          canvas.width = Math.round(first.width * scale)
          canvas.height = Math.round(first.height * scale)
          const ctx = canvas.getContext('2d')
          ctx.drawImage(first, 0, 0, canvas.width, canvas.height)
          const a = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          ctx.drawImage(second, 0, 0, canvas.width, canvas.height)
          const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          let sum = 0,
            changed = 0,
            max = 0
          for (let i = 0; i < a.length; i += 4) {
            const differences = [
              Math.abs(a[i] - b[i]),
              Math.abs(a[i + 1] - b[i + 1]),
              Math.abs(a[i + 2] - b[i + 2]),
            ]
            sum += differences[0] + differences[1] + differences[2]
            const pixel = Math.max(...differences)
            max = Math.max(max, pixel)
            if (pixel > 24) changed++
          }
          first.close()
          second.close()
          canvas.width = canvas.height = 0
          return { mae: sum / ((a.length / 4) * 3), changedRatio: changed / (a.length / 4), max }
        }
      })
      const strategy = await page.evaluate(() => window.__api.prepareExecution())
      const cases = await page.evaluate(
        (full) =>
          window.__api.models.flatMap((model, index) =>
            (full ? window.__api.formats : [window.__api.formats[index % 4]]).flatMap((format) =>
              ['high', 'share'].map((size) => ({ model: model.id, format: format.id, size })),
            ),
          ),
        browserName === 'chromium',
      )
      for (const item of cases) {
        const result = await page.evaluate(async (item) => {
          const api = window.__api,
            composition = {
              ...api.createComposition(Array(12).fill('reused')),
              modelId: item.model,
              formatId: item.format,
            }
          composition.appearance = {
            ...composition.appearance,
            caption: 'café · máscara, bordas e memória',
            date: '18 / 10 / 2026',
            border: true,
            margin: 3,
            corner: 3,
          }
          composition.placements = composition.placements.map((p, i) => ({
            ...p,
            crop: { centerX: 0.25 + (i % 3) * 0.2, centerY: 0.65, zoom: 1 + (i % 3) * 0.5 },
          }))
          const snapshot = {
            composition,
            originals: new Map([['reused', window.__photo]]),
            metadata: new Map([['reused', { id: 'reused', width: 600, height: 400 }]]),
          }
          const dimensions = api.outputSize(composition, item.size),
            scene = api.resolveScene(composition, snapshot.metadata, dimensions)
          const canvas = document.createElement('canvas')
          canvas.width = dimensions.width
          canvas.height = dimensions.height
          const bitmap = await createImageBitmap(window.__photo)
          api.renderScene(
            canvas.getContext('2d', { alpha: false }),
            scene,
            new Map([['reused', { image: bitmap, width: 600, height: 400 }]]),
          )
          const reference = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
          bitmap.close()
          canvas.width = canvas.height = 0
          const main = await api.renderExport(
            { snapshot, type: 'png', size: item.size },
            new AbortController().signal,
          )
          const selected = await api.exportCollage(
            { snapshot, type: 'png', size: item.size },
            new AbortController().signal,
          )
          const mainDifference = await window.__compare(reference, main),
            selectedDifference = await window.__compare(reference, selected)
          window.__snapshot = snapshot
          return { dimensions, mainDifference, selectedDifference }
        }, item)
        const row = { browser: browserName, strategy, ...item, ...result }
        results.push(row)
        if (row.mainDifference.mae !== 0)
          throw Error(`Sequential order mismatch: ${JSON.stringify(row)}`)
        if (row.selectedDifference.mae > 3 || row.selectedDifference.changedRatio > 0.02)
          throw Error(`Significant executor difference: ${JSON.stringify(row)}`)
        if (
          browserName === 'chromium' &&
          item.format ===
            ['portrait', 'square', 'landscape', 'a4'][
              (cases.findIndex((c) => c.model === item.model) / 8) % 4
            ]
        ) {
          for (const type of ['jpeg', 'pdf']) {
            const name = `${item.model}-${item.format}-${item.size}.${type === 'jpeg' ? 'jpg' : type}`
            const downloaded = page.waitForEvent('download')
            await page.evaluate(
              async ({ type, size, name }) => {
                const blob = await window.__api.exportCollage(
                  { snapshot: window.__snapshot, type, size },
                  new AbortController().signal,
                )
                const anchor = document.createElement('a')
                anchor.href = URL.createObjectURL(blob)
                anchor.download = name
                anchor.click()
                setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
              },
              { type, size: item.size, name },
            )
            const file = await downloaded,
              path = `.cache/export-verification/${name}`
            await file.saveAs(path)
            if (type === 'pdf') {
              const pdf = await PDFDocument.load(await readFile(path)),
                dimensions = pdf.getPage(0).getSize()
              const a4 = item.format === 'a4'
              const expectedHeight = a4 ? (297 * 72) / 25.4 : 720
              if (pdf.getPageCount() !== 1 || Math.abs(dimensions.height - expectedHeight) > 0.001)
                throw Error(`PDF dimensions: ${name}`)
              const expectedWidth = a4
                ? (210 * 72) / 25.4
                : (720 * result.dimensions.width) / result.dimensions.height
              if (Math.abs(dimensions.width - expectedWidth) > 1)
                throw Error(`PDF proportion: ${name}`)
            }
            files.push({ ...item, type, bytes: (await readFile(path)).length })
          }
        }
      }
      console.log(
        JSON.stringify({
          browser: browserName,
          strategy,
          pngCases: cases.length,
          maxMeanDifference: Math.max(
            ...results
              .filter((r) => r.browser === browserName)
              .map((r) => r.selectedDifference.mae),
          ),
        }),
      )
    } finally {
      await browser.close()
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}
await writeFile(
  'docs/export-fidelity-fase-4.json',
  JSON.stringify(
    {
      reference:
        'Normal renderScene with originals vs sequential renderExport, and selected execution strategy. Same photograph reused with independent crops in every frame; 1000px inspection scale. No stored baselines replaced.',
      cases: results,
      additionalFiles: files,
    },
    null,
    2,
  ) + '\n',
)
