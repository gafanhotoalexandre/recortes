import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createComposition } from '@/core/composition/state'
import type { DemoResources } from './demoResources'
import { CanvasSurface } from './CanvasSurface'
import assets from './demo-assets.json'

const state = vi.hoisted(() => ({
  resources: null as DemoResources | null,
  error: null as string | null,
  retry: vi.fn(),
}))
const paint = vi.hoisted(() => vi.fn())
vi.mock('./DemoResourceProvider', () => ({ useDemoResources: () => state }))
vi.mock('@/core/render/canvas', () => ({ renderScene: paint }))

describe('adaptador Canvas', () => {
  let frames: Map<number, FrameRequestCallback>
  let next: number
  let disconnect: ReturnType<typeof vi.fn>
  const context = { setTransform: vi.fn(), drawImage: vi.fn() }
  const flush = () =>
    act(() => {
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach((callback) => callback(0))
    })
  beforeEach(() => {
    frames = new Map()
    next = 0
    disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect
      },
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++next, callback)
      return next
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600)
    state.resources = {
      metadata: new Map(
        assets.photos.map((photo) => [photo.id, { id: photo.id, width: 1200, height: 800 }]),
      ),
      sources: new Map(),
      dispose: vi.fn(),
    }
    state.error = null
    paint.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  function stage(composition = createComposition(assets.order)) {
    return (
      <div style={{ padding: '20px' }}>
        <CanvasSurface composition={composition} />
      </div>
    )
  }
  it('consolida agendamentos, preserva Canvas e não redesenha para props idênticas', () => {
    const composition = createComposition(assets.order)
    const { rerender } = render(stage(composition))
    const canvas = screen.getByTestId('composition-preview')
    expect(frames.size).toBe(1)
    flush()
    expect(canvas).toHaveAttribute('data-model', 'janela')
    expect(paint).toHaveBeenCalledTimes(1)
    rerender(stage(composition))
    flush()
    expect(paint).toHaveBeenCalledTimes(1)
    rerender(stage({ ...composition, modelId: 'arcos' }))
    expect(screen.getByTestId('composition-preview')).toBe(canvas)
    expect(canvas).toHaveAttribute('data-model', 'janela')
    flush()
    expect(canvas).toHaveAttribute('data-model', 'arcos')
    expect(paint).toHaveBeenCalledTimes(2)
  })
  it('desenha apenas a composição mais recente de uma sequência rápida', () => {
    const composition = createComposition(assets.order)
    const { rerender } = render(stage(composition))
    rerender(stage({ ...composition, modelId: 'lado' }))
    rerender(stage({ ...composition, modelId: 'arcos', formatId: 'square' }))
    flush()
    expect(paint).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('composition-preview')).toHaveAttribute('data-model', 'arcos')
    expect(screen.getByTestId('composition-preview')).toHaveAttribute('data-format', 'square')
  })
  it('preserva o último quadro em erro e permite nova tentativa', () => {
    const composition = createComposition(assets.order)
    const { rerender } = render(stage(composition))
    flush()
    paint.mockImplementationOnce(() => {
      throw new Error('draw')
    })
    rerender(stage({ ...composition, modelId: 'bilhetes' }))
    flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível desenhar')
    expect(screen.getByTestId('composition-preview')).toHaveAttribute('data-model', 'janela')
    act(() => screen.getByRole('button', { name: 'Tentar novamente' }).click())
    flush()
    expect(screen.getByTestId('composition-preview')).toHaveAttribute('data-model', 'bilhetes')
  })
  it('aguarda recursos sem desenhar e cancela o frame pendente no cleanup', () => {
    state.resources = null
    const { unmount } = render(stage())
    flush()
    expect(paint).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Preparando')
    unmount()
    expect(frames.size).toBe(0)
    expect(disconnect).toHaveBeenCalled()
  })
})
