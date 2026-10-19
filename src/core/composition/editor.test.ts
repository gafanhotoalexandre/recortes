import { describe, expect, it } from 'vitest'
import {
  applyEdit,
  assignmentTarget,
  createEditor,
  editorReducer,
  type LibraryPhoto,
} from './editor'
const photos = (n: number, demo = true): LibraryPhoto[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${demo ? 'demo' : 'user'}-${i}`,
    name: 'Foto',
    src: 'blob:test',
    width: 400,
    height: 600,
    demo,
    bytes: 1,
  }))
describe('biblioteca e composição', () => {
  it('biblioteca pessoal vazia não volta ao modo demonstrativo nem apaga texto na próxima importação', () => {
    let s = createEditor(photos(1, false))
    s = editorReducer(s, { type: 'remove', photoId: 'user-0' })
    s = editorReducer(s, {
      type: 'edit',
      edit: { type: 'appearance', value: { caption: 'preservar' } },
    })
    s = editorReducer(s, { type: 'import', photos: photos(1, false) })
    expect(s.libraryMode).toBe('personal')
    expect(s.composition.appearance.caption).toBe('preservar')
  })
  it('primeira importação menor que o modelo elimina IDs e recortes demonstrativos, inclusive ocultos', () => {
    let s = createEditor(photos(8))
    s = editorReducer(s, { type: 'edit', edit: { type: 'select-model', modelId: 'mural' } })
    s = editorReducer(s, {
      type: 'edit',
      edit: {
        type: 'crop',
        placementId: 'position-8',
        crop: { centerX: 0.8, centerY: 0.2, zoom: 3 },
      },
    })
    s = editorReducer(s, { type: 'import', photos: photos(2, false) })
    expect(s.library.map((p) => p.id)).toEqual(['user-0', 'user-1'])
    expect(s.composition.modelId).toBe('mural')
    expect(s.composition.placements.map((p) => p.photoId)).toEqual([
      'user-0',
      'user-1',
      ...Array(10).fill(null),
    ])
    expect(
      s.composition.placements.every(
        (p) => p.crop.zoom === 1 && p.crop.centerX === 0.5 && p.crop.centerY === 0.5,
      ),
    ).toBe(true)
    expect(s.composition.appearance.caption).toBe('')
    expect(s.composition.appearance.date).toBe('')
    expect(s.past).toEqual([])
    expect(s.future).toEqual([])
  })
  it('lote vazio não muda a sessão', () => {
    const s = createEditor(photos(8))
    expect(editorReducer(s, { type: 'import', photos: [] })).toBe(s)
  })
  it('troca com posição oculta leva o recorte e não duplica', () => {
    const c = applyEdit(createEditor(photos(8)).composition, {
      type: 'crop',
      placementId: 'position-8',
      crop: { centerX: 0.8, centerY: 0.6, zoom: 2 },
    })
    const next = applyEdit(c, { type: 'assign', placementId: 'position-1', photoId: 'demo-7' })
    expect(next.placements[0]!.crop.zoom).toBe(2)
    expect(next.placements[7]!.photoId).toBe('demo-0')
    expect(new Set(next.placements.filter((p) => p.photoId).map((p) => p.photoId)).size).toBe(8)
    expect(applyEdit(next, { type: 'assign', placementId: 'position-1', photoId: 'demo-7' })).toBe(
      next,
    )
  })
  it('destino: selecionada, vazia ou primeira quando completo', () => {
    const c = createEditor(photos(2)).composition
    expect(assignmentTarget(c, null)).toBe('position-3')
    expect(assignmentTarget(c, 'position-8')).toBe('position-3')
    expect(assignmentTarget(c, 'position-2')).toBe('position-2')
    expect(assignmentTarget(createEditor(photos(8)).composition, null)).toBe('position-1')
  })
  it('remove associações ocultas e histórico sem alterar as demais', () => {
    let s = createEditor(photos(8, false))
    s = editorReducer(s, { type: 'edit', edit: { type: 'select-model', modelId: 'lado' } })
    s = editorReducer(s, { type: 'remove', photoId: 'user-7' })
    expect(s.composition.placements[7]!.photoId).toBeNull()
    expect(s.composition.placements[0]!.photoId).toBe('user-0')
    expect(s.past).toEqual([])
  })
  it('40 operações, desfazer/refazer, nova edição elimina refazer, no-op preserva referência', () => {
    let s = createEditor(photos(8))
    for (let i = 1; i <= 45; i++)
      s = editorReducer(s, {
        type: 'edit',
        edit: { type: 'appearance', value: { caption: String(i) } },
      })
    expect(s.past).toHaveLength(40)
    s = editorReducer(s, { type: 'undo' })
    expect(s.composition.appearance.caption).toBe('44')
    s = editorReducer(s, { type: 'redo' })
    expect(s.composition.appearance.caption).toBe('45')
    expect(
      editorReducer(s, { type: 'edit', edit: { type: 'appearance', value: { caption: '45' } } }),
    ).toBe(s)
    s = editorReducer(s, { type: 'undo' })
    s = editorReducer(s, { type: 'edit', edit: { type: 'clear', placementId: 'position-1' } })
    expect(s.future).toEqual([])
  })
})
