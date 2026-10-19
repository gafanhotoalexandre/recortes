import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { models, type Model, type ModelId } from '@/core/models/registry'
import { effectiveAppearance } from '@/core/geometry/resolve'
import { filters, type FilterId } from './navigation'
import type { CompositionState } from '@/core/composition/state'
import { CanvasSurface } from './CanvasSurface'

function ModelThumbnail({
  model,
  composition,
  active,
}: {
  model: Model
  composition: CompositionState
  active: boolean
}) {
  // These small serializable projections include only inputs used by this model's thumbnail.
  const serialized = JSON.stringify({
    modelId: model.id,
    formatId: 'portrait',
    placements: composition.placements.slice(0, model.frameOrder.length),
    appearance: {
      ...effectiveAppearance(model, composition.appearance),
      caption: '',
      date: '',
      font: 'serif',
    },
  })
  const sample = useMemo(() => JSON.parse(serialized) as CompositionState, [serialized])
  return <CanvasSurface composition={sample} mode="thumbnail" active={active} />
}

interface Props {
  composition: CompositionState
  busy: boolean
  open: boolean
  selected: ModelId
  filter: FilterId
  onFilter: (filter: FilterId) => void
  onSelect: (model: ModelId) => void
}

export function ModelGallery({
  composition,
  busy,
  open,
  selected,
  filter,
  onFilter,
  onSelect,
}: Props) {
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const query = matchMedia('(max-width: 720px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return (
    <>
      <div className="filters" role="group" aria-label="Filtrar composições">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => onFilter(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="model-grid">
        {models.map((model) => (
          <button
            key={model.id}
            hidden={filter !== 'all' && model.category !== filter}
            type="button"
            className="model-card"
            aria-label={`Modelo ${model.name}, ${model.frameOrder.length} fotos`}
            aria-pressed={selected === model.id}
            disabled={busy}
            onClick={() => onSelect(model.id)}
          >
            <ModelThumbnail
              model={model}
              composition={composition}
              active={(!mobile || open) && (filter === 'all' || model.category === filter)}
            />
            {selected === model.id ? (
              <span className="model-check" aria-hidden="true">
                <Check />
              </span>
            ) : null}
            <strong>{model.name}</strong>
            <small>{model.frameOrder.length} fotos</small>
          </button>
        ))}
      </div>
    </>
  )
}
