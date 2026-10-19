import { renderExport } from './render'
import { prepareWorker, runWorker } from './workerExecution'
import { loadPdf } from './load'
import type { ExportRequest } from './settings'
export { openOriginal } from './render'

export async function prepareExecution(): Promise<'worker' | 'main'> {
  if (await prepareWorker()) {
    // Vite dev serves a module graph over HTTP; keep its offline fallback ready too.
    if (import.meta.env.DEV) await loadPdf()
    return 'worker'
  }
  await loadPdf()
  return 'main'
}
export async function exportCollage(
  request: ExportRequest,
  signal: AbortSignal,
  progress: (message: string) => void = () => {},
): Promise<Blob> {
  signal.throwIfAborted()
  if (await prepareWorker()) {
    signal.throwIfAborted()
    return runWorker(request, signal, progress)
  }
  signal.throwIfAborted()
  return renderExport(request, signal, progress)
}
