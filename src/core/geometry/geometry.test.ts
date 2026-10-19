import { describe, expect, it } from 'vitest'
import { models, getModel } from '../models/registry'
import { formats } from '../models/formats'
import { validateModels } from '../models/validate'
import { createComposition, compositionReducer } from '../composition/state'
import { effectiveAppearance, frameMask, resolveGeometry, sourceCrop } from './resolve'

describe('registro e geometria', () => {
  it('valida o registro único e os identificadores', () => {
    expect(models).toHaveLength(9)
    expect(() => validateModels(models)).not.toThrow()
  })
  for (const model of models)
    for (const format of formats)
      it(`${model.name} / ${format.id}: geometria e escala`, () => {
        const state = createComposition([])
        const a = resolveGeometry(model, format.id, state.appearance, { width: 800, height: 1000 })
        const b = resolveGeometry(model, format.id, state.appearance, { width: 1600, height: 2000 })
        expect(a.frames.map((f) => f.id)).toEqual(model.frameOrder)
        for (const [index, frame] of a.frames.entries()) {
          expect(frame.width).toBeGreaterThan(0)
          expect(frame.height).toBeGreaterThan(0)
          expect(b.frames[index]!.width).toBeCloseTo(frame.width * 2)
          expect(b.frames[index]!.transform[4]).toBeCloseTo(frame.transform[4] * 2)
          expect(frameMask(frame, 2).kind).toBe(frame.mask === 'arch' ? 'arch' : 'roundRect')
        }
      })
  it('recusa IDs repetidos, variante incompleta, coordenadas e máscaras inválidas', () => {
    expect(() => validateModels([models[0]!, models[0]!])).toThrow(/duplicado/)
    const bad = structuredClone(models[0]!)
    const frame = { ...bad.variants.portrait.frames[0]!, width: -1 }
    expect(() =>
      validateModels([
        {
          ...bad,
          variants: {
            ...bad.variants,
            portrait: { frames: [frame, bad.variants.portrait.frames[1]!] },
          },
        },
      ]),
    ).toThrow(/geometria/)
    expect(() => validateModels([{ ...bad, frameOrder: [] }])).toThrow(/ordem/)
    expect(() =>
      validateModels([{ ...bad, variants: { ...bad.variants, square: { frames: [] } } }]),
    ).toThrow(/incompleta/)
    expect(() =>
      resolveGeometry(bad, 'square', createComposition([]).appearance, { width: NaN, height: 0 }),
    ).toThrow()
  })
  it('aplica capacidades sem alterar escolhas canônicas', () => {
    const appearance = { ...createComposition([]).appearance, margin: 12, corner: 12 }
    expect(effectiveAppearance(getModel('fotogramas'), appearance)).toMatchObject({
      margin: 0,
      corner: 0,
    })
    expect(effectiveAppearance(getModel('bilhetes'), appearance).corner).toBe(3)
    expect(appearance).toMatchObject({ margin: 12, corner: 12 })
  })
})

describe('enquadramento e preservação', () => {
  it('resolve cover sem distorção e mantém centros próximos da borda dentro da foto', () => {
    for (const center of [0, 0.5, 1])
      for (const zoom of [1, 2, 3]) {
        const crop = { centerX: center, centerY: center, zoom }
        const rect = sourceCrop({ width: 1200, height: 800 }, { width: 200, height: 400 }, crop)
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width).toBeLessThanOrEqual(1)
        expect(rect.y + rect.height).toBeLessThanOrEqual(1)
        expect((rect.width * 1200) / (rect.height * 800)).toBeCloseTo(0.5)
        expect(crop).toEqual({ centerX: center, centerY: center, zoom })
      }
  })
  it('preserva as doze posições, inclusive ocultas, e retorna a mesma referência em noops', () => {
    const state = createComposition(Array.from({ length: 12 }, (_, i) => `photo-${i}`))
    state.placements[10]!.crop.centerX = 0.8
    const next = compositionReducer(
      compositionReducer(state, { type: 'select-model', modelId: 'lado' }),
      { type: 'select-format', formatId: 'landscape' },
    )
    expect(next.placements).toBe(state.placements)
    expect(next.placements[10]).toEqual(state.placements[10])
    expect(compositionReducer(next, { type: 'select-model', modelId: 'lado' })).toBe(next)
    expect(compositionReducer(next, { type: 'select-format', formatId: 'landscape' })).toBe(next)
    const back = compositionReducer(next, { type: 'select-model', modelId: 'mural' })
    expect(back.placements[10]!.crop.centerX).toBe(0.8)
  })
})
