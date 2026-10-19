import { categoryNames, formats } from '@/core/models/formats'
import { getModel } from '@/core/models/registry'
import type { CompositionState } from '@/core/composition/state'
import type { FormatId } from '@/core/types'
import { CanvasSurface } from './CanvasSurface'
import { FrameControls } from './FrameControls'
import type { EditingDraft } from './draft'
interface Props {
  composition: CompositionState
  onFormat: (format: FormatId) => void
  draft: EditingDraft
  selected: string | null
  adjusting: boolean
  busy: boolean
  swapFrom: string | null
  target: string
  onSelect: (id: string | null, open: boolean) => void
  onCommit: () => void
  onExit: () => void
  onFiles: (files: File[]) => void
}
export function Preview(props: Props) {
  const { composition, onFormat, draft, busy, onFiles } = props
  const model = getModel(composition.modelId)
  return (
    <>
      <div className="bench-head">
        <div>
          <span className="model-name">{model.name}</span>
          <span className="model-kind">{categoryNames[model.category]}</span>
        </div>
        <select
          className="select"
          aria-label="Formato da colagem"
          value={composition.formatId}
          disabled={busy}
          onChange={(e) => onFormat(e.target.value as FormatId)}
        >
          {formats.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div
        className="stage"
        data-testid="stage"
        onDragOver={(e) => {
          if (!busy && e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            e.currentTarget.classList.add('drag-over')
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            e.currentTarget.classList.remove('drag-over')
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('drag-over')
          if (!busy && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files))
        }}
      >
        <CanvasSurface composition={composition} draft={draft}>
          <FrameControls {...props} />
        </CanvasSurface>
      </div>
    </>
  )
}
