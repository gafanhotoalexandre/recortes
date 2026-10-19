import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

async function openExport(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar colagem' })
  await expect(dialog.locator('.export-status')).toContainText('PNG, JPEG e PDF prontos')
  return dialog
}
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-ready', 'true')
})
test('PNG e JPEG reais: originais, dimensões, nome, prévia e foco estáveis', async ({ page }) => {
  const preview = await page.getByTestId('composition-preview').elementHandle()
  const dialog = await openExport(page)
  await dialog.getByLabel('Nome do arquivo').fill('Férias <em>2026</em>')
  for (const type of ['png', 'jpeg'] as const) {
    await dialog.getByLabel('Arquivo', { exact: true }).selectOption(type)
    await dialog
      .getByLabel('Tamanho', { exact: true })
      .selectOption(type === 'png' ? 'high' : 'share')
    const downloaded = page.waitForEvent('download')
    await dialog
      .getByRole('button', { name: `Baixar ${type === 'png' ? 'PNG' : 'JPEG'}`, exact: true })
      .click()
    const file = await downloaded
    expect(file.suggestedFilename()).toBe(
      `recortes-ferias-em-2026-em.${type === 'png' ? 'png' : 'jpg'}`,
    )
    const bytes = await readFile((await file.path())!)
    if (type === 'png') {
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2400, 3000])
    } else {
      expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8')
      const dimensions = await page.evaluate(async (base64) => {
        const binary = atob(base64)
        const image = await createImageBitmap(
          new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))]),
        )
        const size = [image.width, image.height]
        image.close()
        return size
      }, bytes.toString('base64'))
      expect(dimensions).toEqual([1440, 1800])
    }
    await expect(dialog.locator('.export-status')).toContainText('Download solicitado')
    await expect(dialog.getByRole('button', { name: /^Baixar / })).toBeFocused()
    expect(
      await preview!.evaluate(
        (el) => el === document.querySelector('[data-testid=composition-preview]'),
      ),
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await expect(page.getByLabel('Arquivo', { exact: true })).toHaveValue('jpeg')
  await expect(page.getByLabel('Tamanho', { exact: true })).toHaveValue('share')
  await expect(page.getByLabel('Nome do arquivo')).toHaveValue('Férias <em>2026</em>')
  await page.keyboard.press('Escape')
  await page.locator('.frame-control').first().click()
  await expect(page.locator('#zoom')).toBeEnabled()
})
test('cancelar decode tardio e falhar codificação preservam composição e permitem reiniciar', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Exercise the main-thread fallback, including a non-interruptible native decode.
    Object.defineProperty(window, 'Worker', { value: undefined })
    const native = window.createImageBitmap.bind(window)
    let calls = 0
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const image = await Reflect.apply(native, window, args)
      if (++calls === 1) await new Promise((resolve) => setTimeout(resolve, 600))
      return image
    }) as typeof createImageBitmap
  })
  await page.reload()
  const dialog = await openExport(page)
  const downloaded: string[] = []
  page.on('download', (d) => downloaded.push(d.suggestedFilename()))
  await dialog.getByLabel('Tamanho', { exact: true }).selectOption('share')
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await dialog.getByRole('button', { name: 'Cancelar exportação', exact: true }).click()
  await expect(dialog.locator('.export-status')).toContainText('Exportação cancelada')
  expect(downloaded).toEqual([])
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null)
    }
  })
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Compartilhar')
  expect(downloaded).toEqual([])
  await page.keyboard.press('Escape')
  await page.reload()
  const fresh = await openExport(page)
  const file = page.waitForEvent('download')
  await fresh.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  expect(await (await file).failure()).toBeNull()
})
test('exportação exige apenas molduras visíveis completas', async ({ page }) => {
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  await page.getByRole('button', { name: 'Remover Um café da biblioteca' }).click()
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Exportar colagem' })).toHaveCount(0)
  await expect(page.locator('.operation-status')).toContainText('Adicione 1 fotografia')
  await page.getByRole('button', { name: 'Modelo Lado a lado, 2 fotos' }).click()
  await page
    .getByRole('button', { name: /^Selecionar foto de exemplo/ })
    .nth(1)
    .click()
  await openExport(page)
})

