/* global document */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

await mkdir('docs/screenshots-fase-4', { recursive: true })
await mkdir('output/exports', { recursive: true })
await mkdir('output/pdf', { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4180/')
  await page.getByTestId('composition-preview').waitFor()
  await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
  await page.getByRole('combobox').selectOption('a4')
  await page.screenshot({ path: 'docs/screenshots-fase-4/desktop.png', fullPage: true })
  const exportFile = async (name, type, size) => {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Exportar colagem' })
    await page.waitForFunction(() => document.querySelector('.export-status')?.textContent.includes('PNG, JPEG e PDF prontos'))
    await dialog.getByLabel('Nome do arquivo').fill(name)
    await dialog.getByLabel('Arquivo', { exact: true }).selectOption(type)
    await dialog.getByLabel('Tamanho', { exact: true }).selectOption(size)
    const completed = page.waitForEvent('download')
    await dialog.getByRole('button', { name: `Baixar ${type === 'jpeg' ? 'JPEG' : type.toUpperCase()}`, exact: true }).click()
    const download = await completed
    await download.saveAs(`${type === 'pdf' ? 'output/pdf' : 'output/exports'}/${download.suggestedFilename()}`)
    await page.screenshot({ path: `docs/screenshots-fase-4/export-${type}.png` })
    await page.keyboard.press('Escape')
  }
  await exportFile('bilhetes-a4', 'png', 'high')
  await exportFile('bilhetes-a4', 'pdf', 'high')
  await page.getByRole('button', { name: 'Modelo Fotogramas, 6 fotos' }).click()
  await exportFile('fotogramas-a4', 'pdf', 'high')
  await page.getByRole('button', { name: 'Modelo Arcos, 3 fotos' }).click()
  await page.getByRole('combobox').selectOption('square')
  await exportFile('arcos-compartilhar', 'jpeg', 'share')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'docs/screenshots-fase-4/mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await page.screenshot({ path: 'docs/screenshots-fase-4/mobile-export.png' })
} finally { await browser.close() }
