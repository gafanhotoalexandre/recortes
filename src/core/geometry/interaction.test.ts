import { describe, expect, it } from 'vitest'
import { inversePoint, panCrop, visibleCrop, zoomCrop } from './interaction'
import { rotation, sourceCrop } from './resolve'
import { EditingDraft } from '@/features/editor/draft'
import { createComposition } from '../composition/state'
describe('enquadramento independente da moldura', () => {
  it('transformação inversa respeita rotação e translação', () => {
    const m = rotation(Math.PI / 6, 230, 170),
      x = 80,
      y = -40
    const p = inversePoint(m, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
    expect(p.x).toBeCloseTo(x)
    expect(p.y).toBeCloseTo(y)
    expect(() => inversePoint([0, 0, 0, 0, 0, 0], 1, 1)).toThrow()
  })
  it('primeiro deslocamento parte do centro visível, sem zona morta após adaptar formato', () => {
    const photo = { width: 1200, height: 600 },
      frame = { width: 300, height: 400 },
      crop = { centerX: 0.99, centerY: 0.01, zoom: 1 }
    const before = visibleCrop(photo, frame, crop)
    const after = panCrop(photo, frame, crop, 1, 0)
    expect(after.centerX).toBeLessThan(before.centerX)
    expect(before.centerX - after.centerX).toBeCloseTo(1 / 800)
    expect(crop.centerX).toBe(0.99)
  })
  it('zoom ancora centro visível, limita extremos e não revela vazio', () => {
    const photo = { width: 1200, height: 600 },
      frame = { width: 300, height: 400 }
    const crop = zoomCrop(photo, frame, { centerX: 0.7, centerY: 0.5, zoom: 1 }, 2)
    expect(crop.centerX).toBe(0.7)
    const p = panCrop(photo, frame, crop, 1e6, -1e6),
      source = sourceCrop(photo, frame, p)
    expect(source.x).toBe(0)
    expect(source.y + source.height).toBeCloseTo(1)
    expect(zoomCrop(photo, frame, crop, 99).zoom).toBe(3)
  })
  it('muitos rascunhos viram uma operação; cancelar restaura valores canônicos exatos', () => {
    const composition = createComposition(['a']),
      draft = new EditingDraft(composition)
    for (let i = 1; i < 30; i++)
      draft.change({
        type: 'crop',
        placementId: 'position-1',
        crop: { centerX: i / 30, centerY: 0.5, zoom: 2 },
      })
    const edit = draft.commit()
    expect(edit?.type).toBe('crop')
    expect(draft.commit()).toBeNull()
    draft.sync(composition)
    draft.change({
      type: 'crop',
      placementId: 'position-1',
      crop: { centerX: 0.8, centerY: 0.2, zoom: 3 },
    })
    draft.cancel()
    expect(draft.getSnapshot()).toBe(composition)
  })
})
