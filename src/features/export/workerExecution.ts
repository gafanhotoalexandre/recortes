import type { ExportRequest } from './settings'
import workerAsset from './export.worker?worker&url'

export type WorkerRequest =
  | { type: 'probe'; metrics: readonly number[] }
  | { type: 'run'; id: number; request: ExportRequest }
export type WorkerReply =
  | { type: 'ready'; compatible: boolean }
  | { type: 'progress'; id: number; message: string }
  | { type: 'result'; id: number; blob: Blob; measures: readonly { name: string; duration: number }[] }
  | { type: 'error'; id: number; message: string }

let script: Promise<Blob> | undefined
let instance: Worker | undefined
let scriptUrl: string | undefined
let preparing: Promise<boolean> | undefined
let unsupported = false
let nextId = 0
let busy = false

function releaseWorker() {
  instance?.terminate()
  instance = undefined
  if (scriptUrl) URL.revokeObjectURL(scriptUrl)
  scriptUrl = undefined
  preparing = undefined
  busy = false
}
export async function prepareWorker(): Promise<boolean> {
  if (import.meta.env.DEV && !navigator.onLine && !instance) return false
  if (
    unsupported ||
    typeof Worker === 'undefined' ||
    typeof OffscreenCanvas === 'undefined' ||
    typeof createImageBitmap !== 'function'
  )
    return false
  if (preparing) return preparing
  preparing = (async () => {
    try {
      // Only application code is cached; photographs live exclusively within their job.
      script ??= fetch(workerAsset)
        .then((response) => {
          if (!response.ok) throw Error('Não foi possível carregar o executor.')
          return response.blob()
        })
        .catch((error) => {
          script = undefined
          throw error
        })
      const blob = await script
      scriptUrl = import.meta.env.DEV
        ? undefined
        : URL.createObjectURL(new Blob([blob], { type: 'application/javascript' }))
      const worker = new Worker(scriptUrl ?? workerAsset, { type: 'module' })
      instance = worker
      const canvas = document.createElement('canvas'),
        context = canvas.getContext('2d')!
      const metrics = ['italic 27px Georgia', '19px Arial'].map((font) => {
        context.font = font
        return context.measureText('recortes. café, ação 012345').width
      })
      canvas.width = canvas.height = 0
      const compatible = await new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('O executor não respondeu.')), 10_000)
        worker.onerror = () => {
          clearTimeout(timeout)
          reject(Error('Executor indisponível.'))
        }
        worker.onmessage = (event: MessageEvent<WorkerReply>) => {
          if (event.data.type !== 'ready') return
          clearTimeout(timeout)
          resolve(event.data.compatible)
        }
        worker.postMessage({ type: 'probe', metrics } satisfies WorkerRequest)
      })
      if (!compatible) {
        unsupported = true
        releaseWorker()
        return false
      }
      return true
    } catch {
      releaseWorker()
      return false
    }
  })()
  return preparing
}

export function runWorker(
  request: ExportRequest,
  signal: AbortSignal,
  progress: (message: string) => void,
): Promise<Blob> {
  signal.throwIfAborted()
  const worker = instance
  if (!worker) return Promise.reject(Error('O executor não está disponível. Tente novamente.'))
  if (busy) return Promise.reject(Error('Uma exportação já está em andamento.'))
  busy = true
  const id = ++nextId
  for (const stage of ['decode', 'draw', 'encode', 'pdf', 'pdf-embed', 'pdf-save', 'total'])
    performance.clearMeasures(`recortes-export-${stage}`)
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      busy = false
      signal.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
    }
    const abort = () => {
      cleanup()
      releaseWorker()
      reject(new DOMException('Operação cancelada', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    worker.onerror = () => {
      cleanup()
      releaseWorker()
      reject(
        Error('Não foi possível concluir a exportação. Tente novamente ou escolha Compartilhar.'),
      )
    }
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const data = event.data
      if (!('id' in data) || data.id !== id || signal.aborted) return
      if (data.type === 'progress') progress(data.message)
      else if (data.type === 'result') {
        cleanup()
        for (const entry of data.measures)
          performance.measure(entry.name, { start: 0, duration: entry.duration })
        resolve(data.blob)
      } else if (data.type === 'error') {
        cleanup()
        releaseWorker()
        reject(Error(data.message))
      }
    }
    try {
      worker.postMessage({ type: 'run', id, request } satisfies WorkerRequest)
    } catch (error) {
      cleanup()
      releaseWorker()
      reject(error)
    }
  })
}
