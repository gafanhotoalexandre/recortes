// Only the three CC0 images documented in docs/fotografias-demonstrativas.md.
import { chromium, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

const root = new URL('../', import.meta.url)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4180/')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Modelo Arcos, 3 fotos', exact: true }).click()
  const thumbnails = page.locator('.model-card canvas')
  await expect(page.locator('.model-card canvas[data-ready=true]')).toHaveCount(9)
  const before = await thumbnails.evaluateAll((items) => items.map((item) => Number(item.dataset.renderCount)))
  await page.locator('input[type=file]').setInputFiles(await Promise.all([
    ['photo-1.jpg', 'Café.jpg'],
    ['photo-2.jpg', 'Chelsea.jpg'],
    ['photo-6.jpg', 'Grama.jpg'],
  ].map(async ([file, name]) => ({ name, mimeType: 'image/jpeg', buffer: await readFile(new URL(`public/demos/${file}`, root)) }))))
  await expect(page.locator('.photo-list .thumb')).toHaveCount(3)
  await expect(page.locator('.photo-list .thumb').first()).toBeEnabled()
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeEnabled()
  await expect.poll(async () => (await thumbnails.evaluateAll((items) => items.map((item) => Number(item.dataset.renderCount))))
    .every((count, index) => count > before[index])).toBe(true)
  await page.getByRole('heading', { name: 'Montar uma colagem', exact: true }).click()
  await page.getByRole('banner').scrollIntoViewIfNeeded()
  await page.screenshot({ path: fileURLToPath(new URL('docs/images/recortes-desktop.png', root)), fullPage: true, animations: 'disabled' })
} finally {
  await browser.close()
}
