import { PDFDocument } from 'pdf-lib'
import { getFormat } from '@/core/models/formats'
import type { FormatId } from '@/core/types'

export async function createPdf(
  image: Blob,
  format: FormatId,
  encoding: 'png' | 'jpeg',
  signal: AbortSignal,
): Promise<Blob> {
  signal.throwIfAborted()
  const bytes = new Uint8Array(await image.arrayBuffer())
  signal.throwIfAborted()
  const document = await PDFDocument.create()
  document.setCreator('recortes.')
  document.setProducer('recortes. / pdf-lib')
  const size: [number, number] =
    format === 'a4' ? [(210 * 72) / 25.4, (297 * 72) / 25.4] : [720 * getFormat(format).ratio, 720]
  const embedStart = performance.now()
  const embedded =
    encoding === 'png' ? await document.embedPng(bytes) : await document.embedJpg(bytes)
  performance.measure('recortes-export-pdf-embed', { start: embedStart, end: performance.now() })
  signal.throwIfAborted()
  document.addPage(size).drawImage(embedded, { x: 0, y: 0, width: size[0], height: size[1] })
  const saveStart = performance.now()
  const result = await document.save()
  performance.measure('recortes-export-pdf-save', { start: saveStart, end: performance.now() })
  signal.throwIfAborted()
  return new Blob([new Uint8Array(result)], { type: 'application/pdf' })
}
