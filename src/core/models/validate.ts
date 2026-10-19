import type { ModelDefinition } from '../types'
import { formats } from './formats'

export function validateModels(models: readonly ModelDefinition[]): void {
  const ids = new Set<string>()
  for (const model of models) {
    const fail = (message: string): never => {
      throw new Error(`Modelo ${model.id}: ${message}`)
    }
    if (!model.id || ids.has(model.id)) fail('identificador ausente ou duplicado')
    ids.add(model.id)
    if (
      !model.name ||
      !model.description ||
      !['discreta', 'composta', 'autoral'].includes(model.category)
    )
      fail('metadados inválidos')
    if (
      !model.frameOrder.length ||
      model.frameOrder.length > 12 ||
      new Set(model.frameOrder).size !== model.frameOrder.length
    )
      fail('ordem das molduras inválida')
    const { margin, corners } = model.capabilities
    if (
      ![margin.max, corners.max, ...corners.choices].every((n) => Number.isFinite(n) && n >= 0) ||
      margin.max > 100 ||
      corners.max > 50 ||
      corners.choices.some((n) => n > corners.max)
    )
      fail('capacidades inválidas')
    for (const format of formats) {
      const variant = model.variants[format.id]
      if (!variant || variant.frames.length !== model.frameOrder.length)
        fail(`variante ${format.id} incompleta`)
      variant.frames.forEach((frame, i) => {
        if (frame.id !== model.frameOrder[i]) fail(`identidade/ordem divergente em ${format.id}`)
        if (
          ![frame.x, frame.y, frame.width, frame.height, frame.rotation].every(Number.isFinite) ||
          frame.width <= 0 ||
          frame.height <= 0
        )
          fail('geometria inválida')
        if (
          frame.x < 0 ||
          frame.y < 0 ||
          frame.x + frame.width > 1.000001 ||
          frame.y + frame.height > 1.000001
        )
          fail('moldura fora da folha normalizada')
        if (!['rect', 'arch'].includes(frame.mask)) fail('máscara inválida')
      })
    }
  }
}
