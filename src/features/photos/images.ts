import type { LibraryPhoto } from '@/core/composition/editor'
import type { PhotoSource } from '@/core/render/canvas'

export const limits = {
  count: 12,
  fileBytes: 15 * 1024 ** 2,
  totalBytes: 80 * 1024 ** 2,
  pixels: 32e6,
  side: 16000,
}
export interface ImageHeader {
  width: number
  height: number
  type: 'image/jpeg' | 'image/png' | 'image/webp'
  orientation: number
}
const ascii = (a: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...a.slice(start, start + length))
function dimensions(width: number, height: number) {
  if (!width || !height) throw Error('Não foi possível ler as dimensões da fotografia.')
  if (width * height > limits.pixels || Math.max(width, height) > limits.side)
    throw Error('Limite de 32 megapixels e 16.000 px por lado.')
}
function exif(v: DataView, start: number, end: number): number {
  if (start + 14 > end) return 1
  const little = v.getUint16(start + 6) === 0x4949
  const base = start + 6
  if (v.getUint16(base + 2, little) !== 42) return 1
  const offset = base + v.getUint32(base + 4, little)
  if (offset < base || offset + 2 > end) return 1
  const count = v.getUint16(offset, little)
  for (let i = 0; i < count; i++) {
    const p = offset + 2 + i * 12
    if (p + 12 > end) break
    if (
      v.getUint16(p, little) === 0x112 &&
      v.getUint16(p + 2, little) === 3 &&
      v.getUint32(p + 4, little) === 1
    ) {
      const value = v.getUint16(p + 8, little)
      return value >= 1 && value <= 8 ? value : 1
    }
  }
  return 1
}
export function readImageHeader(a: Uint8Array, fileSize = a.byteLength): ImageHeader {
  const v = new DataView(a.buffer, a.byteOffset, a.byteLength)
  let width = 0,
    height = 0,
    orientation = 1,
    type: ImageHeader['type']
  if (a.length >= 24 && ascii(a, 0, 8) === '\x89PNG\r\n\x1a\n') {
    type = 'image/png'
    if (ascii(a, 12, 4) !== 'IHDR' || v.getUint32(8) !== 13) throw Error('Cabeçalho PNG inválido.')
    width = v.getUint32(16)
    height = v.getUint32(20)
    let foundData = false
    for (let p = 8; p + 8 <= a.length; ) {
      const size = v.getUint32(p),
        chunk = ascii(a, p + 4, 4)
      if (p + size + 12 > fileSize) throw Error('Arquivo PNG incompleto.')
      if (chunk === 'acTL') throw Error('Use uma fotografia estática; animações não são aceitas.')
      if (chunk === 'IDAT') {
        foundData = true
        break
      }
      if (p + size + 12 > a.length) break
      p += size + 12
    }
    if (!foundData) throw Error('Cabeçalho PNG incompleto ou metadados excessivos.')
  } else if (a.length >= 30 && ascii(a, 0, 4) === 'RIFF' && ascii(a, 8, 4) === 'WEBP') {
    type = 'image/webp'
    const chunk = ascii(a, 12, 4)
    if (chunk === 'VP8X') {
      if (a[20]! & 2) throw Error('Use uma fotografia estática; animações não são aceitas.')
      width = 1 + a[24]! + (a[25]! << 8) + (a[26]! << 16)
      height = 1 + a[27]! + (a[28]! << 8) + (a[29]! << 16)
    } else if (chunk === 'VP8 ' && a[23] === 157 && a[24] === 1 && a[25] === 42) {
      width = v.getUint16(26, true) & 16383
      height = v.getUint16(28, true) & 16383
    } else if (chunk === 'VP8L' && a[20] === 47) {
      width = 1 + a[21]! + ((a[22]! & 63) << 8)
      height = 1 + (a[22]! >> 6) + (a[23]! << 2) + ((a[24]! & 15) << 10)
    }
  } else if (a.length >= 4 && a[0] === 255 && a[1] === 216) {
    type = 'image/jpeg'
    for (let p = 2; p + 4 <= a.length; ) {
      if (a[p] !== 255) break
      while (a[p] === 255) p++
      const marker = a[p++]!
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (p + 2 > a.length) break
      const size = v.getUint16(p)
      if (size < 2 || p + size > a.length) break
      if (marker === 0xe1 && ascii(a, p + 2, 6) === 'Exif\0\0')
        orientation = exif(v, p + 2, p + size)
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        size >= 8
      ) {
        height = v.getUint16(p + 3)
        width = v.getUint16(p + 5)
      }
      p += size
    }
  } else {
    if (ascii(a, 4, 4) === 'ftyp')
      throw Error('HEIC/HEIF não está habilitado nesta avaliação. Use JPEG, PNG ou WebP.')
    throw Error('Formato inválido. Use JPEG, PNG ou WebP.')
  }
  dimensions(width, height)
  return { width, height, type, orientation }
}
export interface PreparedPhoto {
  photo: LibraryPhoto
  source: PhotoSource
  original: File
  dispose: () => void
}
export async function preparePhoto(file: File, signal: AbortSignal): Promise<PreparedPhoto> {
  signal.throwIfAborted()
  if (file.size > limits.fileBytes) throw Error('Arquivo acima de 15 MiB.')
  const header = readImageHeader(
    new Uint8Array(await file.slice(0, 1024 ** 2).arrayBuffer()),
    file.size,
  )
  if (header.type === 'image/png') {
    const end = new Uint8Array(await file.slice(-12).arrayBuffer())
    if (
      end.length !== 12 ||
      ascii(end, 4, 4) !== 'IEND' ||
      new DataView(end.buffer).getUint32(0) !== 0
    )
      throw Error('Arquivo PNG incompleto.')
  }
  signal.throwIfAborted()
  let bitmap: ImageBitmap | undefined,
    image: HTMLImageElement | undefined,
    inputUrl: string | undefined
  const preview = document.createElement('canvas'),
    thumb = document.createElement('canvas')
  preview.dataset.resource = 'photo-preview'
  thumb.dataset.resource = 'photo-thumbnail-buffer'
  let thumbUrl: string | undefined,
    retained = false
  try {
    if (typeof createImageBitmap === 'function')
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    else {
      image = new Image()
      inputUrl = URL.createObjectURL(file)
      image.src = inputUrl
      await image.decode()
    }
    signal.throwIfAborted()
    const width = bitmap?.width ?? image!.naturalWidth,
      height = bitmap?.height ?? image!.naturalHeight
    dimensions(width, height)
    const expectedWidth = header.orientation >= 5 ? header.height : header.width
    const expectedHeight = header.orientation >= 5 ? header.width : header.height
    if (width !== expectedWidth || height !== expectedHeight)
      throw Error('Dimensões ou orientação não reconhecidas com segurança.')
    const scale = Math.min(1, 1024 / Math.max(width, height))
    preview.width = Math.max(1, Math.round(width * scale))
    preview.height = Math.max(1, Math.round(height * scale))
    const ctx = preview.getContext('2d')
    if (!ctx) throw Error('Canvas 2D não disponível.')
    ctx.drawImage(bitmap ?? image!, 0, 0, preview.width, preview.height)
    const small = Math.min(1, 256 / Math.max(preview.width, preview.height))
    thumb.width = Math.max(1, Math.round(preview.width * small))
    thumb.height = Math.max(1, Math.round(preview.height * small))
    thumb.getContext('2d')!.drawImage(preview, 0, 0, thumb.width, thumb.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      thumb.toBlob(
        (b) => (b ? resolve(b) : reject(Error('Não foi possível preparar a miniatura.'))),
        header.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
        0.85,
      ),
    )
    signal.throwIfAborted()
    thumbUrl = URL.createObjectURL(blob)
    const photo: LibraryPhoto = {
      id: `photo-${crypto.randomUUID()}`,
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 70) || 'Fotografia',
      src: thumbUrl,
      demo: false,
      bytes: file.size,
      width,
      height,
    }
    let disposed = false
    retained = true
    return {
      photo,
      original: file,
      source: { image: preview, width: preview.width, height: preview.height },
      dispose: () => {
        if (disposed) return
        disposed = true
        preview.width = 0
        preview.height = 0
        URL.revokeObjectURL(photo.src)
      },
    }
  } finally {
    bitmap?.close()
    if (image) image.src = ''
    if (inputUrl) URL.revokeObjectURL(inputUrl)
    thumb.width = 0
    thumb.height = 0
    if (!retained) {
      preview.width = 0
      preview.height = 0
      if (thumbUrl) URL.revokeObjectURL(thumbUrl)
    }
  }
}

