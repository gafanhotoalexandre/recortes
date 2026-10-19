import type { ModelDefinition } from '../types'
import { lado } from './definitions/lado'
import { quatro } from './definitions/quatro'
import { janela } from './definitions/janela'
import { postal } from './definitions/postal'
import { mural } from './definitions/mural'
import { retalhos } from './definitions/retalhos'
import { fotogramas } from './definitions/fotogramas'
import { bilhetes } from './definitions/bilhetes'
import { arcos } from './definitions/arcos'
import { validateModels } from './validate'

const definitions = [
  lado,
  quatro,
  janela,
  postal,
  mural,
  retalhos,
  fotogramas,
  bilhetes,
  arcos,
] as const
export type ModelId = (typeof definitions)[number]['id']
export type Model = ModelDefinition & { id: ModelId }
export const models: readonly Model[] = definitions
validateModels(models)
export function getModel(id: ModelId): Model {
  return models.find((model) => model.id === id)!
}
