import type { Appearance, Crop, FormatId } from '../types'
import type { ModelId } from '../models/registry'

export interface Placement {
  id: string
  photoId: string | null
  crop: Crop
}
export interface CompositionState {
  modelId: ModelId
  formatId: FormatId
  appearance: Appearance
  placements: readonly Placement[]
}
export const defaultAppearance: Appearance = {
  paperColor: '#fffaf4',
  margin: 0,
  corner: 2,
  border: false,
  caption: 'um dia desses',
  date: 'outubro de 2026',
  font: 'serif',
}
export function createComposition(photoIds: readonly string[]): CompositionState {
  return {
    modelId: 'janela',
    formatId: 'portrait',
    appearance: { ...defaultAppearance },
    placements: Array.from({ length: 12 }, (_, index) => ({
      id: `position-${index + 1}`,
      photoId: photoIds[index] ?? null,
      crop: { centerX: 0.5, centerY: 0.5, zoom: 1 },
    })),
  }
}
export type CompositionAction =
  | { type: 'select-model'; modelId: ModelId }
  | { type: 'select-format'; formatId: FormatId }
  | { type: 'reset'; photoIds: readonly string[] }
export function compositionReducer(
  state: CompositionState,
  action: CompositionAction,
): CompositionState {
  switch (action.type) {
    case 'select-model':
      return state.modelId === action.modelId ? state : { ...state, modelId: action.modelId }
    case 'select-format':
      return state.formatId === action.formatId ? state : { ...state, formatId: action.formatId }
    case 'reset':
      return createComposition(action.photoIds)
  }
}
