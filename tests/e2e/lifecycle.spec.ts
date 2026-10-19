import { expect, test } from '@playwright/test'

test('seleção por ponteiro e teclado, enquadramento e reinício sobrevivem aos ciclos de recursos', async ({
  page,
}) => {
  await page.goto('/')
  const preview = page.getByTestId('composition-preview')
  await expect(preview).toHaveAttribute('data-ready', 'true')
  for (const model of ['Bilhetes, 5 fotos', 'Arcos, 3 fotos', 'Janela, 4 fotos']) {
    await page.getByRole('button', { name: `Modelo ${model}` }).click()
    const first = page.locator('.frame-control').first()
    await first.click()
    await expect(first).toHaveClass(/selected/)
    await expect(page.getByRole('tab', { name: 'Foto', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.locator('#zoom')).toBeEnabled()
    await first.press('ArrowLeft')
    await expect(first).toBeFocused()
  }
  await page.reload()
  await expect(preview).toHaveAttribute('data-ready', 'true')
  await page.locator('.frame-control').first().click()
  await expect(page.locator('#zoom')).toBeEnabled()
  await page
    .getByRole('button', { name: 'Recomeçar', exact: true })
    .filter({ visible: true })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recomeçar a colagem?' })).toHaveCount(0)
  await page.locator('.frame-control').first().click()
  await expect(page.locator('#zoom')).toBeEnabled()
})
