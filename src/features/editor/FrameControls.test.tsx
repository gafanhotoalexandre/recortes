import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createComposition } from '@/core/composition/state'
import { FrameControls } from './FrameControls'
import { EditingDraft } from './draft'

vi.mock('./DemoResourceProvider', () => ({
  useDemoResources: () => ({ resources: { metadata: new Map() } }),
  usePhotoSession: () => ({ editor: { library: [] } }),
}))

it('StrictMode libera o Canvas de cada setup e mantém o novo recurso operacional', () => {
  const canvases: HTMLCanvasElement[] = []
  const native = document.createElement.bind(document)
  const create = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const element = native(tag, options)
    if (element instanceof HTMLCanvasElement) canvases.push(element)
    return element
  })
  const composition = createComposition([])
  try {
    const view = render(<StrictMode><FrameControls composition={composition} draft={new EditingDraft(composition)} selected={null} adjusting={false} busy={false} swapFrom={null} target="position-1" onSelect={vi.fn()} onCommit={vi.fn()} onExit={vi.fn()} /></StrictMode>)
    expect(canvases).toHaveLength(2)
    expect(canvases.map(canvas => [canvas.width, canvas.height])).toEqual([[0, 0], [1, 1]])
    view.unmount()
    expect(canvases.every(canvas => canvas.width === 0 && canvas.height === 0)).toBe(true)
  } finally { create.mockRestore() }
})
