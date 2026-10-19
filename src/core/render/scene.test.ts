import { describe, expect, it } from 'vitest'
import { resolveScene } from './scene'
import { createComposition } from '../composition/state'
import { models } from '../models/registry'
import { formats } from '../models/formats'

describe('cena compartilhada', () => {
  const ids = Array.from({ length: 8 }, (_, i) => `photo-${i}`)
  const photos = new Map(ids.map((id) => [id, { id, width: 1200, height: 800 }]))
  for (const model of models)
    for (const format of formats)
      it(`${model.id}/${format.id}: cena serializável e ordem fotográfica`, () => {
        const state = { ...createComposition(ids), modelId: model.id, formatId: format.id }
        const before = JSON.stringify(state)
        const scene = resolveScene(state, photos, { width: format.width, height: format.height })
        expect(structuredClone(scene)).toEqual(scene)
        expect(() => JSON.stringify(scene)).not.toThrow()
        expect(scene.nodes.filter((node) => node.kind === 'photo').map((node) => node.id)).toEqual(
          model.frameOrder,
        )
        expect(scene.nodes.at(-1)!.id).toBe('date')
        expect(JSON.stringify(state)).toBe(before)
        expect(new Set(scene.nodes.map((node) => node.id)).size).toBe(scene.nodes.length)
      })
  it('mantém a fita depois de sua foto e a decoração de fundo antes das fotos', () => {
    const scene = resolveScene({ ...createComposition(ids), modelId: 'bilhetes' }, photos, {
      width: 800,
      height: 1000,
    })
    expect(scene.nodes.findIndex((node) => node.id === 'letters-stamp-0')).toBeLessThan(
      scene.nodes.findIndex((node) => node.kind === 'photo'),
    )
    expect(scene.nodes.findIndex((node) => node.id === 'bilhetes:01-tape')).toBeGreaterThan(
      scene.nodes.findIndex((node) => node.id === 'bilhetes:01'),
    )
  })
})
