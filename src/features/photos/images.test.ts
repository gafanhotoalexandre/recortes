import { describe, expect, it, vi } from 'vitest'
import { prepareBatch, readImageHeader, type PreparedPhoto } from './images'
const png = (width = 300, height = 200) => {
  const a = new Uint8Array(53),
    v = new DataView(a.buffer)
  a.set([137, 80, 78, 71, 13, 10, 26, 10])
  v.setUint32(8, 13)
  a.set([73, 72, 68, 82], 12)
  v.setUint32(16, width)
  v.setUint32(20, height)
  a.set([73, 68, 65, 84], 37)
  return a
}
const fake = (file: File): PreparedPhoto => ({
  photo: {
    id: file.name,
    name: file.name,
    src: 'blob:private',
    demo: false,
    bytes: file.size,
    width: 10,
    height: 20,
  },
  original: file,
  source: { image: {} as CanvasImageSource, width: 10, height: 20 },
  dispose: vi.fn(),
})
describe('validação e posse de recursos', () => {
  it('limites de 15 e 80 MiB impedem decodificação, sem alocar arquivos enormes no teste', async () => {
    const file = new File(['x'], 'grande.jpg')
    Object.defineProperty(file, 'size', { value: 16 * 1024 ** 2 })
    const prepare = vi.fn(async (f: File) => fake(f))
    const tooBig = await prepareBatch([file], [], new AbortController().signal, vi.fn(), prepare)
    expect(tooBig.errors[0]).toContain('15 MiB')
    const small = new File(['x'], 'small.jpg'),
      base = { ...fake(small).photo, bytes: 80 * 1024 ** 2 }
    const tooMany = await prepareBatch(
      [small],
      [base],
      new AbortController().signal,
      vi.fn(),
      prepare,
    )
    expect(tooMany.errors[0]).toContain('80 MiB')
    expect(prepare).not.toHaveBeenCalled()
  })
  it('lê WebP VP8X e rejeita animação e HEIC explicitamente', () => {
    const a = new Uint8Array(30)
    a.set(new TextEncoder().encode('RIFF'), 0)
    a.set(new TextEncoder().encode('WEBPVP8X'), 8)
    a[24] = 99
    a[27] = 49
    expect(readImageHeader(a)).toMatchObject({ width: 100, height: 50, type: 'image/webp' })
    a[20] = 2
    expect(() => readImageHeader(a)).toThrow('animações')
    expect(() => readImageHeader(new TextEncoder().encode('0000ftypheic0000'))).toThrow('HEIC/HEIF')
  })
  it('lê dimensões e rejeita conteúdo arbitrário', () => {
    expect(readImageHeader(png())).toMatchObject({ type: 'image/png', width: 300, height: 200 })
    expect(() => readImageHeader(new TextEncoder().encode('<svg></svg>'))).toThrow(
      'Formato inválido',
    )
  })
  it.each([
    [16001, 1],
    [8000, 4001],
    [0, 20],
  ])('recusa dimensões %s×%s antes do decoder', (w, h) =>
    expect(() => readImageHeader(png(w, h))).toThrow(),
  )
  it('recusa PNG animado e cabeçalho incompleto', () => {
    const a = png()
    a.set([97, 99, 84, 76], 37)
    expect(() => readImageHeader(a)).toThrow('animações')
    expect(() => readImageHeader(png().slice(0, 24))).toThrow('incompleto')
    const truncated = png()
    new DataView(truncated.buffer).setUint32(33, 1000)
    expect(() => readImageHeader(truncated)).toThrow('incompleto')
    // A large IDAT can extend past the bounded prefix, provided it fits in the real file.
    expect(readImageHeader(truncated, 2000)).toMatchObject({ width: 300, height: 200 })
  })
  it('falha parcial conserva ordem e preparação serial', async () => {
    let active = 0,
      peak = 0
    const prepare = vi.fn(async (file: File) => {
      active++
      peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      if (file.name === 'bad') throw Error('inválida')
      return fake(file)
    })
    const result = await prepareBatch(
      ['a', 'bad', 'c'].map((n) => new File(['x'], n)),
      [],
      new AbortController().signal,
      vi.fn(),
      prepare,
    )
    expect(result.prepared.map((p) => p.photo.id)).toEqual(['a', 'c'])
    expect(result.errors).toHaveLength(1)
    expect(peak).toBe(1)
  })
  it('cancelamento libera resultado nativo tardio e não prepara próximo arquivo', async () => {
    const controller = new AbortController(),
      result = fake(new File(['x'], 'a'))
    let resolve!: (p: PreparedPhoto) => void
    const prepare = vi.fn(
      () =>
        new Promise<PreparedPhoto>((r) => {
          resolve = r
        }),
    )
    const task = prepareBatch(
      [result.original, result.original],
      [],
      controller.signal,
      vi.fn(),
      prepare,
    )
    controller.abort()
    resolve(result)
    await expect(task).rejects.toMatchObject({ name: 'AbortError' })
    expect(result.dispose).toHaveBeenCalledTimes(1)
    expect(prepare).toHaveBeenCalledTimes(1)
  })
  it('cancelamento libera fotos já preparadas', async () => {
    const controller = new AbortController(),
      result = fake(new File(['x'], 'a'))
    const prepare = vi.fn(async () => result)
    const task = prepareBatch(
      [result.original],
      [],
      controller.signal,
      () => {
        queueMicrotask(() => controller.abort())
      },
      prepare,
    )
    await expect(task).rejects.toMatchObject({ name: 'AbortError' })
    expect(result.dispose).toHaveBeenCalledTimes(1)
  })
  it('13ª fotografia não chega ao decoder', async () => {
    const prepare = vi.fn(async (f: File) => fake(f))
    const result = await prepareBatch(
      Array.from({ length: 13 }, (_, i) => new File(['x'], String(i))),
      [],
      new AbortController().signal,
      vi.fn(),
      prepare,
    )
    expect(result.prepared).toHaveLength(12)
    expect(prepare).toHaveBeenCalledTimes(12)
    expect(result.errors[0]).toContain('12')
  })
})
