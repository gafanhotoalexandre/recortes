/// <reference lib="webworker" />
import { renderExport } from './render'
import { loadPdf } from './load'
import type { WorkerRequest } from './workerExecution'
declare const self: DedicatedWorkerGlobalScope

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const data = event.data
  if (data.type === 'probe') {
    const metrics = data.metrics
    let compatible: boolean
    try {
      const canvas = new OffscreenCanvas(16, 16),
        context = canvas.getContext('2d')!
      const fonts = ['italic 27px Georgia', '19px Arial']
      compatible =
        typeof Path2D === 'function' &&
        typeof createImageBitmap === 'function' &&
        fonts.every((font, index) => {
          context.font = font
          return (
            Math.abs(context.measureText('recortes. café, ação 012345').width - (metrics[index] ?? NaN)) <
            0.01
          )
        })
      context.fillStyle = '#fff'
      context.fillRect(0, 0, 16, 16)
      const png = await canvas.convertToBlob({ type: 'image/png' })
      const jpeg = await canvas.convertToBlob({ type: 'image/jpeg' })
      compatible &&= png.type === 'image/png' && jpeg.type === 'image/jpeg'
      const bitmap = await createImageBitmap(png)
      bitmap.close()
      canvas.width = canvas.height = 0
      if (compatible) await loadPdf()
    } catch {
      compatible = false
    }
    self.postMessage({ type: 'ready', compatible })
    return
  }
  if (data.type !== 'run') return
  const { id, request } = data
  try {
    const blob = await renderExport(request, new AbortController().signal, (message) =>
      self.postMessage({ type: 'progress', id, message }),
    )
    const measures = performance
      .getEntriesByType('measure')
      .filter((entry) => entry.name.startsWith('recortes-export-'))
      .map((entry) => ({ name: entry.name, duration: entry.duration }))
    self.postMessage({ type: 'result', id, blob, measures })
  } catch (cause) {
    self.postMessage({
      type: 'error',
      id,
      message: cause instanceof Error ? cause.message : 'Não foi possível gerar o arquivo.',
    })
  }
}
