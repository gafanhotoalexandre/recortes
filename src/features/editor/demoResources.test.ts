import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDemoResources } from './demoResources'

afterEach(() => vi.restoreAllMocks())
describe('recursos demonstrativos', () => {
  it('compartilha oito fontes e limpa imagens e metadados de forma idempotente', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1200)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(800)
    const resources = await loadDemoResources(new AbortController().signal)
    expect(resources.sources.size).toBe(8)
    expect(resources.metadata.size).toBe(8)
    expect(resources.metadata.get('demo-1')).toMatchObject({ width: 1200, height: 800 })
    resources.dispose()
    resources.dispose()
    expect(resources.sources.size).toBe(0)
    expect(resources.metadata.size).toBe(0)
  })
  it('recusa conclusão antiga após cancelamento, mesmo com decode já em andamento', async () => {
    const pending: (() => void)[] = []
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(
      () => new Promise<void>((resolve) => pending.push(resolve)),
    )
    const src = vi.spyOn(HTMLImageElement.prototype, 'src', 'set')
    const controller = new AbortController()
    const loaded = loadDemoResources(controller.signal)
    const rejection = expect(loaded).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    pending.forEach((resolve) => resolve())
    await rejection
    expect(src.mock.calls.filter(([value]) => value === '')).toHaveLength(8)
  })
})
