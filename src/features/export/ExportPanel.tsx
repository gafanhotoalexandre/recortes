import { useEffect, useRef, useState, type RefObject } from 'react'
import { Download } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CanvasSurface } from '@/features/editor/CanvasSurface'
import { useDemoResources, usePhotoSession } from '@/features/editor/DemoResourceProvider'
import type { CompositionState } from '@/core/composition/state'
import { getFormat } from '@/core/models/formats'
import { getModel } from '@/core/models/registry'
import { loadExporter } from './load'
import { releaseDownload, retainDownload, scheduleDownloadRelease } from './download'
import {
  lowResolutionFrames,
  outputName,
  outputSize,
  type ExportSize,
  type ExportSnapshot,
  type ExportType,
  type ExportOptions,
} from './settings'

interface Props {
  composition: CompositionState
  open: boolean
  onClose: () => void
  operationRef: RefObject<AbortController | null>
  options: ExportOptions
  onOptionsChange: (options: ExportOptions) => void
}
export function ExportPanel({ composition, open, onClose, operationRef, options, onOptionsChange }: Props) {
  const { prepareOriginals } = usePhotoSession()
  const { resources } = useDemoResources()
  const { type, size, name } = options
  const setType = (type: ExportType) => onOptionsChange({ ...options, type })
  const setSize = (size: ExportSize) => onOptionsChange({ ...options, size })
  const setName = (name: string) => onOptionsChange({ ...options, name })
  const [ready, setReady] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [preparationError, setPreparationError] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null)
  const snapshot = useRef<ExportSnapshot | null>(null)
  const alive = useRef(false)
  const dimensions = outputSize(composition, size)
  const filename = outputName(name, composition.appearance.caption, type)
  const low = resources ? lowResolutionFrames(composition, resources.metadata, size) : []
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      operationRef.current?.abort()
      snapshot.current = null
      scheduleDownloadRelease()
    }
  }, [operationRef])
  useEffect(() => {
    if (!open || !resources) return
    const controller = new AbortController()
    const visible = composition.placements.slice(0, getModel(composition.modelId).frameOrder.length)
    const ids = [...new Set(visible.flatMap((p) => (p.photoId ? [p.photoId] : [])))]
    void (async () => {
      setReady(false)
      setPdfReady(false)
      setPreparationError('')
      setPdfError('')
      setError('')
      setStatus('Preparando os recursos de exportação…')
      setDownload(null)
      try {
        await loadExporter()
        const sources = await prepareOriginals(controller.signal)
        const originals = new Map<string, Blob>()
        for (const id of ids) {
          controller.signal.throwIfAborted()
          const source = sources.get(id)
          if (!source) throw Error('Um original não está mais disponível.')
          originals.set(id, source)
        }
        controller.signal.throwIfAborted()
        snapshot.current = {
          composition,
          originals,
          metadata: new Map(ids.map((id) => [id, resources.metadata.get(id)!])),
        }
        setReady(true)
        setStatus('PNG e JPEG prontos para uso sem internet nesta aba. Preparando PDF…')
      } catch {
        if (!controller.signal.aborted)
          setPreparationError(
            'Não foi possível preparar a exportação. Verifique sua conexão e tente novamente.',
          )
      }
    })()
    void loadExporter()
      .then((module) => module.prepareExecution())
      .then(() => {
        if (!controller.signal.aborted) setPdfReady(true)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPdfError(
            'O recurso de PDF não foi carregado. PNG e JPEG continuam disponíveis após a preparação.',
          )
      })
    return () => {
      controller.abort()
      operationRef.current?.abort()
      snapshot.current = null
      scheduleDownloadRelease()
    }
  }, [open, composition, resources, prepareOriginals, attempt, operationRef])
  function cancel() {
    if (!operationRef.current) return
    operationRef.current?.abort()
    setStatus('Cancelando exportação…')
  }
  function close() {
    operationRef.current?.abort()
    onClose()
  }
  async function start() {
    if (running || !ready || (type === 'pdf' && !pdfReady) || operationRef.current || !snapshot.current) return
    const controller = new AbortController()
    operationRef.current = controller
    releaseDownload()
    setDownload(null)
    setError('')
    setRunning(true)
    setStatus('Preparando a colagem…')
    const captured = snapshot.current
    const currentName = filename
    try {
      const exporter = await loadExporter()
      controller.signal.throwIfAborted()
      const blob = await exporter.exportCollage(
        { snapshot: captured, type, size },
        controller.signal,
        (message) => {
          if (!controller.signal.aborted && alive.current) setStatus(message)
        },
      )
      controller.signal.throwIfAborted()
      if (!alive.current) return
      const url = retainDownload(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = currentName
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setDownload({ url, name: currentName })
      setStatus('Arquivo preparado. Download solicitado ao navegador.')
    } catch (cause) {
      if (alive.current) {
        if (controller.signal.aborted)
          setStatus('Exportação cancelada. Sua composição foi preservada.')
        else {
          setStatus('')
          setError(
            cause instanceof Error
              ? cause.message
              : 'Não foi possível gerar o arquivo. Tente novamente ou escolha Compartilhar.',
          )
        }
      }
    } finally {
      if (operationRef.current === controller) {
        operationRef.current = null
        if (alive.current) setRunning(false)
      }
    }
  }
  return (
    <>
      <DialogTitle>Exportar colagem</DialogTitle>
      <DialogDescription>Escolha o formato e o tamanho do arquivo.</DialogDescription>
      <div className="export-preview">
        <CanvasSurface composition={composition} mode="summary" active={open} />
        <div>
          <strong>{getModel(composition.modelId).name}</strong>
          <small>{getFormat(composition.formatId).name}</small>
        </div>
      </div>
      {low.length > 0 && (
        <p className="export-warning">
          {low.length === 1
            ? `A fotografia da moldura ${low[0]} é pequena`
            : `As fotografias das molduras ${low.join(', ')} são pequenas`}{' '}
          para este tamanho. O arquivo será gerado, mas pode perder nitidez na impressão.
        </p>
      )}
      <fieldset className="export-fields" disabled={running}>
        <div>
          <label className="label" htmlFor="filename">
            Nome do arquivo <small>opcional</small>
          </label>
          <input
            className="field"
            id="filename"
            maxLength={60}
            placeholder="meus-bons-dias"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="hint filename-hint">{filename}</p>
        </div>
        <div className="export-options">
          <div>
            <label className="label" htmlFor="export-type">
              Arquivo
            </label>
            <select
              className="select"
              id="export-type"
              value={type}
              onChange={(event) => setType(event.target.value as ExportType)}
            >
              <option value="png">PNG · sem perdas</option>
              <option value="jpeg">JPEG · mais leve</option>
              <option value="pdf">PDF · para imprimir</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="export-size">
              Tamanho
            </label>
            <select
              className="select"
              id="export-size"
              value={size}
              onChange={(event) => setSize(event.target.value as ExportSize)}
            >
              <option value="high">Alta resolução</option>
              <option value="share">Compartilhar</option>
            </select>
          </div>
        </div>
      </fieldset>
      <p className="export-dimensions">
        {dimensions.width.toLocaleString('pt-BR')} × {dimensions.height.toLocaleString('pt-BR')} px
        {type === 'pdf'
          ? composition.formatId === 'a4'
            ? ' · A4, 210 × 297 mm'
            : ' · uma página na proporção da colagem'
          : ''}
      </p>
      <p className="export-status" role="status" aria-live="polite">
        {ready && pdfReady && status.startsWith('PNG e JPEG prontos')
          ? 'PNG, JPEG e PDF prontos para uso sem internet nesta aba.'
          : status}
      </p>
      {(preparationError || pdfError) && (
        <p className="export-warning">
          {preparationError || pdfError}{' '}
          <button
            type="button"
            className="text-btn"
            disabled={running}
            onClick={() => setAttempt((n) => n + 1)}
          >
            Tentar carregar novamente
          </button>
        </p>
      )}
      {error && (
        <p className="export-warning" role="alert">
          {error}
        </p>
      )}
      {download && (
        <p className="hint">
          <a href={download.url} download={download.name}>
            Baixar o arquivo novamente
          </a>
        </p>
      )}
      <div className="dialog-actions">
        <button className="button" type="button" onClick={running ? cancel : close}>
          {running ? 'Cancelar exportação' : 'Voltar à colagem'}
        </button>
        <button
          className="button primary"
          type="button"
          aria-disabled={running || !ready || (type === 'pdf' && !pdfReady)}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            void start()
          }}
        >
          <Download aria-hidden="true" />
          {running ? 'Preparando…' : `Baixar ${type === 'jpeg' ? 'JPEG' : type.toUpperCase()}`}
        </button>
      </div>
      <p className="hint export-local">Gerado aqui no navegador. Sem marca-d’água na imagem.</p>
    </>
  )
}
