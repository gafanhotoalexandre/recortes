import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Image } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TabId } from './navigation'
import { getModel, type Model } from '@/core/models/registry'
import { effectiveAppearance, resolveGeometry } from '@/core/geometry/resolve'
import { panCrop, zoomCrop } from '@/core/geometry/interaction'
import { getFormat } from '@/core/models/formats'
import { initialCrop, type Edit, type LibraryPhoto } from '@/core/composition/editor'
import { useDemoResources } from './DemoResourceProvider'
import { type EditingDraft, useDraftValue } from './draft'
const palette = [
  { name: 'Algodão', color: '#fffaf4' },
  { name: 'Lavanda', color: '#e9dff1' },
  { name: 'Manteiga', color: '#f2e9c7' },
  { name: 'Bruma', color: '#dfe8e8' },
  { name: 'Rosa antigo', color: '#efdcde' },
]
interface CropProps {
  draft: EditingDraft
  selected: string | null
  busy: boolean
  onCommit: () => void
}
export function CropTools({
  draft,
  selected,
  busy,
  onCommit,
  compact = false,
}: CropProps & { compact?: boolean }) {
  const c = useDraftValue(draft, (c) => c)
  const placements = c.placements
  const p = placements.find((p) => p.id === selected)
  const { resources } = useDemoResources()
  const photo = p?.photoId ? resources?.metadata.get(p.photoId) : undefined

  const ratio = getFormat(c.formatId).ratio
  const frame = resolveGeometry(getModel(c.modelId), c.formatId, c.appearance, {
    width: 1000,
    height: 1000 / ratio,
  }).frames.find((f) => f.placementId === selected)
  const disabled = busy || !photo || !frame
  const zoom = p?.crop.zoom ?? 1
  function changeZoom(value: number) {
    if (disabled || !p) return
    draft.change({ type: 'crop', placementId: p.id, crop: zoomCrop(photo!, frame!, p.crop, value) })
  }
  return (
    <>
      <div className="group wide zoom-control">
        <label className="label" htmlFor={compact ? 'compact-zoom' : 'zoom'}>
          Aproximar <small>{Math.round(zoom * 100)}%</small>
        </label>
        <input
          id={compact ? 'compact-zoom' : 'zoom'}
          type="range"
          min="1"
          max="3"
          step=".01"
          value={zoom}
          disabled={disabled}
          aria-valuetext={`${Math.round(zoom * 100)}%`}
          onChange={(e) => changeZoom(Number(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
          onBlur={onCommit}
          onPointerCancel={() => draft.cancel()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              draft.cancel()
            }
          }}
        />
      </div>
      {!compact ? (
        <>
          <div className="group">
            <div className="arrow-pad" role="group" aria-label="Posição da foto">
              {[
                { icon: ArrowUp, name: 'acima', x: 0, y: 1 },
                { icon: ArrowLeft, name: 'à esquerda', x: 1, y: 0 },
                { icon: ArrowDown, name: 'abaixo', x: 0, y: -1 },
                { icon: ArrowRight, name: 'à direita', x: -1, y: 0 },
              ].map(({ icon: Icon, name, x, y }) => (
                <button
                  key={name}
                  type="button"
                  disabled={disabled}
                  aria-label={`Enquadrar mais ${name}`}
                  onClick={() => {
                    draft.change({
                      type: 'crop',
                      placementId: p!.id,
                      crop: panCrop(
                        photo!,
                        frame!,
                        p!.crop,
                        x * frame!.width * 0.04,
                        y * frame!.height * 0.04,
                      ),
                    })
                    onCommit()
                  }}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>
          <div className="group center-control">
            <button
              className="text-btn"
              type="button"
              disabled={disabled}
              onClick={() => {
                draft.change({ type: 'crop', placementId: p!.id, crop: initialCrop() })
                onCommit()
              }}
            >
              Centralizar foto
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}

interface Props extends CropProps {
  tab: TabId
  onTab: (tab: TabId) => void
  model: Model
  library: readonly LibraryPhoto[]
  librarySelected: string | null
  onEdit: (edit: Edit) => void
  onSwap: () => void
  onChoose: () => void
  onAdjust: () => void
  swapFrom: string | null
  onCancelSwap: () => void
}
export function Inspector({
  tab,
  onTab,
  model,
  draft,
  selected,
  busy,
  onCommit,
  library,
  librarySelected,
  onEdit,
  onSwap,
  onChoose,
  onAdjust,
  swapFrom,
  onCancelSwap,
}: Props) {
  const canonical = useDraftValue(draft, (c) => c.appearance)
  const appearance = effectiveAppearance(model, canonical)
  const associatedId = useDraftValue(
    draft,
    (c) => c.placements.find((p) => p.id === selected)?.photoId,
  )
  const composition = draft.getSnapshot()
  const photo = library.find((p) => p.id === associatedId)
  const libraryPhoto = library.find((p) => p.id === librarySelected)
  const frameIndex = composition.placements.findIndex((p) => p.id === selected)
  const visibleSelected = frameIndex >= 0 && frameIndex < model.frameOrder.length
  const hasPhoto = visibleSelected && !!photo
  const rangeEnd = {
    onPointerUp: onCommit,
    onKeyUp: onCommit,
    onBlur: onCommit,
    onPointerCancel: () => draft.cancel(),
  }
  return (
    <>
      <Tabs value={tab} onValueChange={(value) => onTab(value as TabId)}>
        <TabsList aria-label="Ajustes">
          <TabsTrigger value="paper">Papel</TabsTrigger>
          <TabsTrigger value="photo">Foto</TabsTrigger>
          <TabsTrigger value="text">Texto</TabsTrigger>
        </TabsList>
        <TabsContent value="paper" hidden={tab !== 'paper'} aria-describedby="settings-note">
          <div className="group wide">
            <div className="label">
              Cor do papel{' '}
              <small>{palette.find((p) => p.color === appearance.paperColor)?.name}</small>
            </div>
            <div className="swatches" role="group" aria-label="Cor do papel">
              {palette.map((item) => (
                <button
                  key={item.name}
                  className="swatch"
                  type="button"
                  style={{ backgroundColor: item.color }}
                  disabled={busy || !model.capabilities.paper}
                  aria-pressed={appearance.paperColor === item.color}
                  aria-label={`Papel ${item.name}`}
                  onClick={() => onEdit({ type: 'appearance', value: { paperColor: item.color } })}
                />
              ))}
            </div>
          </div>
          <div className="group">
            <label className="label" htmlFor="margin">
              Margem <small>{appearance.margin ? `+${appearance.margin}%` : 'Original'}</small>
            </label>
            <input
              id="margin"
              type="range"
              min="0"
              max={model.capabilities.margin.max}
              value={appearance.margin}
              disabled={busy || !model.capabilities.margin.editable}
              onChange={(e) =>
                draft.change({ type: 'appearance', value: { margin: Number(e.target.value) } })
              }
              {...rangeEnd}
            />
            <p className="hint">
              {model.capabilities.margin.editable
                ? 'Mais espaço em volta, sem desmontar a composição.'
                : 'O espaço acompanha o desenho desta composição.'}
            </p>
          </div>
          <div className="group">
            <div className="label">Cantos das fotos</div>
            <div className="segmented" role="group" aria-label="Cantos das fotos">
              {[
                { v: 0, l: 'Retos' },
                { v: 2, l: 'Suaves' },
                { v: 12, l: 'Redondos' },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  disabled={
                    busy ||
                    !model.capabilities.corners.editable ||
                    !model.capabilities.corners.choices.includes(v)
                  }
                  aria-pressed={model.capabilities.corners.editable && appearance.corner === v}
                  onClick={() => onEdit({ type: 'appearance', value: { corner: v } })}
                >
                  {l}
                </button>
              ))}
            </div>
            {!model.capabilities.corners.editable ? (
              <p className="hint">Os recortes fazem parte do desenho desta composição.</p>
            ) : null}
          </div>
          <div className="group wide">
            <label className="check">
              <input
                type="checkbox"
                checked={appearance.border}
                disabled={busy || !model.capabilities.border}
                onChange={(e) =>
                  onEdit({ type: 'appearance', value: { border: e.target.checked } })
                }
              />
              Borda clara nas fotos
            </label>
          </div>
        </TabsContent>
        <TabsContent value="photo" hidden={tab !== 'photo'} aria-describedby="settings-note">
          {swapFrom ? (
            <p className="swap-notice">
              Escolha outra moldura.{' '}
              <button type="button" className="text-btn" onClick={onCancelSwap}>
                Cancelar troca
              </button>
            </p>
          ) : null}
          <div className="selection">
            {photo ? (
              <img src={photo.src} alt="" width="34" height="41" />
            ) : (
              <Image aria-hidden="true" />
            )}
            <div>
              <strong>
                {visibleSelected ? `Moldura ${frameIndex + 1}` : 'Selecione uma moldura'}
              </strong>
              <small>
                {visibleSelected
                  ? (photo?.name ?? 'Moldura vazia. Escolha uma foto na biblioteca.')
                  : libraryPhoto
                    ? `${libraryPhoto.name} selecionada na biblioteca`
                    : 'Toque numa moldura da colagem.'}
              </small>
            </div>
          </div>
          <CropTools
            draft={draft}
            selected={visibleSelected ? selected : null}
            busy={busy}
            onCommit={onCommit}
          />
          <div className="group wide">
            <button
              className="button small"
              type="button"
              disabled={busy || !hasPhoto}
              onClick={onAdjust}
            >
              Ajustar enquadramento
            </button>
            <p className="hint">
              No celular, ative o ajuste para arrastar. Fora dele, a página rola normalmente.
            </p>
          </div>
          <div className="group wide row">
            <button
              className="button small"
              type="button"
              disabled={busy || !hasPhoto}
              onClick={onSwap}
            >
              Trocar posição
            </button>
            <button
              className="button small"
              type="button"
              disabled={busy || !visibleSelected}
              onClick={onChoose}
            >
              Escolher foto
            </button>
            <button
              className="text-btn"
              type="button"
              disabled={busy || !hasPhoto}
              onClick={() => onEdit({ type: 'clear', placementId: selected! })}
            >
              Retirar da colagem
            </button>
          </div>
        </TabsContent>
        <TabsContent value="text" hidden={tab !== 'text'} aria-describedby="settings-note">
          <div className="group wide">
            <label className="label" htmlFor="caption">
              Legenda <small>opcional</small>
            </label>
            <input
              id="caption"
              className="field"
              maxLength={60}
              placeholder="Ex.: fim de semana"
              value={appearance.caption}
              disabled={busy || !model.capabilities.text.caption}
              onChange={(e) =>
                draft.change({ type: 'appearance', value: { caption: e.target.value } })
              }
              onBlur={onCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit()
                if (e.key === 'Escape') draft.cancel()
              }}
            />
            <p className="hint">Até 60 caracteres. Deixe em branco para não usar legenda.</p>
          </div>
          <div className="group wide">
            <label className="label" htmlFor="date">
              Data ou pequena anotação
            </label>
            <input
              id="date"
              className="field"
              maxLength={32}
              placeholder="Um lugar, uma data…"
              value={appearance.date}
              disabled={busy || !model.capabilities.text.date}
              onChange={(e) =>
                draft.change({ type: 'appearance', value: { date: e.target.value } })
              }
              onBlur={onCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit()
                if (e.key === 'Escape') draft.cancel()
              }}
            />
          </div>
          <div className="group wide">
            <div className="label">Letra</div>
            <div className="segmented" role="group" aria-label="Estilo da legenda">
              {(['serif', 'sans'] as const).map((font) => (
                <button
                  key={font}
                  type="button"
                  className={font === 'serif' ? 'classic' : undefined}
                  disabled={busy}
                  aria-pressed={appearance.font === font}
                  onClick={() => onEdit({ type: 'appearance', value: { font } })}
                >
                  {font === 'serif' ? 'Clássica' : 'Simples'}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <p id="settings-note" className="inspector-note">
        Os ajustes respeitam o desenho de cada modelo. Suas escolhas são preservadas ao trocar de
        composição.
      </p>
    </>
  )
}
