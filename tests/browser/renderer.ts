import { createComposition } from '../../src/core/composition/state'
import { resolveScene } from '../../src/core/render/scene'
import { renderScene } from '../../src/core/render/canvas'
import { loadDemoResources } from '../../src/features/editor/demoResources'
import assets from '../../src/features/editor/demo-assets.json'
import { models } from '../../src/core/models/registry'
import { formats } from '../../src/core/models/formats'
import type { FormatId } from '../../src/core/types'
import type { ModelId } from '../../src/core/models/registry'

const controller = new AbortController()
const resources = await loadDemoResources(controller.signal)
const canvas = document.getElementById('result') as HTMLCanvasElement
declare global {
  interface Window {
    renderFixture: typeof renderFixture
    fixtureModels: typeof models
    fixtureFormats: typeof formats
  }
}
async function renderFixture(
  modelId: ModelId,
  formatId: FormatId,
  width: number,
  height: number,
  thumbnail = false,
) {
  const state = { ...createComposition(assets.order), modelId, formatId }
  if (thumbnail) state.appearance = { ...state.appearance, caption: '', date: '' }
  const scene = resolveScene(state, resources.metadata, { width, height }, { thumbnail })
  canvas.width = width
  canvas.height = height
  const start = performance.now()
  renderScene(canvas.getContext('2d', { alpha: false })!, scene, resources.sources)
  return { duration: performance.now() - start, modelId, formatId, nodeCount: scene.nodes.length }
}
window.renderFixture = renderFixture
window.fixtureModels = models
window.fixtureFormats = formats
window.addEventListener(
  'pagehide',
  () => {
    controller.abort()
    resources.dispose()
  },
  { once: true },
)
