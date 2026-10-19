import { getModel } from '../models/registry'
import type { Appearance, Crop, PhotoMetadata } from '../types'
import {
  createComposition,
  compositionReducer,
  type CompositionAction,
  type CompositionState,
} from './state'

export interface LibraryPhoto extends PhotoMetadata {
  name: string
  src: string
  demo: boolean
  bytes: number
}
export interface EditorState {
  libraryMode: 'demo' | 'personal'
  library: readonly LibraryPhoto[]
  composition: CompositionState
  past: readonly CompositionState[]
  future: readonly CompositionState[]
}
export function createEditor(library: readonly LibraryPhoto[]): EditorState {
  return {
    libraryMode: library.every((p) => p.demo) ? 'demo' : 'personal',
    library,
    composition: createComposition(library.map((p) => p.id)),
    past: [],
    future: [],
  }
}
export type Edit =
  | Exclude<CompositionAction, { type: 'reset' }>
  | { type: 'appearance'; value: Partial<Appearance> }
  | { type: 'crop'; placementId: string; crop: Crop }
  | { type: 'assign'; placementId: string; photoId: string }
  | { type: 'swap'; from: string; to: string }
  | { type: 'clear'; placementId: string }
  | { type: 'rotate' }
export type EditorAction =
  | { type: 'edit'; edit: Edit }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'import'; photos: readonly LibraryPhoto[] }
  | { type: 'remove'; photoId: string }
  | { type: 'reset'; library: readonly LibraryPhoto[] }

export const initialCrop = (): Crop => ({ centerX: 0.5, centerY: 0.5, zoom: 1 })
export function applyEdit(c: CompositionState, edit: Edit): CompositionState {
  if (edit.type === 'select-model' || edit.type === 'select-format')
    return compositionReducer(c, edit)
  if (edit.type === 'appearance') {
    const appearance = { ...c.appearance, ...edit.value }
    return Object.keys(edit.value).some(
      (k) => appearance[k as keyof Appearance] !== c.appearance[k as keyof Appearance],
    )
      ? { ...c, appearance }
      : c
  }
  const placements = c.placements.slice()
  const swap = (a: number, b: number) => {
    if (a < 0 || b < 0 || a === b) return
    const first = placements[a]!,
      second = placements[b]!
    placements[a] = { ...first, photoId: second.photoId, crop: second.crop }
    placements[b] = { ...second, photoId: first.photoId, crop: first.crop }
  }
  if (edit.type === 'rotate') {
    const count = getModel(c.modelId).frameOrder.length
    const content = placements.slice(0, count)
    for (let i = 0; i < count; i++) {
      const next = content[(i + 1) % count]!
      placements[i] = { ...placements[i]!, photoId: next.photoId, crop: next.crop }
    }
  } else if (edit.type === 'swap') {
    swap(
      placements.findIndex((p) => p.id === edit.from),
      placements.findIndex((p) => p.id === edit.to),
    )
  } else {
    const index = placements.findIndex((p) => p.id === edit.placementId)
    if (index < 0) return c
    const p = placements[index]!
    if (edit.type === 'crop') {
      if (!p.photoId || !Object.values(edit.crop).every(Number.isFinite)) return c
      const crop = {
        centerX: Math.max(0, Math.min(1, edit.crop.centerX)),
        centerY: Math.max(0, Math.min(1, edit.crop.centerY)),
        zoom: Math.max(1, Math.min(3, edit.crop.zoom)),
      }
      placements[index] = { ...p, crop }
    } else if (edit.type === 'clear') {
      if (!p.photoId) return c
      placements[index] = { ...p, photoId: null, crop: initialCrop() }
    } else {
      if (p.photoId === edit.photoId) return c
      const other = placements.findIndex((item) => item.photoId === edit.photoId)
      if (other >= 0) swap(index, other)
      else placements[index] = { ...p, photoId: edit.photoId, crop: initialCrop() }
    }
  }
  if (
    placements.every(
      (p, i) =>
        p.photoId === c.placements[i]!.photoId &&
        p.crop.centerX === c.placements[i]!.crop.centerX &&
        p.crop.centerY === c.placements[i]!.crop.centerY &&
        p.crop.zoom === c.placements[i]!.crop.zoom,
    )
  )
    return c
  return { ...c, placements }
}
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'reset') return createEditor(action.library)
  if (action.type === 'import') {
    if (!action.photos.length) return state
    const first = state.libraryMode === 'demo'
    const library = [...(first ? [] : state.library), ...action.photos]
    // A first import starts with twelve wholly fresh associations, including hidden positions.
    const base = first ? createComposition([]) : state.composition
    const placements = base.placements.map((p) => ({ ...p }))
    for (const photo of action.photos) {
      const index = placements.findIndex((p) => !p.photoId)
      if (index >= 0)
        placements[index] = { ...placements[index]!, photoId: photo.id, crop: initialCrop() }
    }
    const appearance = first
      ? { ...state.composition.appearance, caption: '', date: '' }
      : state.composition.appearance
    return {
      libraryMode: 'personal',
      library,
      composition: { ...state.composition, placements, appearance },
      past: [],
      future: [],
    }
  }
  if (action.type === 'remove') {
    if (!state.library.some((p) => p.id === action.photoId)) return state
    return {
      ...state,
      library: state.library.filter((p) => p.id !== action.photoId),
      composition: {
        ...state.composition,
        placements: state.composition.placements.map((p) =>
          p.photoId === action.photoId ? { ...p, photoId: null, crop: initialCrop() } : p,
        ),
      },
      past: [],
      future: [],
    }
  }
  if (action.type === 'undo') {
    const composition = state.past.at(-1)
    return composition
      ? {
          ...state,
          composition,
          past: state.past.slice(0, -1),
          future: [state.composition, ...state.future],
        }
      : state
  }
  if (action.type === 'redo') {
    const composition = state.future[0]
    return composition
      ? {
          ...state,
          composition,
          past: [...state.past, state.composition].slice(-40),
          future: state.future.slice(1),
        }
      : state
  }
  const edit = action.edit
  if (edit.type === 'assign' && !state.library.some((p) => p.id === edit.photoId)) return state
  const composition = applyEdit(state.composition, edit)
  return composition === state.composition
    ? state
    : { ...state, composition, past: [...state.past, state.composition].slice(-40), future: [] }
}

export function assignmentTarget(c: CompositionState, selectedId: string | null): string {
  const visible = c.placements.slice(0, getModel(c.modelId).frameOrder.length)
  return (visible.find((p) => p.id === selectedId) ??
    visible.find((p) => !p.photoId) ??
    visible[0])!.id
}
