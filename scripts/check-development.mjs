/* global document */
import { chromium, firefox, webkit } from '@playwright/test'
import { URL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const path = new URL('../src/features/editor/FrameControls.tsx', import.meta.url)
const original = await readFile(path, 'utf8')
const results = []
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:5173/')
    await page.getByTestId('composition-preview').waitFor()
    await page.waitForFunction(
      () =>
        document.querySelector('[data-testid=composition-preview]')?.getAttribute('data-ready') ===
        'true',
    )
    const first = page.locator('.frame-control').first()
    await first.click()
    const canvas = await page.getByTestId('composition-preview').elementHandle()
    await writeFile(path, `${original}\n// Fast Refresh lifecycle verification ${name}\n`)
    await page.waitForTimeout(1000)
    await page.locator('.frame-control').nth(1).click()
    if (!(await page.locator('.frame-control').nth(1).getAttribute('class')).includes('selected'))
      throw Error(`${name}: selection after HMR`)
    if (await page.locator('#zoom').isDisabled()) throw Error(`${name}: zoom after HMR`)
    const preserved = await canvas.evaluate(
      (el) => el === document.querySelector('[data-testid=composition-preview]'),
    )
    if (!preserved || errors.length) throw Error(`${name}: continuity ${JSON.stringify(errors)}`)
    results.push({ engine: name, hmr: true, canvasPreserved: preserved })
  } finally {
    await writeFile(path, original)
    await browser.close()
  }
}
console.log(JSON.stringify(results, null, 2))
