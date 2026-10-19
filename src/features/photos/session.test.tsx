import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DemoResourceProvider,
  useDemoResources,
  usePhotoSession,
} from '../editor/DemoResourceProvider'
import type { PreparedPhoto } from './images'
import assets from '../editor/demo-assets.json'
const mocks = vi.hoisted(() => ({ batch: vi.fn(), demos: vi.fn() }))
vi.mock('./images', () => ({ prepareBatch: mocks.batch }))
vi.mock('../editor/demoResources', () => ({ loadDemoResources: mocks.demos }))
const example = () => ({
  sources: new Map(
    assets.photos.map((p) => [p.id, { image: {} as CanvasImageSource, width: 100, height: 200 }]),
  ),
  metadata: new Map(assets.photos.map((p) => [p.id, { id: p.id, width: 100, height: 200 }])),
  dispose: vi.fn(),
})
const photo = (id: string): PreparedPhoto => ({
  photo: { id, name: id, src: 'blob:' + id, width: 100, height: 200, bytes: 1, demo: false },
  original: new File(['x'], id),
  source: { image: {} as CanvasImageSource, width: 100, height: 200 },
  dispose: vi.fn(),
})
const useSession = () => ({ ...usePhotoSession(), ...useDemoResources() })
beforeEach(() => {
  mocks.demos.mockReset()
  mocks.batch.mockReset()
  mocks.demos.mockImplementation(async () => example())
})
describe('publicação atômica e concorrência da sessão', () => {
  it('StrictMode libera a aquisição descartada e os recursos ativos na desmontagem', async () => {
    const acquired: ReturnType<typeof example>[] = []
    mocks.demos.mockImplementation(async () => {
      const resource = example()
      acquired.push(resource)
      return resource
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <DemoResourceProvider>{children}</DemoResourceProvider>
      </StrictMode>
    )
    const { result, unmount } = renderHook(useSession, { wrapper })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    expect(acquired.length).toBeGreaterThan(0)
    unmount()
    acquired.forEach((resource) => expect(resource.dispose).toHaveBeenCalledTimes(1))
  })
  it('biblioteca e composição não podem mudar durante preparo; falha total preserva histórico', async () => {
    const { result } = renderHook(useSession, { wrapper: DemoResourceProvider })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    act(() =>
      result.current.dispatch({ type: 'edit', edit: { type: 'select-model', modelId: 'mural' } }),
    )
    const before = result.current.editor
    let resolve!: (v: { prepared: PreparedPhoto[]; errors: string[] }) => void
    mocks.batch.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    act(() => {
      result.current.importFiles([new File(['x'], 'bad')])
    })
    act(() => result.current.dispatch({ type: 'remove', photoId: 'demo-1' }))
    act(() =>
      result.current.dispatch({ type: 'edit', edit: { type: 'select-model', modelId: 'lado' } }),
    )
    await act(async () => resolve({ prepared: [], errors: ['inválida'] }))
    expect(result.current.editor).toBe(before)
    expect(result.current.message).toBe('inválida')
  })
  it('menos fotografias que molduras: biblioteca, associações e fontes mudam no mesmo commit', async () => {
    const { result } = renderHook(useSession, { wrapper: DemoResourceProvider })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    const seen: string[][] = [],
      incoming = photo('personal')
    mocks.batch.mockResolvedValue({ prepared: [incoming], errors: ['arquivo inválido'] })
    await act(async () => {
      result.current.importFiles([incoming.original])
      seen.push(result.current.editor.library.map((p) => p.id))
    })
    expect(result.current.editor.library.map((p) => p.id)).toEqual(['personal'])
    expect([...result.current.resources!.metadata.keys()]).toEqual(['personal'])
    expect(
      result.current.editor.composition.placements.slice(1).every((p) => p.photoId === null),
    ).toBe(true)
    expect(result.current.message).toContain('arquivo inválido')
    expect(seen[0]).toHaveLength(8)
  })
  it('cancelamento de lote tardio conserva exatamente a composição e libera recursos', async () => {
    const { result } = renderHook(useSession, { wrapper: DemoResourceProvider })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    const before = result.current.editor,
      incoming = photo('late')
    let resolve!: (v: { prepared: PreparedPhoto[]; errors: string[] }) => void
    mocks.batch.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    act(() => {
      result.current.importFiles([incoming.original])
    })
    expect(result.current.busy).toBe(true)
    act(() => result.current.cancel())
    await act(async () => resolve({ prepared: [incoming], errors: [] }))
    expect(result.current.editor).toBe(before)
    expect(incoming.dispose).toHaveBeenCalledTimes(1)
    expect(result.current.busy).toBe(false)
  })
  it('recomeço invalida o lote e conclusão antiga não substitui nova sessão', async () => {
    const { result } = renderHook(useSession, { wrapper: DemoResourceProvider })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    const incoming = photo('late')
    let resolve!: (v: { prepared: PreparedPhoto[]; errors: string[] }) => void
    mocks.batch.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    act(() => {
      result.current.importFiles([incoming.original])
    })
    await act(async () => result.current.reset())
    const reset = result.current.editor
    await act(async () => resolve({ prepared: [incoming], errors: [] }))
    expect(result.current.editor).toBe(reset)
    expect(result.current.editor.library.every((p) => p.demo)).toBe(true)
    expect(incoming.dispose).toHaveBeenCalledTimes(1)
  })
  it('remoção associada libera só a fotografia removida, desmontagem libera o restante uma vez', async () => {
    const a = photo('a'),
      b = photo('b')
    mocks.batch.mockResolvedValue({ prepared: [a, b], errors: [] })
    const { result, unmount } = renderHook(useSession, { wrapper: DemoResourceProvider })
    await waitFor(() => expect(result.current.resources).not.toBeNull())
    await act(async () => result.current.importFiles([a.original, b.original]))
    act(() => result.current.dispatch({ type: 'remove', photoId: 'a' }))
    expect(result.current.editor.composition.placements[0]!.photoId).toBeNull()
    expect(a.dispose).toHaveBeenCalledTimes(1)
    expect(b.dispose).not.toHaveBeenCalled()
    unmount()
    expect(a.dispose).toHaveBeenCalledTimes(1)
    expect(b.dispose).toHaveBeenCalledTimes(1)
  })
})
