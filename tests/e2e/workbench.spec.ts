import { test, expect } from '@playwright/test'
import { models } from '../../src/core/models/registry'
import { formats } from '../../src/core/models/formats'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('composition-preview')).toBeVisible()
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
})

test('navega pelas 36 combinações mantendo prévia, biblioteca e foco', async ({ page }) => {
  const image = await page.getByTestId('composition-preview').elementHandle()
  const library = await page.getByTestId('photo-list').elementHandle()
  for (const model of models) {
    await page
      .getByRole('button', {
        name: `Modelo ${model.name}, ${model.frameOrder.length} fotos`,
        exact: true,
      })
      .click()
    for (const format of formats) {
      await page.getByRole('combobox').focus()
      await page.getByRole('combobox').selectOption(format.id)
      await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-model', model.id)
      expect(
        await image!.evaluate(
          (element) => element === document.querySelector('[data-testid=composition-preview]'),
        ),
      ).toBe(true)
      expect(
        await library!.evaluate(
          (element) => element === document.querySelector('[data-testid=photo-list]'),
        ),
      ).toBe(true)
      await expect(page.getByTestId('composition-preview')).toHaveAttribute(
        'data-format',
        format.id,
      )
      await expect(page.getByRole('combobox')).toBeFocused()
      expect(
        await page
          .getByTestId('composition-preview')
          .evaluate((element: HTMLCanvasElement) => element.width > 1 && element.height > 1),
      ).toBe(true)
    }
  }
})

test('abas preservam controles e seleção sem deslocar a bancada', async ({ page }) => {
  await page.getByRole('button', { name: 'Selecionar foto de exemplo: O gato' }).click()
  const image = await page.getByTestId('composition-preview').elementHandle()
  const field = await page.locator('#caption').elementHandle()
  const documentBox = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
  }
  const stageBefore = await page.getByTestId('stage').evaluate(documentBox)
  const trayBefore = await page.getByTestId('photo-list').evaluate(documentBox)
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  await page.getByRole('tab', { name: 'Papel', exact: true }).click()
  await page.getByRole('button', { name: 'Modelo Arcos, 3 fotos' }).click()
  await page.getByRole('combobox').selectOption('landscape')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-model', 'arcos')
  expect(await field!.evaluate((element) => element === document.getElementById('caption'))).toBe(
    true,
  )
  expect(
    await image!.evaluate(
      (element) => element === document.querySelector('[data-testid=composition-preview]'),
    ),
  ).toBe(true)
  await expect(
    page.getByRole('button', { name: 'Selecionar foto de exemplo: O gato' }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(await page.getByTestId('stage').evaluate(documentBox)).toEqual(stageBefore)
  expect(await page.getByTestId('photo-list').evaluate(documentBox)).toEqual(trayBefore)
})

test('diálogo contém o foco e retorna ao acionador', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Como funciona', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Como funciona', exact: true })
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('filtro e abas operam por teclado', async ({ page }) => {
  await page.getByRole('button', { name: 'Autorais', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^Modelo / })).toHaveCount(3)
  await page.getByRole('tab', { name: 'Papel', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Foto', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Foto', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('importação e opções oficiais de exportação estão disponíveis', async ({ page }) => {
  await expect(page.locator('input[type=file]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Exportar colagem' })).toContainText(
    'Escolha o formato e o tamanho',
  )
  await expect(page.getByLabel('Arquivo', { exact: true })).toHaveValue('png')
})

test('mobile: painéis preservam conteúdo, filtro, foco e scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = page.getByRole('navigation', { name: 'Ferramentas da colagem' })
  const trigger = toolbar.getByRole('button', { name: 'Modelos', exact: true })
  const gallery = page.locator('#model-rail')
  const card = await page
    .getByRole('button', { name: 'Modelo Arcos, 3 fotos', includeHidden: true })
    .elementHandle()
  await trigger.click()
  await expect(gallery).toBeVisible()
  expect(await gallery.evaluate((element) => element.matches(':modal'))).toBe(true)
  await page.getByRole('button', { name: 'Autorais', exact: true }).click()
  await gallery.evaluate((element) => {
    element.scrollTop = 90
  })
  const scroll = await gallery.evaluate((element) => element.scrollTop)
  await page.keyboard.press('Escape')
  await expect(gallery).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await trigger.click()
  expect(
    await card!.evaluate(
      (element) => element === document.querySelector('[aria-label="Modelo Arcos, 3 fotos"]'),
    ),
  ).toBe(true)
  expect(await gallery.evaluate((element) => element.scrollTop)).toBe(scroll)
  await expect(page.getByRole('button', { name: 'Autorais', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
  await expect(gallery).not.toBeVisible()
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-model', 'bilhetes')
  await toolbar.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  await page.getByRole('button', { name: 'Fechar ajustes' }).click()
  await toolbar.getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Texto', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('redimensionar com painel aberto mantém conteúdo e libera a página', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click()
  const input = await page.locator('#caption').elementHandle()
  await page.setViewportSize({ width: 860, height: 1000 })
  await expect(page.locator('#inspector')).toBeVisible()
  expect(await page.locator('#inspector').evaluate((element) => element.matches(':modal'))).toBe(
    false,
  )
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  expect(await input!.evaluate((element) => element === document.getElementById('caption'))).toBe(
    true,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#inspector')).not.toBeVisible()
})

for (const width of [320, 390, 720, 721, 860, 1150, 1151, 1440]) {
  test(`layout ${width}px: sem transbordamento e com prévia íntegra`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const paper = await page.locator('.paper').boundingBox()
    const stage = await page.getByTestId('stage').boundingBox()
    expect(paper!.width / paper!.height).toBeCloseTo(0.8, 2)
    expect(paper!.width).toBeGreaterThan(100)
    expect(paper!.width).toBeLessThan(stage!.width)
    expect(paper!.height).toBeLessThan(stage!.height)
    if (width <= 720) await expect(page.getByRole('navigation')).toBeVisible()
    else await expect(page.locator('#model-rail')).toBeVisible()
  })
}

test('não há erros de execução nem requisições externas na jornada', async ({ page }) => {
  const errors: string[] = []
  const external: string[] = []
  const expectedOrigin = new URL(page.url()).origin
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== expectedOrigin) external.push(request.url())
  })
  await page.reload()
  await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
  await page.getByRole('combobox').selectOption('a4')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-model', 'bilhetes')
  await page.getByRole('button', { name: 'Como funciona', exact: true }).click()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('referências visuais da bancada e painéis', async ({ page }) => {
  for (const width of [1440, 860, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page).toHaveScreenshot(`fase-3-bancada-${width}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.002,
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('navigation').getByRole('button', { name: 'Modelos', exact: true }).click()
  await expect(page).toHaveScreenshot('fase-3-mobile-modelos.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.002,
  })
  await page.keyboard.press('Escape')
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click()
  await expect(page).toHaveScreenshot('fase-3-mobile-ajustes.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.002,
  })
})
