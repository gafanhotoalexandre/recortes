/* global window, document, Image */
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const server = await createServer({
  server: { host: '127.0.0.1', port: 4176, strictPort: true, open: false },
})
await server.listen()
const browser = await chromium.launch()
const results = []
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:4176/tests/browser/renderer.html')
  await page.waitForFunction(() => !!window.renderFixture)
  const cases = await page.evaluate(() =>
    window.fixtureModels.flatMap((model) => [
      ...window.fixtureFormats.map((format) => ({
        modelId: model.id,
        formatId: format.id,
        thumbnail: false,
      })),
      { modelId: model.id, formatId: 'portrait', thumbnail: true },
    ]),
  )
  await mkdir('test-results/visual-comparison', { recursive: true })
  for (const item of cases) {
    const data = await page.evaluate(async (item) => {
      const name = `${item.modelId}-${item.thumbnail ? 'thumb' : item.formatId}`
      const reference = new Image()
      reference.src = `/references/${name}.webp`
      await reference.decode()
      const { width, height } = reference
      const render = await window.renderFixture(
        item.modelId,
        item.formatId,
        width,
        height,
        item.thumbnail,
      )
      const actual = document.getElementById('result')
      const expected = document.createElement('canvas')
      expected.width = width
      expected.height = height
      expected.getContext('2d').drawImage(reference, 0, 0)
      const a = actual.getContext('2d').getImageData(0, 0, width, height).data
      const b = expected.getContext('2d').getImageData(0, 0, width, height).data
      let sum = 0,
        changed = 0
      const diff = expected.getContext('2d').createImageData(width, height)
      for (let p = 0; p < a.length; p += 4) {
        let max = 0
        for (let c = 0; c < 3; c++) {
          const d = Math.abs(a[p + c] - b[p + c])
          sum += d
          max = Math.max(max, d)
          diff.data[p + c] = Math.min(255, d * 5)
        }
        diff.data[p + 3] = 255
        if (max > 24) changed++
      }
      const meanError = sum / (width * height * 3),
        changedRatio = changed / (width * height)
      const expectedPng = expected.toDataURL('image/png')
      expected.getContext('2d').putImageData(diff, 0, 0)
      return {
        name,
        width,
        height,
        meanError,
        changedRatio,
        initialTargetsMet: meanError <= 3 && changedRatio <= 0.01,
        renderMs: render.duration,
        actual: actual.toDataURL('image/png'),
        expected: expectedPng,
        diff: expected.toDataURL('image/png'),
      }
    }, item)
    if (
      !data.initialTargetsMet ||
      ['bilhetes-landscape', 'arcos-portrait', 'fotogramas-a4', 'postal-landscape'].includes(
        data.name,
      )
    ) {
      for (const kind of ['actual', 'expected', 'diff'])
        await writeFile(
          `test-results/visual-comparison/${data.name}-${kind}.png`,
          Buffer.from(data[kind].split(',')[1], 'base64'),
        )
    }
    const metrics = Object.fromEntries(
      Object.entries(data).filter(([key]) => !['actual', 'expected', 'diff'].includes(key)),
    )
    results.push(metrics)
    console.log(
      `${metrics.name}: MAE ${metrics.meanError.toFixed(3)}, pixels >24 ${(metrics.changedRatio * 100).toFixed(3)}% ${metrics.initialTargetsMet ? 'OK' : 'INVESTIGAR'}`,
    )
  }
  const highResolution = []
  for (const [modelId, formatId, width, height] of [
    ['fotogramas', 'a4', 2480, 3508],
    ['bilhetes', 'portrait', 2400, 3000],
    ['arcos', 'landscape', 3000, 2000],
  ]) {
    highResolution.push(
      await page.evaluate(
        async (item) => {
          const rendered = await window.renderFixture(
            item.modelId,
            item.formatId,
            item.width,
            item.height,
          )
          const canvas = document.getElementById('result')
          const pixel = [...canvas.getContext('2d').getImageData(0, 0, 1, 1).data]
          if (
            canvas.width !== item.width ||
            canvas.height !== item.height ||
            pixel.join(',') !== '255,250,244,255'
          )
            throw new Error('Renderização de alta resolução inválida')
          return {
            ...rendered,
            width: canvas.width,
            height: canvas.height,
            paperPixel: pixel,
            rgbaSurfaceBytes: canvas.width * canvas.height * 4,
          }
        },
        { modelId, formatId, width, height },
      ),
    )
  }
  await mkdir('docs', { recursive: true })
  await writeFile(
    process.argv.includes('--final') ? 'docs/visual-comparison-final.json' : process.argv.includes('--phase=4') ? 'docs/visual-comparison-fase-4.json' : process.argv.includes('--phase=3')
      ? 'docs/visual-comparison-fase-3.json'
      : 'docs/visual-comparison.json',
    JSON.stringify(
      {
        browser: browser.version(),
        reference: '40 WebP originais da POC e 5 Mural com somente demo-8 substituído em memória; histórico local preservado',
        thresholdsAreInitialReferences: true,
        results,
        highResolution,
      },
      null,
      2,
    ) + '\n',
  )
} finally {
  await browser.close()
  await server.close()
}
