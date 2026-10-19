import { drawNode, initializeContext, type PhotoSource } from '@/core/render/canvas'
import { resolveScene } from '@/core/render/scene'
import type { PhotoMetadata } from '@/core/types'
import { loadPdf } from './load'
import { missingPhotos, outputSize, type ExportRequest } from './settings'

export const exportMeasures = [
  'decode',
  'draw',
  'encode',
  'pdf',
  'pdf-embed',
  'pdf-save',
  'total',
] as const
function measure(stage: (typeof exportMeasures)[number], start: number) {
  performance.measure(`recortes-export-${stage}`, { start, end: performance.now() })
}
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function openOriginal(
  blob: Blob,
  metadata: PhotoMetadata,
  signal: AbortSignal,
): Promise<{ source: PhotoSource; dispose: () => void }> {
  signal.throwIfAborted()
  let bitmap: ImageBitmap | undefined, image: HTMLImageElement | undefined, url: string | undefined
  const dispose = () => {
    bitmap?.close()
    if (image) image.src = ''
    if (url) URL.revokeObjectURL(url)
  }
  try {
    if (typeof createImageBitmap === 'function')
      bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    else {
      image = new Image()
      url = URL.createObjectURL(blob)
      image.src = url
      await image.decode()
    }
    signal.throwIfAborted()
    const width = bitmap?.width ?? image!.naturalWidth,
      height = bitmap?.height ?? image!.naturalHeight
    if (width !== metadata.width || height !== metadata.height)
      throw Error('O original não corresponde às dimensões ou à orientação da fotografia.')
    return { source: { image: bitmap ?? image!, width, height }, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

export function canvasBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: 'image/png' | 'image/jpeg',
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas)
    return canvas.convertToBlob({ type, quality }).then((blob) => {
      if (blob.type !== type) throw Error('O navegador não suporta este formato de arquivo.')
      return blob
    })
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== type)
          reject(Error('Não foi possível gerar este arquivo. Tente o tamanho Compartilhar.'))
        else resolve(blob)
      },
      type,
      quality,
    ),
  )
}

export async function renderExport(
  request: ExportRequest,
  signal: AbortSignal,
  progress: (message: string) => void = () => {},
): Promise<Blob> {
  signal.throwIfAborted()
  const { snapshot, type, size } = request
  if (missingPhotos(snapshot.composition))
    throw Error('Complete as molduras visíveis antes de exportar.')
  for (const stage of exportMeasures) performance.clearMeasures(`recortes-export-${stage}`)
  const totalStart = performance.now()
  const dimensions = outputSize(snapshot.composition, size)
  const scene = resolveScene(snapshot.composition, snapshot.metadata, dimensions)
  const canvas =
    typeof document === 'undefined'
      ? new OffscreenCanvas(dimensions.width, dimensions.height)
      : document.createElement('canvas')
  if ('dataset' in canvas) canvas.dataset.resource = 'export-output'
  let photoIndex = 0
  const count = scene.nodes.filter((node) => node.kind === 'photo').length
  try {
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw Error('Canvas de saída não disponível. Tente o tamanho Compartilhar.')
    initializeContext(context)
    for (const node of scene.nodes) {
      signal.throwIfAborted()
      if (node.kind === 'photo' && node.photoId) {
        progress(`Desenhando fotografia ${++photoIndex} de ${count}…`)
        await yieldTask()
        signal.throwIfAborted()
        const blob = snapshot.originals.get(node.photoId)
        const metadata = snapshot.metadata.get(node.photoId)
        if (!blob || !metadata)
          throw Error('Um original não está mais disponível. Tente novamente.')
        const start = performance.now()
        const opened = await openOriginal(blob, metadata, signal)
        measure('decode', start)
        try {
          signal.throwIfAborted()
          const startDraw = performance.now()
          drawNode(context, node, opened.source)
          measure('draw', startDraw)
        } finally {
          opened.dispose()
        }
      } else {
        const startDraw = performance.now()
        drawNode(context, node)
        measure('draw', startDraw)
      }
    }
    signal.throwIfAborted()
    progress(type === 'pdf' ? 'Preparando a imagem do PDF…' : 'Gerando o arquivo…')
    await yieldTask()
    signal.throwIfAborted()
    const encoding = type === 'pdf' ? (request.pdfImage ?? 'jpeg') : type
    const startEncode = performance.now()
    const blob = await canvasBlob(
      canvas,
      encoding === 'png' ? 'image/png' : 'image/jpeg',
      type === 'pdf' ? 0.96 : 0.95,
    )
    measure('encode', startEncode)
    signal.throwIfAborted()
    // The encoded image now owns the pixels. Release the large canvas before PDF embedding.
    canvas.width = canvas.height = 0
    if (type !== 'pdf') return blob
    progress('Gerando o PDF…')
    await yieldTask()
    signal.throwIfAborted()
    const pdf = await loadPdf()
    signal.throwIfAborted()
    const startPdf = performance.now()
    const result = await pdf.createPdf(blob, snapshot.composition.formatId, encoding, signal)
    measure('pdf', startPdf)
    signal.throwIfAborted()
    return result
  } finally {
    canvas.width = canvas.height = 0
    measure('total', totalStart)
  }
}
