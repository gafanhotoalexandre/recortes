import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LibraryPhoto } from '@/core/composition/editor'
import type { CompositionState } from '@/core/composition/state'
import { getModel } from '@/core/models/registry'
interface Props {
  composition: CompositionState
  photos: readonly LibraryPhoto[]
  selected: string | null
  busy: boolean
  targetIndex: number
  targetOccupied: boolean
  onSelect: (id: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  onRotate: () => void
}
export function PhotoLibrary({
  composition,
  photos,
  selected,
  busy,
  targetIndex,
  targetOccupied,
  onSelect,
  onAdd,
  onRemove,
  onRotate,
}: Props) {
  const visibleCount = getModel(composition.modelId).frameOrder.length
  return (
    <section className="photo-tray" id="photo-tray" aria-label="Biblioteca de fotos">
      <div className="tray-head">
        <h2>
          Suas fotos{' '}
          <small>
            {photos.length}
            {photos.every((p) => p.demo) ? ' de exemplo' : ' na biblioteca'}
          </small>
        </h2>
        <div className="tray-buttons">
          <button className="text-btn" type="button" disabled={busy} onClick={onRotate}>
            Mudar a ordem
          </button>
          <button
            className="button small"
            type="button"
            aria-disabled={busy}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true })
              if (!busy) onAdd()
            }}
          >
            <Plus aria-hidden="true" />
            Adicionar fotos
          </button>
        </div>
      </div>
      <p className="assignment-hint" id="assignment-hint">
        Destino: <strong>moldura {targetIndex + 1}</strong>.{' '}
        {targetOccupied
          ? 'A foto atual será substituída ou trocada de posição.'
          : 'Escolha uma foto para preencher.'}
      </p>
      <div className="photo-list" data-testid="photo-list">
        {photos.map((photo, index) => {
          const position = composition.placements.findIndex((p) => p.photoId === photo.id)
          return (
            <div className="thumb-wrap" key={photo.id}>
              <button
                type="button"
                className={cn('thumb', selected === photo.id && 'selected')}
                disabled={busy}
                aria-describedby="assignment-hint"
                aria-label={`Selecionar foto${photo.demo ? ' de exemplo' : ''}: ${photo.name}`}
                aria-pressed={selected === photo.id}
                onClick={(e) => {
                  e.currentTarget.focus({ preventScroll: true })
                  onSelect(photo.id)
                }}
              >
                <img src={photo.src} width="72" height="84" alt="" decoding="async" />
                <span
                  className="usage"
                  aria-label={
                    position >= 0 && position < visibleCount
                      ? `Moldura ${position + 1}`
                      : position >= visibleCount
                        ? `Posição ${position + 1}, oculta neste modelo`
                        : 'Fora desta composição'
                  }
                >
                  {position >= 0 && position < visibleCount ? position + 1 : '+'}
                </span>
              </button>
              <button
                type="button"
                className="remove-photo"
                disabled={busy}
                aria-label={`Remover ${photo.name} da biblioteca`}
                onClick={() => {
                  const next = photos[index + 1] ?? photos[index - 1]
                  onRemove(photo.id)
                  if (next)
                    requestAnimationFrame(() =>
                      document
                        .querySelectorAll<HTMLButtonElement>('.photo-list .thumb')
                        .item(Math.min(index, photos.length - 2))
                        ?.focus({ preventScroll: true }),
                    )
                  else
                    document
                      .querySelector<HTMLButtonElement>('.tray-buttons .button')
                      ?.focus({ preventScroll: true })
                }}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <p className="tray-note">
        {photos.length && photos.every((p) => p.demo)
          ? 'Ao adicionar suas fotos, os exemplos serão substituídos. '
          : ''}
        Até 12 fotos · JPEG, PNG ou WebP. Processamento local; a sessão termina ao fechar a página.
      </p>
    </section>
  )
}
