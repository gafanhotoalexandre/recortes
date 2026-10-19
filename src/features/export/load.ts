let engine: Promise<typeof import('./engine')> | undefined
let pdf: Promise<typeof import('./pdf')> | undefined
export function loadExporter() {
  if (!engine && typeof document !== 'undefined' && !navigator.onLine)
    return Promise.reject(Error('Conecte-se para preparar a exportação nesta aba.'))
  return (engine ??= import('./engine').catch((error) => {
    engine = undefined
    throw error
  }))
}
export function loadPdf() {
  if (!pdf && typeof document !== 'undefined' && !navigator.onLine)
    return Promise.reject(Error('Conecte-se para preparar o PDF nesta aba.'))
  return (pdf ??= import('./pdf').catch((error) => {
    pdf = undefined
    throw error
  }))
}
