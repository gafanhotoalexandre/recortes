import { describe, expect, it } from 'vitest'
import { createComposition } from '@/core/composition/state'
import { formats } from '@/core/models/formats'
import { lowResolutionFrames, missingPhotos, outputName, outputSize } from './settings'

describe('contrato dos arquivos exportados', () => {
  for (const format of formats)
    it(`preserva alta e proporção de compartilhar: ${format.id}`, () => {
      const state = { ...createComposition([]), formatId: format.id }
      expect(outputSize(state, 'high')).toEqual({ width: format.width, height: format.height })
      const small = outputSize(state, 'share')
      expect(Math.max(small.width, small.height)).toBe(1800)
      expect(Math.abs(small.width / small.height - format.ratio)).toBeLessThan(0.001)
    })
  it('nome opcional usa prefixo e extensão controlada, nunca caminho', () => {
    expect(outputName('../../Férias <script>.pdf', '', 'jpeg')).toBe(
      'recortes-ferias-script-pdf.jpg',
    )
    expect(outputName('', 'um café', 'png')).toBe('recortes-um-cafe.png')
    expect(outputName('❤️', '', 'pdf')).toBe('recortes-minha-colagem.pdf')
    expect(outputName('a'.repeat(90), '', 'png')).toBe(`recortes-${'a'.repeat(55)}.png`)
  })
  it('somente molduras visíveis precisam de fotografias', () => {
    const state = { ...createComposition(['a', 'b']), modelId: 'lado' as const }
    expect(missingPhotos(state)).toBe(0)
    expect(missingPhotos({ ...state, modelId: 'mural' })).toBe(6)
  })
  it('aviso usa o recorte real e considera tamanho, margem e zoom', () => {
    const state = { ...createComposition(['a', 'b']), modelId: 'lado' as const }
    const metadata = new Map(['a', 'b'].map((id) => [id, { id, width: 1500, height: 1800 }]))
    expect(lowResolutionFrames(state, metadata, 'share')).toEqual([])
    const zoomed = {
      ...state,
      placements: state.placements.map((p) => ({ ...p, crop: { ...p.crop, zoom: 3 } })),
    }
    expect(lowResolutionFrames(zoomed, metadata, 'high')).toEqual([1, 2])
  })
})