test('fotografias pessoais permanecem locais; PNG, JPEG e PDF A4 funcionam após preparar e desconectar', async ({
  page,
  context,
}) => {
  const requests: { url: string; method: string; body: string | null }[] = []
  page.on('request', (request) =>
    requests.push({ url: request.url(), method: request.method(), body: request.postData() }),
  )
  await page.getByRole('button', { name: 'Modelo Lado a lado, 2 fotos' }).click()
  // Synthetic fixture with real EXIF orientation 6, GPS IFD and description.
  const original = await readFile('tests/fixtures/orientation-6-gps.jpg')
  const comment = Buffer.from('GPS-PRIVATE-CONTENT-EXAMPLE')
  expect(original.includes(Buffer.from('Exif\0\0'))).toBe(true)
  await page
    .locator('input[type=file]')
    .setInputFiles(
      [0, 1].map((i) => ({
        name: `GPS-PRIVATE-${i}.jpg`,
        mimeType: 'image/jpeg',
        buffer: original,
      })),
    )
  await expect(page.getByRole('button', { name: 'Cancelar processamento' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Formato da colagem' }).selectOption('a4')
  await openExport(page)
  await page.keyboard.press('Escape')
  await context.setOffline(true)
  await page.locator('.frame-control').first().click()
  await expect(page.locator('#zoom')).toBeEnabled()
  const dialog = await openExport(page)
  await dialog.getByLabel('Tamanho', { exact: true }).selectOption('share')
  for (const type of ['png', 'jpeg', 'pdf'] as const) {
    await dialog.getByLabel('Arquivo', { exact: true }).selectOption(type)
    const completed = page.waitForEvent('download')
    await dialog
      .getByRole('button', {
        name: `Baixar ${type === 'jpeg' ? 'JPEG' : type.toUpperCase()}`,
        exact: true,
      })
      .click()
    const downloaded = await completed
    const file = await readFile((await downloaded.path())!)
    expect(file.includes(comment)).toBe(false)
    expect(file.includes(Buffer.from('Exif\0\0'))).toBe(false)
    if (type === 'pdf') {
      const pdf = await PDFDocument.load(file)
      expect(pdf.getPageCount()).toBe(1)
      expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.2756, 3)
      expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.8898, 3)
      expect(pdf.getAuthor()).toBeUndefined()
      expect(pdf.getTitle()).toBeUndefined()
    }
  }
  expect(
    requests.every(
      (request) =>
        request.method === 'GET' && !request.body && !request.url.includes('GPS-PRIVATE'),
    ),
  ).toBe(true)
  expect(
    requests
      .filter((request) => request.url.startsWith('http'))
      .every((request) => new URL(request.url).hostname === '127.0.0.1'),
  ).toBe(true)
})

test('Worker cancelado ou com falha é encerrado; novo executor funciona offline sem resultados antigos', async ({
  page,
  context,
}) => {
  const dialog = await openExport(page)
  await dialog.getByLabel('Tamanho', { exact: true }).selectOption('share')
  if (!page.workers().length) {
    test
      .info()
      .annotations.push({
        type: 'executor',
        description:
          'Navegador usou fallback após preflight; cancelamento nativo coberto no teste próprio.',
      })
    await expect(dialog.getByRole('button', { name: 'Baixar PNG', exact: true })).toHaveAttribute(
      'aria-disabled',
      'false',
    )
    return
  }
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await context.setOffline(true)
  for (let iteration = 0; iteration < 3; iteration++) {
    if (iteration) {
      // A new worker is prepared from the already loaded application script.
      await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
      await expect.poll(() => page.workers().length).toBe(1)
      await expect(dialog.locator('.export-status')).toContainText('Download solicitado')
      downloads.length = 0
    }
    await page.workers()[0]!.evaluate(() => {
      const native = self.createImageBitmap
      self.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
        const bitmap = await Reflect.apply(native, self, args)
        await new Promise((resolve) => setTimeout(resolve, 800))
        return bitmap
      }) as typeof createImageBitmap
    })
    await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
    await dialog.getByRole('button', { name: 'Cancelar exportação', exact: true }).click()
    await expect(dialog.locator('.export-status')).toContainText('Exportação cancelada')
    await expect.poll(() => page.workers().length).toBe(0)
    expect(downloads).toEqual([])
  }
  const downloaded = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  expect(await (await downloaded).failure()).toBeNull()
  await expect.poll(() => page.workers().length).toBe(1)
  await page.workers()[0]!.evaluate(() => {
    OffscreenCanvas.prototype.convertToBlob = async () => {
      throw Error('Falha simulada no codificador')
    }
  })
  await expect(dialog.locator('.export-status')).toContainText('Download solicitado')
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Falha simulada')
  await expect.poll(() => page.workers().length).toBe(0)
  const retry = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  expect(await (await retry).failure()).toBeNull()
  await expect(dialog.locator('.export-status')).toContainText('Download solicitado')
  await page.workers()[0]!.evaluate(() => {
    const native = self.createImageBitmap
    self.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      const bitmap = await Reflect.apply(native, self, args)
      await new Promise(resolve => setTimeout(resolve, 800))
      return bitmap
    }) as typeof createImageBitmap
  })
  const completedCount = downloads.length
  await dialog.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect.poll(() => page.workers().length).toBe(0)
  await page.getByRole('button', { name: 'Recomeçar', exact: true }).filter({ visible: true }).click()
  await page.getByRole('dialog', { name: 'Recomeçar a colagem?' }).getByRole('button', { name: 'Recomeçar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Selecionar foto de exemplo/ })).toHaveCount(8)
  await page.waitForTimeout(900)
  expect(downloads).toHaveLength(completedCount)
})

test('headers de produção permitem a edição e a exportação sem violações CSP', async ({ page }) => {
  const response = await page.request.get('/')
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'")
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text())
  })
  await page.reload()
  const dialog = await openExport(page)
  const downloaded = page.waitForEvent('download')
  await dialog.getByLabel('Arquivo', { exact: true }).selectOption('pdf')
  await dialog.getByLabel('Tamanho', { exact: true }).selectOption('share')
  await dialog.getByRole('button', { name: 'Baixar PDF', exact: true }).click()
  await downloaded
  expect(violations).toEqual([])
})

test('desconectar antes da preparação informa o problema e permite tentar novamente sem perder a sessão', async ({
  page,
  context,
}) => {
  await page.getByRole('button', { name: 'Modelo Bilhetes, 5 fotos' }).click()
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Exportar colagem' })
  await expect(dialog).toContainText('Não foi possível preparar a exportação')
  await expect(dialog.getByRole('button', { name: 'Baixar PNG', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await context.setOffline(false)
  await dialog.getByRole('button', { name: 'Tentar carregar novamente' }).click()
  await expect(dialog.locator('.export-status')).toContainText('PNG, JPEG e PDF prontos')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('composition-preview')).toHaveAttribute('data-model', 'bilhetes')
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Modelo Mural, 8 fotos' }).click()
  const allExamples = await openExport(page)
  await allExamples.getByLabel('Tamanho', { exact: true }).selectOption('share')
  const downloaded = page.waitForEvent('download')
  await allExamples.getByRole('button', { name: 'Baixar PNG', exact: true }).click()
  expect(await (await downloaded).failure()).toBeNull()
})