export async function prepareBatch(
  files: readonly File[],
  base: readonly LibraryPhoto[],
  signal: AbortSignal,
  progress: (current: number, total: number) => void,
  prepare: typeof preparePhoto = preparePhoto,
): Promise<{ prepared: PreparedPhoto[]; errors: string[] }> {
  const prepared: PreparedPhoto[] = [],
    errors: string[] = []
  let bytes = base.reduce((n, p) => n + p.bytes, 0)
  try {
    for (const [index, file] of files.entries()) {
      signal.throwIfAborted()
      progress(index + 1, files.length)
      if (base.length + prepared.length >= limits.count) {
        errors.push('A biblioteca aceita até 12 fotografias.')
        break
      }
      if (file.size > limits.fileBytes) {
        errors.push(`${file.name}: arquivo acima de 15 MiB.`)
        continue
      }
      if (bytes + file.size > limits.totalBytes) {
        errors.push(`${file.name}: a biblioteca aceita até 80 MiB.`)
        continue
      }
      try {
        const result = await prepare(file, signal)
        // A native decoder may finish after cancellation. Own the result before checking the signal.
        prepared.push(result)
        signal.throwIfAborted()
        bytes += file.size
      } catch (error) {
        signal.throwIfAborted()
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : 'Não foi possível abrir a fotografia.'}`,
        )
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    signal.throwIfAborted()
    return { prepared, errors }
  } catch (error) {
    prepared.forEach((p) => p.dispose())
    throw error
  }
}
