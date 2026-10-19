import type { Category } from '@/core/types'

export const filters: readonly { id: FilterId; name: string }[] = [
  { id: 'all', name: 'Todas' },
  { id: 'discreta', name: 'Discretas' },
  { id: 'composta', name: 'Compostas' },
  { id: 'autoral', name: 'Autorais' },
]
export type FilterId = 'all' | Category
export type TabId = 'paper' | 'photo' | 'text'
export type PanelId = 'models' | 'settings'
