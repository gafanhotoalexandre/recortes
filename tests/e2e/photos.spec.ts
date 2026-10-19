import { test, expect, type Page } from '@playwright/test'

async function fixtures(page: Page, count = 2, type = 'image/png') {
  const base64 = await page.evaluate(async (type) => {
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 400
    const ctx = c.getContext('2d')!
    for (const [x, y, color] of [
      [0, 0, '#ee2222'],
      [300, 0, '#22cc22'],
      [0, 200, '#2222ee'],
      [300, 200, '#eeee22'],
    ] as const) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, 300, 200)
    }
    return c.toDataURL(type, 0.95).split(',')[1]!
  }, type)
  return Array.from({ length: count }, (_, i) => ({
    name: `Ensaio ${i + 1}.${type.split('/')[1]}`,
    mimeType: type,
    buffer: Buffer.from(base64, 'base64'),
  }))
}
const ready = async (page: Page) => {
  await page.goto('/')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
}
const imported = async (page: Page, count: number) => {
  await expect(page.getByRole('button', { name: /^Selecionar foto:/ })).toHaveCount(count)
  await expect(page.getByRole('button', { name: 'Cancelar processamento' })).toHaveCount(0)
}
test.beforeEach(async ({ page }) => ready(page))

test('primeira importação atômica: duas fotos para oito molduras, falha parcial, sem quadro vazio', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  const canvas = await page.getByTestId('composition-preview').elementHandle()
  const files = await fixtures(page)
  const addButton = page.getByRole('button', { name: 'Adicionar fotos', exact: true })
  await addButton.focus()
  const sampler = await page.evaluateHandle(() => {
    const state = { active: true, samples: 0, blank: 0 }
    const sample = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid=composition-preview]')!
      const pixel = canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data
      state.samples++
      if (!pixel[3] || (pixel[0] === 0 && pixel[1] === 0 && pixel[2] === 0)) state.blank++
      if (state.active) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    return state
  })
  await page.locator('input[type=file]').setInputFiles([
    ...files,
    {
      name: 'corrompida.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('<svg>inválido</svg>'),
    },
  ])
  await imported(page, 2)
  await expect(addButton).toBeFocused()
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Moldura \d+, vazia/ })).toHaveCount(6)
  await expect(page.getByRole('button', { name: /^Moldura \d+, com fotografia/ })).toHaveCount(2)
  await expect(page.locator('.operation-status')).toContainText('corrompida.jpg')
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  await expect(page.locator('#caption')).toHaveValue('')
  await expect(page.locator('#date')).toHaveValue('')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector('[data-testid=composition-preview]'),
    ),
  ).toBe(true)
  await expect(page.getByRole('button', { name: 'Desfazer ajuste' })).toBeDisabled()
  const sampled = await sampler.evaluate((state) => {
    state.active = false
    return { samples: state.samples, blank: state.blank }
  })
  expect(sampled.samples).toBeGreaterThan(1)
  expect(sampled.blank).toBe(0)
  for (const name of [
    'Modelo Arcos, 3 fotos',
    'Modelo Bilhetes, 5 fotos',
    'Modelo Fotogramas, 6 fotos',
  ]) {
    await page.getByRole('button', { name }).click()
    await page.getByRole('combobox').selectOption('landscape')
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
})
test('destino previsível, troca oculta, moldura vazia e remoção associada', async ({ page }) => {
  await expect(page.locator('.assignment-hint')).toContainText('moldura 1')
  await page.getByRole('button', { name: 'Selecionar foto de exemplo: O gato' }).click()
  await expect(page.locator('[data-placement=position-1]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.operation-status')).toContainText('molduras 1 e 2')
  await page.locator('[data-placement=position-1]').focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Retirar da colagem' }).click()
  await expect(page.locator('[data-placement=position-1]')).toHaveAccessibleName(/vazia/)
  await page.getByRole('button', { name: 'Selecionar foto de exemplo: Cores' }).click()
  await expect(page.locator('.operation-status')).toContainText('molduras 1 e 8')
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  await expect(page.locator('[data-placement=position-8]')).toHaveAccessibleName(/vazia/)
  await page.getByRole('button', { name: 'Remover Cores da biblioteca' }).click()
  await expect(page.locator('[data-placement=position-1]')).toHaveAccessibleName(/vazia/)
  await expect(page.getByRole('button', { name: 'Desfazer ajuste' })).toBeDisabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
test('arraste inclinado não atualiza galeria; um desfazer restaura; Escape cancela', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
  const frame = page.locator('[data-placement=position-1]')
  await frame.focus()
  await page.keyboard.press('Enter')
  await page.locator('#zoom').fill('2')
  await page.locator('#zoom').dispatchEvent('pointerup')
  await expect(page.locator('#zoom')).toHaveValue('2')
  const box = (await frame.boundingBox())!,
    x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.waitForTimeout(80)
  const before = await page
    .getByTestId('composition-preview')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL())
  const counts = await page
    .locator('.model-thumbnail canvas')
    .evaluateAll((cs) => cs.map((c) => (c as HTMLElement).dataset.renderCount))
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 30, y + 20, { steps: 8 })
  await page.waitForTimeout(80)
  expect(
    await page
      .locator('.model-thumbnail canvas')
      .evaluateAll((cs) => cs.map((c) => (c as HTMLElement).dataset.renderCount)),
  ).toEqual(counts)
  expect(
    await page.getByTestId('composition-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()),
  ).not.toBe(before)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Desfazer ajuste' }).click()
  await expect
    .poll(() =>
      page.getByTestId('composition-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    )
    .toBe(before)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 40, y - 10, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect
    .poll(() =>
      page.getByTestId('composition-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    )
    .toBe(before)
})
test('texto mantém foco/caret, histórico agrupado e escolhas de capacidades preservadas', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  const caption = page.locator('#caption'),
    handle = await caption.elementHandle()
  await caption.fill('')
  await caption.pressSequentially('nossa viagem')
  await expect(caption).toBeFocused()
  await expect(caption).toHaveValue('nossa viagem')
  await caption.press('Tab')
  await page.getByRole('button', { name: 'Desfazer ajuste' }).click()
  await expect(caption).toHaveValue('um dia desses')
  await page.getByRole('button', { name: 'Refazer ajuste' }).click()
  await expect(caption).toHaveValue('nossa viagem')
  await page.getByRole('tab', { name: 'Papel', exact: true }).click()
  await page.getByRole('button', { name: 'Redondos', exact: true }).click()
  await page.getByRole('button', { name: 'Modelo Arcos, 3 fotos' }).click()
  await expect(page.getByRole('button', { name: 'Redondos', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Modelo Janela, 4 fotos' }).click()
  await expect(page.getByRole('button', { name: 'Redondos', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(await handle!.evaluate((el) => el === document.getElementById('caption'))).toBe(true)
})
test('cancelar decoder tardio e recomeçar não publicam lote antigo', async ({ page }) => {
  await page.evaluate(() => {
    const decode = window.createImageBitmap.bind(window)
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const bitmap = await Reflect.apply(decode, window, args)
      await new Promise((r) => setTimeout(r, 650))
      return bitmap
    }) as typeof createImageBitmap
  })
  const files = await fixtures(page)
  await page.locator('input[type=file]').setInputFiles(files)
  await page.getByRole('button', { name: 'Cancelar processamento' }).click()
  await expect(page.getByRole('button', { name: 'Cancelar processamento' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(8)
  await page.locator('input[type=file]').setInputFiles(files)
  await page.getByRole('button', { name: 'Cancelar processamento' }).waitFor()
  await page.getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await page.waitForTimeout(850)
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(8)
  await expect(page.getByRole('button', { name: /^Selecionar foto:/ })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
test('JPEG com oito orientações EXIF é normalizado uma vez', async ({ page }) => {
  const [base] = await fixtures(page, 1, 'image/jpeg')
  const files = Array.from({ length: 8 }, (_, i) => {
    const exif = Buffer.alloc(36)
    exif[0] = 255
    exif[1] = 225
    exif.writeUInt16BE(34, 2)
    exif.write('Exif\0\0', 4, 'binary')
    exif.write('II', 10)
    exif.writeUInt16LE(42, 12)
    exif.writeUInt32LE(8, 14)
    exif.writeUInt16LE(1, 18)
    exif.writeUInt16LE(0x112, 20)
    exif.writeUInt16LE(3, 22)
    exif.writeUInt32LE(1, 24)
    exif.writeUInt16LE(i + 1, 28)
    return {
      name: `Orientação ${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      buffer: Buffer.concat([base!.buffer.subarray(0, 2), exif, base!.buffer.subarray(2)]),
    }
  })
  await page.locator('input[type=file]').setInputFiles(files)
  await imported(page, 8)
  const colors = await page.locator('.photo-list .thumb img').evaluateAll(async (images) =>
    Promise.all(
      images.map(async (element) => {
        const image = element as HTMLImageElement
        await image.decode()
        const c = document.createElement('canvas')
        c.width = image.naturalWidth
        c.height = image.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(image, 0, 0)
        return {
          ratio: c.width / c.height,
          rgb: [...ctx.getImageData(5, 5, 1, 1).data].slice(0, 3),
        }
      }),
    ),
  )
  const expected = [
    [238, 34, 34],
    [34, 204, 34],
    [238, 238, 34],
    [34, 34, 238],
    [238, 34, 34],
    [34, 34, 238],
    [238, 238, 34],
    [34, 204, 34],
  ]
  for (const [i, color] of colors.entries()) {
    expect(color.ratio).toBeCloseTo(i < 4 ? 1.5 : 2 / 3, 1)
    color.rgb.forEach((v, k) => expect(Math.abs(v - expected[i]![k]!)).toBeLessThan(25))
  }
})
test('limite 12 e arquivo excessivo preservam a biblioteca', async ({ page }) => {
  await page.locator('input[type=file]').setInputFiles(await fixtures(page, 13))
  await imported(page, 12)
  await expect(page.locator('.operation-status')).toContainText('até 12')
  const before = await page
    .getByTestId('composition-preview')
    .evaluate((c: HTMLCanvasElement) => c.toDataURL())
  await page.locator('input[type=file]').setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(16 * 1024 ** 2),
  })
  await expect(page.locator('.operation-status')).toContainText('12')
  await expect
    .poll(() =>
      page.getByTestId('composition-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    )
    .toBe(before)
})
test('mobile: modo Ajustar tem zoom e Concluir, mantém Canvas e devolve foco', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const canvas = await page.getByTestId('composition-preview').elementHandle()
  await page.locator('[data-placement=position-1]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#inspector')).toBeVisible()
  await page.getByRole('button', { name: 'Ajustar enquadramento', exact: true }).click()
  await expect(page.locator('#inspector')).not.toBeVisible()
  await expect(page.locator('.adjust-bar')).toBeVisible()
  await expect(page.locator('.frames .selected')).toHaveCSS('touch-action', 'none')
  await page.locator('#compact-zoom').fill('1.8')
  await page.locator('#compact-zoom').dispatchEvent('pointerup')
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await expect(page.locator('.adjust-bar')).not.toBeVisible()
  await expect(page.locator('[data-placement=position-1]')).toBeFocused()
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector('[data-testid=composition-preview]'),
    ),
  ).toBe(true)
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
})

test('recursos: URLs e bitmaps liberados em remoção, recomeço e cancelamento', async ({ page }) => {
  await page.evaluate(() => {
    const counts = { opened: 0, closed: 0, delay: 0 }
    Object.assign(window, { __photoBitmapCounts: counts })
    const decode = window.createImageBitmap.bind(window)
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const bitmap = await Reflect.apply(decode, window, args)
      counts.opened++
      const close = bitmap.close.bind(bitmap)
      let closed = false
      bitmap.close = () => {
        if (!closed) {
          closed = true
          counts.closed++
        }
        close()
      }
      if (counts.delay) await new Promise((resolve) => setTimeout(resolve, counts.delay))
      return bitmap
    }) as typeof createImageBitmap
    const active = new Set<string>(),
      create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL)
    Object.assign(window, { __photoUrls: active })
    URL.createObjectURL = (object) => {
      const url = create(object)
      active.add(url)
      return url
    }
    URL.revokeObjectURL = (url) => {
      active.delete(url)
      revoke(url)
    }
  })
  const active = () =>
    page.evaluate(() => (window as unknown as { __photoUrls: Set<string> }).__photoUrls.size)
  await page.locator('input[type=file]').setInputFiles(await fixtures(page, 2))
  await imported(page, 2)
  expect(await active()).toBe(2)
  await page.getByRole('button', { name: 'Remover Ensaio 1 da biblioteca' }).click()
  await expect.poll(active).toBe(1)
  await page.getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await expect.poll(active).toBe(0)
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(8)
  await page.evaluate(() => {
    ;(window as unknown as { __photoBitmapCounts: { delay: number } }).__photoBitmapCounts.delay =
      400
  })
  await page.locator('input[type=file]').setInputFiles(await fixtures(page, 2))
  await page.getByRole('button', { name: 'Cancelar processamento' }).click()
  await expect(page.getByRole('button', { name: 'Cancelar processamento' })).toHaveCount(0)
  await expect.poll(active).toBe(0)
  const bitmaps = await page.evaluate(
    () =>
      (window as unknown as { __photoBitmapCounts: { opened: number; closed: number } })
        .__photoBitmapCounts,
  )
  expect(bitmaps.opened).toBeGreaterThanOrEqual(2)
  expect(bitmaps.closed).toBe(bitmaps.opened)
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(8)
})

test('miniaturas atualizam somente modelos afetados e ignoram texto e formato', async ({
  page,
}) => {
  await expect(page.locator('.model-thumbnail canvas[data-ready=true]')).toHaveCount(9)
  const counts = () =>
    page
      .locator('.model-thumbnail canvas')
      .evaluateAll((cs) => cs.map((c) => Number((c as HTMLElement).dataset.renderCount)))
  const before = await counts()
  await page.getByRole('tab', { name: 'Texto', exact: true }).click()
  await page.locator('#caption').fill('um novo texto')
  await page.locator('#caption').press('Tab')
  await page.getByRole('combobox').selectOption('square')
  await page.waitForTimeout(180)
  expect(await counts()).toEqual(before)
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  await page.locator('[data-placement=position-8]').focus()
  await page.keyboard.press('Enter')
  await page.locator('#zoom').fill('2')
  await page.locator('#zoom').dispatchEvent('pointerup')
  await expect.poll(async () => (await counts())[4]).toBe(before[4]! + 1)
  const after = await counts()
  expect(after.filter((v, i) => v !== before[i])).toHaveLength(1)
  await page.getByRole('button', { name: 'Modelo Lado a lado, 2 fotos' }).click()
  await expect(page.locator('.stage-help')).toContainText('oculta neste modelo')
  await expect(page.locator('.assignment-hint')).toContainText('moldura 1')
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  await expect(page.locator('[data-placement=position-8]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#zoom')).toHaveValue('2')
})

test('clique ignora canto fora da máscara de arco e seleciona sua região visível', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Modelo Arcos, 3 fotos' }).click()
  const frame = page.locator('[data-placement=position-1]'),
    box = (await frame.boundingBox())!
  await page.mouse.click(box.x + 1, box.y + 1)
  await expect(frame).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(frame).toHaveAttribute('aria-pressed', 'true')
  await expect(frame).toBeFocused()
})

test('celular: toque nativo seleciona e abre os ajustes', async ({ browser, browserName }) => {
  test.skip(
    browserName === 'firefox',
    'Playwright não oferece contexto hasTouch no Firefox; os outros testes cobrem layout e controles nesse engine.',
  )
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    await ready(page)
    const frame = page.locator('[data-placement=position-1]'),
      box = (await frame.boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('#inspector')).toBeVisible()
    await expect(frame).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Ajustar enquadramento', exact: true }).click()
    await expect(page.locator('.adjust-bar')).toBeVisible()
    await expect(page.locator('#compact-zoom')).toBeEnabled()
  } finally {
    await context.close()
  }
})

test('toque emulado: rolagem normal, arraste explícito e cancelamento de dois dedos', async ({
  browser,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Sequência nativa de múltiplos toques usa CDP; não substitui validação em aparelho físico.',
  )
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    await ready(page)
    const session = await context.newCDPSession(page)
    const frame = page.locator('[data-placement=position-1]')
    let box = (await frame.boundingBox())!,
      x = box.x + box.width / 2,
      y = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    for (let i = 1; i <= 5; i++)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - i * 15, id: 1 }],
      })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(5)
    await expect(page.locator('#inspector')).not.toBeVisible()
    await page.evaluate(() => scrollTo(0, 0))
    box = (await frame.boundingBox())!
    x = box.x + box.width / 2
    y = box.y + box.height / 2
    await page.touchscreen.tap(x, y)
    await page.getByRole('button', { name: 'Ajustar enquadramento', exact: true }).click()
    await page.locator('#compact-zoom').fill('2')
    await page.locator('#compact-zoom').dispatchEvent('pointerup')
    const before = await page
      .getByTestId('composition-preview')
      .evaluate((c: HTMLCanvasElement) => c.toDataURL())
    const scroll = await page.evaluate(() => scrollY)
    box = (await frame.boundingBox())!
    x = box.x + box.width / 2
    y = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 25, y: y + 15, id: 1 }],
    })
    await page.waitForTimeout(50)
    expect(
      await page
        .getByTestId('composition-preview')
        .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    ).not.toBe(before)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: x + 25, y: y + 15, id: 1 },
        { x: x + 45, y: y + 15, id: 2 },
      ],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect
      .poll(() =>
        page.getByTestId('composition-preview').evaluate((c: HTMLCanvasElement) => c.toDataURL()),
      )
      .toBe(before)
    expect(await page.evaluate(() => scrollY)).toBe(scroll)
  } finally {
    await context.close()
  }
})

test('JPEG, PNG e WebP pelo conteúdo; dimensões excessivas, arquivo grande e corrupção são recusados', async ({
  page,
}) => {
  const [jpeg] = await fixtures(page, 1, 'image/jpeg'),
    [png] = await fixtures(page, 1),
    [webp] = await fixtures(page, 1, 'image/webp')
  const huge = Buffer.from(png!.buffer)
  huge.writeUInt32BE(8000, 16)
  huge.writeUInt32BE(4001, 20)
  await page.locator('input[type=file]').setInputFiles([
    { ...jpeg!, name: 'JPEG.jpg' },
    { ...png!, name: 'PNG.nome-incorreto', mimeType: 'application/octet-stream' },
    { ...webp!, name: 'WEBP.webp' },
    { name: 'dimensoes.png', mimeType: 'image/png', buffer: huge },
    { name: 'tamanho.png', mimeType: 'image/png', buffer: Buffer.alloc(16 * 1024 ** 2) },
    { name: 'corrompido.png', mimeType: 'image/png', buffer: png!.buffer.subarray(0, 45) },
  ])
  await imported(page, 3)
  await expect(page.locator('.operation-status')).toContainText('32 megapixels')
  await expect(page.locator('.operation-status')).toContainText('15 MiB')
  await expect(page.locator('.operation-status')).toContainText('corrompido.png')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(
    await page
      .locator('.photo-list img')
      .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0)),
  ).toBe(true)
})

test('soltar arquivos encerra o ajuste e restaura foco sem recriar a bancada', async ({ page }) => {
  const [file] = await fixtures(page, 1)
  const transfer = await page.evaluateHandle(
    ({ data, name, type }) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(data)], name, { type }))
      return transfer
    },
    { data: [...file!.buffer], name: file!.name, type: file!.mimeType },
  )
  const frame = page.locator('[data-placement=position-1]')
  await frame.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Ajustar enquadramento', exact: true }).click()
  await expect(frame).toBeFocused()
  const canvas = await page.getByTestId('composition-preview').elementHandle()
  await page.getByTestId('stage').dispatchEvent('drop', { dataTransfer: transfer })
  await transfer.dispose()
  await imported(page, 1)
  await expect(page.locator('.adjust-bar')).not.toBeVisible()
  await expect(frame).toBeFocused()
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector('[data-testid=composition-preview]'),
    ),
  ).toBe(true)
})
