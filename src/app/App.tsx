import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CircleHelp,
  Download,
  Grid2X2,
  Images,
  LockKeyhole,
  Move,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ModelGallery } from '@/features/editor/ModelGallery'
import { ResponsivePanel } from '@/features/editor/ResponsivePanel'
import { Preview } from '@/features/editor/Preview'
import { CropTools, Inspector } from '@/features/editor/Inspector'
import {
  DemoResourceProvider,
  useDemoResources,
  usePhotoSession,
} from '@/features/editor/DemoResourceProvider'
import { EditingDraft } from '@/features/editor/draft'
import { PhotoLibrary } from '@/features/editor/PhotoLibrary'
import { ExportPanel } from '@/features/export/ExportPanel'
import { missingPhotos, defaultExportOptions } from '@/features/export/settings'
import { releaseDownload } from '@/features/export/download'
import { formats } from '@/core/models/formats'
import { models, getModel, type ModelId } from '@/core/models/registry'
import type { FormatId } from '@/core/types'
import { assignmentTarget, type Edit } from '@/core/composition/editor'
import type { FilterId, PanelId, TabId } from '@/features/editor/navigation'

type WindowId = 'help' | 'export' | 'reset'

export function App() {
  return (
    <DemoResourceProvider>
      <EditorApp />
    </DemoResourceProvider>
  )
}
function EditorApp() {
  const {
    editor,
    dispatch,
    busy,
    progress,
    message,
    importFiles,
    cancel,
    reset: resetSession,
  } = usePhotoSession()
  const { resources } = useDemoResources()
  const { composition, library } = editor
  const locked = busy || !resources
  const [draft] = useState(() => new EditingDraft(composition))
  useLayoutEffect(() => {
    draft.sync(composition)
  }, [composition, draft])
  const [selected, setSelected] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [swapFrom, setSwapFrom] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const importFocusGeneration = useRef(0)
  const pendingImportFocus = useRef<{ generation: number; element: HTMLElement | null } | null>(null)
  async function startImport(files: readonly File[]) {
    if (locked || !files.length) return
    const generation = ++importFocusGeneration.current
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pendingImportFocus.current = { generation, element: focus }
    setFeedback('')
    draft.cancel()
    setAdjusting(false)
    setSwapFrom(null)
    await importFiles(files)
  }
  // The import promise can finish before React removes disabled from the frame.
  // Restore focus only after that DOM commit, without overriding a user's new focus.
  useLayoutEffect(() => {
    const pending = pendingImportFocus.current
    if (locked || !pending) return
    pendingImportFocus.current = null
    if (pending.generation !== importFocusGeneration.current || document.activeElement !== document.body) return
    const target = pending.element?.isConnected && !pending.element.matches(':disabled')
      ? pending.element : document.querySelector<HTMLButtonElement>('.tray-buttons .button')
    target?.focus({ preventScroll: true })
  })
  function commit() {
    const edit = draft.commit()
    if (edit) dispatch({ type: 'edit', edit })
  }
  function edit(value: Edit) {
    if (locked) return
    draft.cancel()
    dispatch({ type: 'edit', edit: value })
  }
  const modelId = composition.modelId
  const setModelId = (modelId: ModelId) => {
    setAdjusting(false)
    setSwapFrom(null)
    edit({ type: 'select-model', modelId })
  }
  const setFormat = (formatId: FormatId) => {
    setAdjusting(false)
    setSwapFrom(null)
    edit({ type: 'select-format', formatId })
  }
  const [filter, setFilter] = useState<FilterId>('all')
  const [tab, setTab] = useState<TabId>('paper')
  const [photoId, setPhotoId] = useState<string | null>(null)
  if (photoId && !library.some((p) => p.id === photoId)) setPhotoId(null)
  const [panel, setPanel] = useState<PanelId | null>(null)
  const [windowId, setWindowId] = useState<WindowId | null>(null)
  const [windowOpen, setWindowOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState(defaultExportOptions)
  const exportOperation = useRef<AbortController | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const model = getModel(modelId)
  const target = assignmentTarget(composition, selected)
  const targetIndex = composition.placements.findIndex((p) => p.id === target)
  const selectedIndex = composition.placements.findIndex((p) => p.id === selected)
  const targetOccupied = !!composition.placements[targetIndex]?.photoId
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === 'Escape') {
        draft.cancel()
        setSwapFrom(null)
        setAdjusting(false)
      }
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.matches('input,textarea,select') || event.target.isContentEditable)
      if (
        !typing &&
        !windowOpen &&
        !locked &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault()
        draft.cancel()
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' })
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [dispatch, draft, locked, windowOpen])

  function openWindow(id: WindowId, trigger: HTMLElement) {
    if (id === 'export') {
      commit()
      const missing = missingPhotos(draft.getSnapshot())
      if (missing) {
        setFeedback(`Adicione ${missing} fotografia${missing > 1 ? 's' : ''} para completar a composição.`)
        return
      }
    }
    // Safari does not focus buttons on pointer click; capture the actual trigger.
    returnFocus.current = trigger
    setWindowId(id)
    setWindowOpen(true)
  }
  function openPanel(id: PanelId, trigger: HTMLElement) {
    trigger.focus({ preventScroll: true })
    setPanel(id)
  }
  function reset() {
    exportOperation.current?.abort()
    releaseDownload()
    setExportOptions(defaultExportOptions)
    importFocusGeneration.current++
    draft.cancel()
    resetSession()
    setFilter('all')
    setTab('paper')
    setPhotoId(null)
    setPanel(null)
    setWindowOpen(false)
    setSelected(null)
    setSwapFrom(null)
    setAdjusting(false)
    setFeedback('')
  }
  function selectPhoto(id: string) {
    if (locked) return
    const from = composition.placements.findIndex((p) => p.photoId === id)
    edit({ type: 'assign', placementId: target, photoId: id })
    setSelected(target)
    setPhotoId(id)
    setTab('photo')
    setSwapFrom(null)
    setAdjusting(false)
    setFeedback(
      from >= 0 && from !== targetIndex
        ? `Fotografias trocadas entre as molduras ${targetIndex + 1} e ${from + 1}.`
        : `Fotografia aplicada à moldura ${targetIndex + 1}.`,
    )
  }
  function selectFrame(id: string | null, open: boolean) {
    if (locked) return
    if (swapFrom && id) {
      edit({ type: 'swap', from: swapFrom, to: id })
      setSwapFrom(null)
      setFeedback('Posições trocadas.')
    }
    if (id !== selected) {
      draft.cancel()
      setAdjusting(false)
    }
    setSelected(id)
    if (id) setTab('photo')
    if (open && window.matchMedia('(max-width: 720px)').matches) setPanel('settings')
  }
  function jumpToPhotos() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById('photo-tray')
      ?.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' })
    document.querySelector<HTMLButtonElement>('.thumb')?.focus({ preventScroll: true })
  }

  return (
    <>
      <a className="skip-link" href="#bench">
        Ir para a colagem
      </a>
      <div className="app">
        <header className="header">
          <div className="brand" aria-label="recortes.">
            <span className="brand-icon" aria-hidden="true" />
            <span>
              recortes<b>.</b>
            </span>
          </div>
          <span className="tagline">Colagens com suas fotos</span>
          <div className="header-actions">
            <span className="local">
              <LockKeyhole aria-hidden="true" />
              Fotos só neste navegador
            </span>
            <button
              className="icon-btn"
              type="button"
              aria-label="Como funciona"
              onClick={(event) => openWindow('help', event.currentTarget)}
            >
              <CircleHelp />
            </button>
            <button
              className="icon-btn restart"
              type="button"
              aria-label="Recomeçar"
              onClick={(event) => openWindow('reset', event.currentTarget)}
            >
              <RotateCcw />
            </button>
            <button
              className="button primary"
              type="button"
              onClick={(event) => openWindow('export', event.currentTarget)}
            >
              <Download aria-hidden="true" />
              Exportar
            </button>
          </div>
        </header>
        <div className="intro">
          <div>
            <h1>Montar uma colagem</h1>
            <p>Escolha um modelo, adicione suas fotos e ajuste a composição.</p>
          </div>
          <span className="session">
            {library.every((p) => p.demo) ? 'Fotos de exemplo' : 'Suas fotos nesta sessão'}
          </span>
        </div>
        <main className="workspace">
          <ResponsivePanel
            id="model-rail"
            title="Modelos"
            count={models.length}
            className="model-rail"
            open={panel === 'models'}
            onClose={() => setPanel(null)}
          >
            <ModelGallery
              open={panel === 'models'}
              selected={modelId}
              composition={composition}
              busy={locked}
              filter={filter}
              onFilter={setFilter}
              onSelect={(id) => {
                setModelId(id)
                setPanel(null)
              }}
            />
          </ResponsivePanel>
          <section className="bench" id="bench" aria-label="Sua colagem" tabIndex={-1}>
            <Preview
              target={target}
              composition={composition}
              onFormat={setFormat}
              draft={draft}
              selected={selected}
              adjusting={adjusting}
              busy={locked}
              swapFrom={swapFrom}
              onSelect={selectFrame}
              onCommit={commit}
              onExit={() => {
                setAdjusting(false)
                setSwapFrom(null)
              }}
              onFiles={startImport}
            />
            <div className="adjust-bar" hidden={!adjusting}>
              <CropTools
                draft={draft}
                selected={selected}
                busy={locked}
                onCommit={commit}
                compact
              />
              <button
                className="button small"
                type="button"
                onClick={() => {
                  commit()
                  setAdjusting(false)
                  document
                    .querySelector<HTMLButtonElement>(`[data-placement="${selected}"]`)
                    ?.focus({ preventScroll: true })
                }}
              >
                Concluir
              </button>
            </div>
            <div className="stage-bottom">
              <span className="stage-help">
                <Move aria-hidden="true" />
                <span>
                  {swapFrom
                    ? 'Escolha outra moldura para trocar.'
                    : adjusting
                      ? 'Arraste a fotografia para reenquadrar.'
                      : selected
                        ? selectedIndex < model.frameOrder.length
                          ? `Moldura ${selectedIndex + 1} selecionada.`
                          : 'A moldura selecionada está oculta neste modelo.'
                        : 'Selecione uma moldura para ajustar.'}
                </span>
              </span>
              <div className="history">
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Desfazer ajuste"
                  title="Desfazer · Ctrl+Z"
                  disabled={locked || !editor.past.length}
                  onClick={() => {
                    draft.cancel()
                    dispatch({ type: 'undo' })
                  }}
                >
                  <Undo2 />
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Refazer ajuste"
                  title="Refazer · Ctrl+Shift+Z"
                  disabled={locked || !editor.future.length}
                  onClick={() => {
                    draft.cancel()
                    dispatch({ type: 'redo' })
                  }}
                >
                  <Redo2 />
                </button>
              </div>
            </div>
            <PhotoLibrary
              composition={composition}
              photos={library}
              busy={locked}
              targetIndex={targetIndex}
              targetOccupied={targetOccupied}
              selected={photoId}
              onSelect={selectPhoto}
              onAdd={() => {
                draft.cancel()
                fileInput.current?.click()
              }}
              onRemove={(id) => {
                setFeedback('')
                draft.cancel()
                dispatch({ type: 'remove', photoId: id })
                if (photoId === id) setPhotoId(null)
                setSwapFrom(null)
                setAdjusting(false)
              }}
              onRotate={() => edit({ type: 'rotate' })}
            />
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              tabIndex={-1}
              aria-label="Arquivos de fotografias"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                startImport(files)
              }}
            />
            <div className="operation-status" aria-live="polite" aria-atomic="true">
              {busy ? progress : feedback || message}
            </div>
            {busy ? (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  cancel()
                  document
                    .querySelector<HTMLButtonElement>('.tray-buttons .button')
                    ?.focus({ preventScroll: true })
                }}
              >
                Cancelar processamento
              </button>
            ) : null}
          </section>
          <ResponsivePanel
            id="inspector"
            title="Ajustes"
            className="inspector"
            open={panel === 'settings'}
            onClose={() => setPanel(null)}
          >
            <Inspector
              tab={tab}
              onTab={setTab}
              draft={draft}
              selected={selected}
              busy={locked}
              library={library}
              librarySelected={photoId}
              onCommit={commit}
              onEdit={edit}
              swapFrom={swapFrom}
              onCancelSwap={() => setSwapFrom(null)}
              onSwap={() => {
                setSwapFrom(selected)
                setPanel(null)
                setFeedback('Escolha a outra moldura na colagem.')
              }}
              onChoose={() => {
                setPanel(null)
                jumpToPhotos()
              }}
              onAdjust={() => {
                setAdjusting(true)
                setPanel(null)
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLButtonElement>(`[data-placement="${selected}"]`)
                    ?.focus({ preventScroll: true }),
                )
              }}
              model={model}
            />
          </ResponsivePanel>
        </main>
        <footer className="footer">
          <span>A sessão termina ao fechar esta página.</span>
          <button
            type="button"
            className="text-btn mobile-reset"
            onClick={(event) => openWindow('reset', event.currentTarget)}
          >
            Recomeçar
          </button>
          <span>
            por{' '}
            <a href="https://alemartins.dev.br/" target="_blank" rel="noopener noreferrer">
              alemartins.dev
            </a>
          </span>
        </footer>
      </div>
      <nav className="mobile-tools" aria-label="Ferramentas da colagem">
        <button
          type="button"
          aria-controls="model-rail"
          aria-expanded={panel === 'models'}
          onClick={(event) => openPanel('models', event.currentTarget)}
        >
          <Grid2X2 aria-hidden="true" />
          Modelos
        </button>
        <button type="button" onClick={jumpToPhotos}>
          <Images aria-hidden="true" />
          Fotos
        </button>
        <button
          type="button"
          aria-controls="inspector"
          aria-expanded={panel === 'settings'}
          onClick={(event) => openPanel('settings', event.currentTarget)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Ajustes
        </button>
      </nav>
      <Dialog open={windowOpen} onOpenChange={open => { if (!open) exportOperation.current?.abort(); setWindowOpen(open) }}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus({ preventScroll: true })
          }}
        >
          {windowId === 'help' ? (
            <>
              <DialogTitle>Como funciona</DialogTitle>
              <DialogDescription>
                Escolha um modelo, adicione suas fotos e ajuste a composição.
              </DialogDescription>
              <div className="help-list">
                <div>
                  <strong>Explore as composições</strong>
                  <p>
                    Explore {models.length} modelos em {formats.length} formatos. Use os filtros
                    para encontrar composições discretas, compostas e autorais.
                  </p>
                </div>
                <div>
                  <strong>Conheça os ajustes</strong>
                  <p>
                    Selecione uma moldura e aplique uma foto pela biblioteca. Arraste para
                    reenquadrar; no celular, ative Ajustar enquadramento.
                  </p>
                </div>
                <div>
                  <strong>Leve sua colagem com você</strong>
                  <p>
                    Importe JPEG, PNG ou WebP e personalize a colagem. Tudo fica nesta sessão do
                    navegador. Exporte PNG, JPEG ou PDF de uma página. Abra Exportar enquanto
                    estiver conectado para preparar os recursos de uso offline nesta aba.
                  </p>
                </div>
              </div>
            </>
          ) : null}
          {windowId === 'export' ? (
            <ExportPanel composition={composition} open={windowOpen} onClose={() => setWindowOpen(false)} operationRef={exportOperation} options={exportOptions} onOptionsChange={setExportOptions} />
          ) : null}
          {windowId === 'reset' ? (
            <>
              <DialogTitle>Recomeçar a colagem?</DialogTitle>
              <DialogDescription>
                Suas fotos e ajustes serão retirados desta sessão. Os exemplos iniciais serão
                restaurados.
              </DialogDescription>
              <div className="dialog-actions">
                <DialogClose asChild>
                  <button className="button" type="button">
                    Continuar aqui
                  </button>
                </DialogClose>
                <button className="button primary" type="button" onClick={reset}>
                  Recomeçar
                </button>
              </div>
            </>
          ) : windowId === 'help' ? (
            <div className="dialog-actions">
              <DialogClose asChild>
                <button className="button primary" type="button">
                  {windowId === 'help' ? 'Vamos explorar' : 'Voltar à colagem'}
                </button>
              </DialogClose>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
