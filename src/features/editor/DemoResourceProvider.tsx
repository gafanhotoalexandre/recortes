import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { loadDemoResources, type DemoResources } from './demoResources'
import {
  createEditor,
  editorReducer,
  type EditorAction,
  type LibraryPhoto,
} from '@/core/composition/editor'
import { prepareBatch, type PreparedPhoto } from '../photos/images'
import assets from './demo-assets.json'
const demoLibrary: LibraryPhoto[] = assets.photos.map((p) => ({
  ...p,
  width: 0,
  height: 0,
  bytes: 0,
  demo: true,
}))
interface ResourceState {
  resources: DemoResources | null
  error: string | null
  retry: () => void
}
interface SessionState {
  editor: ReturnType<typeof createEditor>
  dispatch: (action: EditorAction) => void
  busy: boolean
  progress: string
  message: string
  importFiles: (files: readonly File[]) => Promise<void>
  cancel: () => void
  reset: () => void
  prepareOriginals: (signal: AbortSignal) => Promise<ReadonlyMap<string, Blob>>
}
const ResourceContext = createContext<ResourceState | null>(null)
const SessionContext = createContext<SessionState | null>(null)
export function DemoResourceProvider({ children }: { children: ReactNode }) {
  const [editor, dispatch] = useReducer(editorReducer, demoLibrary, createEditor)
  const [resources, setResources] = useState<DemoResources | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [message, setMessage] = useState('')
  const operation = useRef<AbortController | null>(null)
  const handles = useRef(new Map<string, PreparedPhoto>())
  const demos = useRef<DemoResources | null>(null)
  const retiredDemos = useRef<DemoResources[]>([])
  const current = useRef(editor)
  const alive = useRef(false)
  const demoOriginals = useRef(new Map<string, Blob>())
  const captureOriginals = useCallback(() => new Map(current.current.library.map(photo => {
    const source = photo.demo ? photo.src : handles.current.get(photo.id)?.original
    if (!source) throw Error('Um original não está mais disponível.')
    return [photo.id, source] as const
  })), [])
  const prepareOriginals = useCallback(async (signal: AbortSignal) => {
    const sources = captureOriginals()
    const prepared = new Map<string, Blob>()
    // Prepare all library examples so changing models also works offline.
    for (const [id, source] of sources) {
      signal.throwIfAborted()
      if (typeof source !== 'string') { prepared.set(id, source); continue }
      let blob = demoOriginals.current.get(id)
      if (!blob) {
        const response = await fetch(source, { signal })
        if (!response.ok) throw Error('Não foi possível preparar as fotografias de exemplo.')
        blob = await response.blob()
        signal.throwIfAborted()
        demoOriginals.current.set(id, blob)
      }
      prepared.set(id, blob)
    }
    return prepared
  }, [captureOriginals])
  useLayoutEffect(() => {
    current.current = editor
  }, [editor])
  const snapshot = (
    library: readonly LibraryPhoto[],
    demo: DemoResources | null,
  ): DemoResources => ({
    sources: new Map(
      library.map((p) => [
        p.id,
        p.demo ? demo!.sources.get(p.id)! : handles.current.get(p.id)!.source,
      ]),
    ),
    metadata: new Map(library.map((p) => [p.id, p.demo ? demo!.metadata.get(p.id)! : p])),
    dispose: () => {},
  })
  useEffect(() => {
    if (!resources) return
    for (const [id, handle] of handles.current)
      if (!resources.metadata.has(id)) {
        handle.dispose()
        handles.current.delete(id)
      }
    retiredDemos.current.forEach((old) => old.dispose())
    retiredDemos.current = []
  }, [resources])
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    operation.current = controller
    loadDemoResources(controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !alive.current) {
          result.dispose()
          return
        }
        demos.current = result
        dispatch({
          type: 'reset',
          library: demoLibrary.map((p) => ({ ...p, ...result.metadata.get(p.id) })),
        })
        setResources(result)
        setError(null)
        operation.current = null
      })
      .catch(() => {
        if (!controller.signal.aborted && alive.current)
          setError('Não foi possível carregar as fotos de exemplo.')
      })
    const ownedHandles = handles.current
    const ownedDemoOriginals = demoOriginals.current
    return () => {
      alive.current = false
      controller.abort()
      operation.current?.abort()
      operation.current = null
      demos.current?.dispose()
      demos.current = null
      retiredDemos.current.forEach((p) => p.dispose())
      retiredDemos.current = []
      ownedHandles.forEach((h) => h.dispose())
      ownedHandles.clear()
      ownedDemoOriginals.clear()
    }
  }, [attempt])
  function cancel() {
    operation.current?.abort()
    setProgress('Cancelando processamento…')
    setMessage('Operação cancelada. Sua composição foi preservada.')
    // Native decoders may still be running; remain occupied until their cleanup finishes.
  }
  async function importFiles(files: readonly File[]) {
    if (!files.length || busy || operation.current || !resources) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setProgress('Preparando fotografias…')
    setMessage('')
    try {
      const first = current.current.libraryMode === 'demo'
      const base = first ? [] : current.current.library
      const { prepared, errors } = await prepareBatch(
        files,
        base,
        controller.signal,
        (n, total) => {
          if (!controller.signal.aborted) setProgress(`Preparando fotografia ${n} de ${total}…`)
        },
      )
      if (controller.signal.aborted || !alive.current) {
        prepared.forEach((p) => p.dispose())
        return
      }
      if (prepared.length) {
        prepared.forEach((p) => handles.current.set(p.photo.id, p))
        const next = editorReducer(current.current, {
          type: 'import',
          photos: prepared.map((p) => p.photo),
        })
        const nextResources = snapshot(next.library, demos.current)
        // Both React updates are batched; the new associations already have ready resources.
        dispatch({ type: 'import', photos: prepared.map((p) => p.photo) })
        setResources(nextResources)
        if (first && demos.current) {
          retiredDemos.current.push(demos.current)
          demos.current = null
        }
        setMessage(
          `${prepared.length} fotografia${prepared.length > 1 ? 's adicionadas' : ' adicionada'}. Novo histórico iniciado.${errors.length ? ' ' + errors.join(' ') : ''}`,
        )
      } else setMessage(errors.join(' ') || 'Nenhuma fotografia adicionada.')
    } catch (cause) {
      if (!controller.signal.aborted && alive.current)
        setMessage(
          cause instanceof Error ? cause.message : 'Não foi possível preparar as fotografias.',
        )
    } finally {
      if (operation.current === controller) {
        operation.current = null
        if (alive.current) {
          setBusy(false)
          setProgress('')
        }
      }
    }
  }
  async function reset() {
    operation.current?.abort()
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setProgress('Restaurando exemplos…')
    try {
      const result = await loadDemoResources(controller.signal)
      if (controller.signal.aborted || !alive.current) {
        result.dispose()
        return
      }
      if (demos.current) retiredDemos.current.push(demos.current)
      demos.current = result
      dispatch({
        type: 'reset',
        library: demoLibrary.map((p) => ({ ...p, ...result.metadata.get(p.id) })),
      })
      setResources(result)
      setError(null)
      setMessage('Fotos de exemplo restauradas.')
    } catch {
      if (!controller.signal.aborted && alive.current)
        setMessage('Não foi possível restaurar os exemplos. Sua composição foi preservada.')
    } finally {
      if (operation.current === controller) {
        operation.current = null
        if (alive.current) {
          setBusy(false)
          setProgress('')
        }
      }
    }
  }
  function send(action: EditorAction) {
    if (busy || operation.current) return
    if (action.type === 'remove') {
      const next = editorReducer(current.current, action)
      if (next === current.current) return
      dispatch(action)
      setResources(snapshot(next.library, demos.current))
      setMessage(
        'Fotografia removida da biblioteca e de suas associações. Novo histórico iniciado.',
      )
    } else dispatch(action)
  }
  const resourceState = useMemo(
    () => ({ resources, error, retry: () => setAttempt((n) => n + 1) }),
    [resources, error],
  )
  return (
    <SessionContext
      value={{ editor, dispatch: send, busy, progress, message, importFiles, cancel, reset, prepareOriginals }}
    >
      <ResourceContext value={resourceState}>{children}</ResourceContext>
    </SessionContext>
  )
}
export function useDemoResources(): ResourceState {
  const state = useContext(ResourceContext)
  if (!state) throw new Error('DemoResourceProvider ausente')
  return state
}
export function usePhotoSession(): SessionState {
  const state = useContext(SessionContext)
  if (!state) throw new Error('Sessão de fotografias ausente')
  return state
}
