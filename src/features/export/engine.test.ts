import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createComposition } from '@/core/composition/state'
import { resolveScene } from '@/core/render/scene'
import { drawNode } from '@/core/render/canvas'
import { renderExport as exportCollage } from './render'
import type { ExportSnapshot } from './settings'

vi.mock('@/core/render/canvas', () => ({ drawNode: vi.fn(), initializeContext: vi.fn() }))
describe('exportação sequencial da cena', () => {
  let snapshot: ExportSnapshot
  let active: number, peak: number, closed: number
  beforeEach(() => {
    active = peak = closed = 0
    const composition = {
      ...createComposition(Array(12).fill('reutilizada')),
      modelId: 'bilhetes' as const,
    }
    snapshot = {
      composition,
      metadata: new Map([['reutilizada', { id: 'reutilizada', width: 1600, height: 1000 }]]),
      originals: new Map([['reutilizada', new Blob(['original'])]]),
    }
    vi.stubGlobal('performance', {
      now: () => Date.now(),
      measure: vi.fn(),
      clearMeasures: vi.fn(),
    })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        peak = Math.max(peak, ++active)
        return {
          width: 1600,
          height: 1000,
          close: () => {
            active--
            closed++
          },
        }
      }),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    )
    vi.mocked(drawNode).mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  it('mantém a ordem completa de sobreposições, fotos reutilizadas, fitas e textos; só um bitmap vivo', async () => {
    const expected = resolveScene(snapshot.composition, snapshot.metadata, {
      width: 2400,
      height: 3000,
    })
    await exportCollage({ snapshot, type: 'png', size: 'high' }, new AbortController().signal)
    expect(vi.mocked(drawNode).mock.calls.map((call) => call[1].id)).toEqual(
      expected.nodes.map((node) => node.id),
    )
    expect(closed).toBe(5)
    expect(peak).toBe(1)
    expect(active).toBe(0)
  })
  it('libera um decode que termina depois do cancelamento, sem desenhar ou codificar', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        controller.abort()
        return {
          width: 1600,
          height: 1000,
          close: () => {
            closed++
          },
        }
      }),
    )
    await expect(
      exportCollage({ snapshot, type: 'png', size: 'high' }, controller.signal),
    ).rejects.toThrow()
    expect(closed).toBe(1)
    expect(vi.mocked(drawNode).mock.calls.some((call) => call[1].kind === 'photo')).toBe(false)
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled()
  })
  it('falha ao desenhar libera o original e o Canvas; a sessão de entrada continua intacta', async () => {
    const original = JSON.stringify(snapshot.composition)
    vi.mocked(drawNode).mockImplementation((_, node) => {
      if (node.kind === 'photo') throw Error('falha simulada')
    })
    await expect(
      exportCollage({ snapshot, type: 'png', size: 'high' }, new AbortController().signal),
    ).rejects.toThrow('falha simulada')
    expect(active).toBe(0)
    expect(closed).toBe(1)
    expect(JSON.stringify(snapshot.composition)).toBe(original)
  })
  it('falha de codificação não retorna arquivo e libera o Canvas', async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null))
    await expect(
      exportCollage({ snapshot, type: 'png', size: 'high' }, new AbortController().signal),
    ).rejects.toThrow('Compartilhar')
    expect(active).toBe(0)
  })
  it('descarta codificação nativa concluída após cancelamento', async () => {
    const controller = new AbortController()
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => {
      controller.abort()
      callback(new Blob(['encoded'], { type: 'image/png' }))
    })
    await expect(
      exportCollage({ snapshot, type: 'png', size: 'high' }, controller.signal),
    ).rejects.toThrow()
    expect(active).toBe(0)
    const canvas = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock
      .contexts[0] as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([0, 0])
  })
})
