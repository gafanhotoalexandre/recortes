import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { getFormat } from '@/core/models/formats'
import { getModel } from '@/core/models/registry'
import { archProfile, frameMask, resolveGeometry } from '@/core/geometry/resolve'
import { inversePoint, panCrop } from '@/core/geometry/interaction'
import { shapePath } from '@/core/render/canvas'
import type { CompositionState } from '@/core/composition/state'
import type { Crop, FrameGeometry } from '@/core/types'
import { useDemoResources, usePhotoSession } from './DemoResourceProvider'
import { type EditingDraft, useDraftValue } from './draft'

interface Props {
  composition: CompositionState
  draft: EditingDraft
  selected: string | null
  adjusting: boolean
  busy: boolean
  swapFrom: string | null
  target: string
  onSelect: (id: string | null, open: boolean) => void
  onCommit: () => void
  onExit: () => void
}
interface Drag {
  pointerId: number
  frame: FrameGeometry
  x: number
  y: number
  crop: Crop
  photo: { width: number; height: number } | null
  moved: boolean
  tapOnly: boolean
}
export function FrameControls({
  composition,
  draft,
  selected,
  adjusting,
  busy,
  swapFrom,
  target,
  onSelect,
  onCommit,
  onExit,
}: Props) {
  const root = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null)
  const pointers = useRef(new Set<number>())
  const hitCanvas = useRef<HTMLCanvasElement | null>(null)
  const { resources } = useDemoResources()
  const {
    editor: { library },
  } = usePhotoSession()
  const maskId = useId()
  const appearance = useDraftValue(draft, (c) => c.appearance)
  const size = { width: 1000, height: 1000 / getFormat(composition.formatId).ratio }
  const geometry = resolveGeometry(
    getModel(composition.modelId),
    composition.formatId,
    appearance,
    size,
  )
  function cancel() {
    const old = drag.current
    drag.current = null
    draft.cancel()
    if (old && root.current?.hasPointerCapture(old.pointerId))
      root.current.releasePointerCapture(old.pointerId)
  }
  const cancelRef = useRef(cancel)
  useEffect(() => {
    cancelRef.current = cancel
  })
  useLayoutEffect(() => {
    if (drag.current) cancelRef.current()
  }, [composition.modelId, composition.formatId, busy])
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    hitCanvas.current = canvas
    const activePointers = pointers.current
    const observer = new ResizeObserver(() => {
      if (drag.current) cancelRef.current()
    })
    observer.observe(root.current!)
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (drag.current) {
        e.preventDefault()
        e.stopPropagation()
        cancelRef.current()
      }
    }
    window.addEventListener('keydown', escape, true)
    return () => {
      cancelRef.current()
      activePointers.clear()
      observer.disconnect()
      window.removeEventListener('keydown', escape, true)
      if (hitCanvas.current === canvas) hitCanvas.current = null
      canvas.width = canvas.height = 0
    }
  }, [])
  function point(e: ReactPointerEvent) {
    const rect = root.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * size.width,
      y: ((e.clientY - rect.top) / rect.height) * size.height,
    }
  }
  function hit(x: number, y: number) {
    const ctx = hitCanvas.current?.getContext('2d')
    if (!ctx) return undefined
    return [...geometry.frames].reverse().find((frame) => {
      const local = inversePoint(frame.transform, x, y)
      return ctx.isPointInPath(
        shapePath(frameMask(frame, geometry.appearance.corner)),
        local.x,
        local.y,
      )
    })
  }
  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (busy || e.button !== 0) return
    pointers.current.add(e.pointerId)
    if (pointers.current.size > 1) {
      cancel()
      return
    }
    onCommit()
    const p = point(e),
      frame = hit(p.x, p.y)
    if (!frame) {
      onSelect(null, false)
      return
    }
    if (swapFrom) {
      onSelect(frame.placementId, false)
      return
    }
    const touch = e.pointerType !== 'mouse'
    if (!touch) {
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-placement="${frame.placementId}"]`)
        ?.focus({ preventScroll: true })
      onSelect(frame.placementId, false)
    }
    const placement = draft.getSnapshot().placements[frame.index]!
    const photo = placement.photoId ? (resources?.metadata.get(placement.photoId) ?? null) : null
    const local = inversePoint(frame.transform, p.x, p.y)
    drag.current = {
      pointerId: e.pointerId,
      frame,
      x: local.x,
      y: local.y,
      crop: placement.crop,
      photo,
      moved: false,
      tapOnly: touch && (!adjusting || selected !== frame.placementId),
    }
    root.current!.setPointerCapture(e.pointerId)
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const p = point(e),
      local = inversePoint(d.frame.transform, p.x, p.y),
      dx = local.x - d.x,
      dy = local.y - d.y
    if (Math.hypot(dx, dy) > 5) d.moved = true
    if (!d.moved || d.tapOnly || !d.photo) return
    draft.change({
      type: 'crop',
      placementId: d.frame.placementId,
      crop: panCrop(d.photo, d.frame, d.crop, dx, dy),
    })
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (root.current!.hasPointerCapture(e.pointerId))
      root.current!.releasePointerCapture(e.pointerId)
    if (e.pointerType === 'mouse')
      root.current
        ?.querySelector<HTMLButtonElement>(`[data-placement="${d.frame.placementId}"]`)
        ?.focus({ preventScroll: true })
    if (d.moved && !d.tapOnly) onCommit()
    else if (!d.moved) onSelect(d.frame.placementId, e.pointerType !== 'mouse' && !adjusting)
  }
  return (
    <div
      ref={root}
      className={`frames${adjusting ? ' adjusting' : ''}`}
      role="group"
      aria-label="Molduras da colagem"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        cancel()
      }}
      onLostPointerCapture={() => {
        if (drag.current) cancel()
      }}
    >
      {geometry.frames.map((frame) => {
        const placement = composition.placements[frame.index]!,
          selectedFrame = selected === frame.placementId
        const mask = frameMask(frame, geometry.appearance.corner)
        if (!('rect' in mask)) return null
        const rect = mask.rect
        const { rx, ry } = archProfile(rect)
        const outline =
          frame.mask === 'arch' ? (
            <path
              d={`M${rect.x},${rect.y + rect.height} L${rect.x},${rect.y + ry} A${rx},${ry} 0 0 1 ${rect.x + rect.width},${rect.y + ry} L${rect.x + rect.width},${rect.y + rect.height} Z`}
            />
          ) : (
            <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={frame.radius} />
          )
        const clipId = `${maskId}-${frame.placementId}`
        return (
          <Fragment key={frame.placementId}>
            <svg className="frame-mask-definition" width="0" height="0" aria-hidden="true">
              <defs>
                <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                  {frame.mask === 'arch' ? (
                    <path
                      d={`M0 1 L0 ${ry / frame.height} A${rx / frame.width} ${ry / frame.height} 0 0 1 1 ${ry / frame.height} L1 1 Z`}
                    />
                  ) : (
                    <rect
                      width="1"
                      height="1"
                      rx={frame.radius / frame.width}
                      ry={frame.radius / frame.height}
                    />
                  )}
                </clipPath>
              </defs>
            </svg>
            <button
              type="button"
              className={`frame-control${selectedFrame ? ' selected' : ''}${target === frame.placementId && !selectedFrame ? ' destination' : ''}${!placement.photoId ? ' empty' : ''}`}
              aria-pressed={selectedFrame}
              aria-label={`Moldura ${frame.index + 1}${placement.photoId ? ', com fotografia: ' + (library.find((p) => p.id === placement.photoId)?.name ?? '') : ', vazia'}`}
              data-placement={frame.placementId}
              disabled={busy}
              style={{
                left: `${(frame.x / size.width) * 100}%`,
                top: `${(frame.y / size.height) * 100}%`,
                width: `${(frame.width / size.width) * 100}%`,
                height: `${(frame.height / size.height) * 100}%`,
                transform: `rotate(${frame.rotation}deg)`,
                clipPath: `url(#${clipId})`,
              }}
              onClick={(e) => {
                if (e.detail === 0 && !busy) onSelect(frame.placementId, true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  draft.cancel()
                  onExit()
                  return
                }
                if (!e.key.startsWith('Arrow') || !placement.photoId || busy) return
                e.preventDefault()
                onSelect(frame.placementId, false)
                const photo = resources?.metadata.get(placement.photoId)
                if (!photo) return
                const crop = draft.getSnapshot().placements[frame.index]!.crop,
                  step = e.shiftKey ? 0.1 : 0.025
                const dx =
                  e.key === 'ArrowLeft'
                    ? step * frame.width
                    : e.key === 'ArrowRight'
                      ? -step * frame.width
                      : 0
                const dy =
                  e.key === 'ArrowUp'
                    ? step * frame.height
                    : e.key === 'ArrowDown'
                      ? -step * frame.height
                      : 0
                draft.change({
                  type: 'crop',
                  placementId: frame.placementId,
                  crop: panCrop(photo, frame, crop, dx, dy),
                })
              }}
              onKeyUp={(e) => {
                if (e.key.startsWith('Arrow')) onCommit()
              }}
              onBlur={onCommit}
            >
              <svg
                viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {outline}
              </svg>
              <span className="frame-tag">{frame.index + 1}</span>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
