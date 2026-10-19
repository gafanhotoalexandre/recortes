import { test, expect } from '@playwright/test'

test('ações de navegação não redesenham a composição nem recriam miniaturas', async ({ page }) => {
  const referenceRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/references/')) referenceRequests.push(request.url())
  })
  await page.goto('/')
  const canvas = page.getByTestId('composition-preview')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('.model-thumbnail canvas[data-ready=true]')).toHaveCount(9)
  const counts = await page
    .locator('canvas')
    .evaluateAll((elements) => elements.map((element) => element.dataset.renderCount))
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  await page.getByRole('tab', { name: 'Papel', exact: true }).click()
  await page.getByRole('button', { name: 'Selecionar foto de exemplo: O gato' }).focus()
  await page.getByRole('button', { name: 'Autorais', exact: true }).click()
  await page.getByRole('button', { name: 'Todas', exact: true }).click()
  await page.getByRole('button', { name: 'Como funciona' }).click()
  await page.keyboard.press('Escape')
  expect(
    await page
      .locator('canvas')
      .evaluateAll((elements) => elements.map((element) => element.dataset.renderCount)),
  ).toEqual(counts)
  expect(referenceRequests).toEqual([])
})

for (const dpr of [1, 2])
  test(`Canvas com DPR ${dpr}: resolução e continuidade`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: dpr,
      reducedMotion: 'reduce',
    })
    try {
      const page = await context.newPage()
      await page.goto('/')
      const canvas = page.getByTestId('composition-preview')
      await expect(canvas).toHaveAttribute('data-ready', 'true')
      const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({
        width: element.width,
        height: element.height,
        css: element.getBoundingClientRect().height,
      }))
      expect(dimensions.height).toBeLessThanOrEqual(1600)
      expect(
        Math.abs(dimensions.height - Math.min(dimensions.css * dpr, 1600)),
      ).toBeLessThanOrEqual(1)
      const handle = await canvas.elementHandle()
      const sampler = await page.evaluateHandle(() => {
        const data = { stopped: false, samples: 0, blank: 0 }
        const sample = () => {
          const element = document.querySelector(
            '[data-testid=composition-preview]',
          ) as HTMLCanvasElement
          if (element?.dataset.ready === 'true') {
            const pixel = element.getContext('2d')!.getImageData(0, 0, 1, 1).data
            data.samples++
            if (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0) data.blank++
          }
          if (!data.stopped) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        return data
      })
      for (const model of ['Bilhetes, 5', 'Arcos, 3', 'Fotogramas, 6', 'Postal, 3']) {
        await page.getByRole('button', { name: `Modelo ${model} fotos` }).click()
        await page.getByRole('combobox').selectOption('landscape')
        await expect(canvas).toHaveAttribute('data-format', 'landscape')
      }
      await expect(canvas).toHaveAttribute('data-model', 'postal')
      const sampled = await sampler.evaluate((data) => {
        data.stopped = true
        return { samples: data.samples, blank: data.blank }
      })
      expect(sampled.samples).toBeGreaterThan(2)
      expect(sampled.blank).toBe(0)
      expect(
        await handle!.evaluate(
          (element) => element === document.querySelector('[data-testid=composition-preview]'),
        ),
      ).toBe(true)
    } finally {
      await context.close()
    }
  })

test('Canvas permanece montado ao cruzar breakpoints com painéis abertos', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 1000 })
  await page.goto('/')
  const canvas = page.getByTestId('composition-preview')
  await expect(canvas).toHaveAttribute('data-ready', 'true')
  const handle = await canvas.elementHandle()
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click()
  for (const width of [721, 1150, 1151, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(canvas).toHaveAttribute('data-ready', 'true')
    expect(
      await handle!.evaluate(
        (element) => element === document.querySelector('[data-testid=composition-preview]'),
      ),
    ).toBe(true)
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  }
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }),
  ).toBeFocused()
})

test('falha de recursos apresenta nova tentativa e recupera o Canvas', async ({ page }) => {
  let fail = true
  await page.route('**/demos/photo-1.jpg', (route) => {
    if (fail) {
      fail = false
      return route.abort()
    }
    return route.continue()
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText(
    'Não foi possível carregar as fotos de exemplo.',
  )
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('dialog fecha com conteúdo preservado durante a saída e desmonta em seguida', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Como funciona' }).click()
  const dialog = page.getByRole('dialog', { name: 'Como funciona' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  const closing = page.locator('.dialog-content[data-state=closed]')
  await expect(closing).toContainText('Explore as composições')
  await expect(dialog).not.toBeAttached()
  await expect(page.getByRole('button', { name: 'Como funciona' })).toBeFocused()
})
