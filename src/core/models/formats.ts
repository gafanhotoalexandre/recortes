import type { FormatId } from '../types'

export const formats = [
  { id: 'portrait', name: 'Retrato · 4:5', ratio: 4 / 5, width: 2400, height: 3000 },
  { id: 'square', name: 'Quadrado · 1:1', ratio: 1, width: 2800, height: 2800 },
  { id: 'landscape', name: 'Paisagem · 3:2', ratio: 3 / 2, width: 3000, height: 2000 },
  { id: 'a4', name: 'Folha A4', ratio: 210 / 297, width: 2480, height: 3508 },
] as const

export function getFormat(id: FormatId) {
  return formats.find((format) => format.id === id)!
}
export const categoryNames = {
  discreta: 'Discreta',
  composta: 'Composta',
  autoral: 'Autoral',
} as const
