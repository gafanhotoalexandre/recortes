import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { EditingDraft } from './draft'
import { scheduleThumbnail } from './thumbnailQueue'
import type { CompositionState } from '@/core/composition/state'
import { getFormat } from '@/core/models/formats'
import { getModel } from '@/core/models/registry'
import { resolveScene } from '@/core/render/scene'
import { renderScene } from '@/core/render/canvas'
import { useDemoResources } from './DemoResourceProvider'

interface Props {
  composition: CompositionState
  mode?: 'preview' | 'thumbnail' | 'summary'
  draft?: EditingDraft
  children?: ReactNode
  active?: boolean
}

export function CanvasSurface({
  composition,
  mode = 'preview',
  draft,
  children,
  active = true,
}: Props) {
  const { resources, error, retry } = useDemoResources()
  const wrapper = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestDraw = useRef<() => void>(() => {})
  const latest = useRef({ composition, resources, active })
  const [initialRatio] = useState(() => getFormat(composition.formatId).ratio)
  const [drawError, setDrawError] = useState(false)

  useLayoutEffect(() => {
    const canvas = canvasRef.current!
    const container = wrapper.current!
    const buffer = document.createElement('canvas')
    let pending = 0
    let cancelThumbnail: (() => void) | undefined
    let previous:
      | {
          composition: CompositionState
          resources: typeof resources
          width: number
          height: number
        }
      | undefined
    let disposed = false
    const draw = () => {
      pending = 0
      const current = {
        ...latest.current,
        composition: draft?.getSnapshot() ?? latest.current.composition,
      }
      if (!current.active) return
      if (disposed || !current.resources) return
      const ratio = getFormat(current.composition.formatId).ratio
      let width: number, height: number
      if (mode === 'thumbnail') {
        width = 160
        height = 200
      } else if (mode === 'summary') {
        height = Math.round(85 * Math.min(devicePixelRatio || 1, 2))
        width = Math.round(height * ratio)
      } else {
        const stage = container.parentElement!
        const style = getComputedStyle(stage)
        const availableWidth =
          stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        const availableHeight =
          stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        if (availableWidth <= 0 || availableHeight <= 0) return
        const cssWidth = Math.min(availableWidth, availableHeight * ratio)
        const scale = Math.min(
          devicePixelRatio || 1,
          2,
          1600 / Math.max(cssWidth, cssWidth / ratio),
        )
        width = Math.max(1, Math.round(cssWidth * scale))
        height = Math.max(1, Math.round((cssWidth / ratio) * scale))
      }
      if (
        previous?.composition === current.composition &&
        (previous.resources === current.resources ||
          current.composition.placements.every(
            (p) =>
              !p.photoId ||
              (previous!.resources?.sources.get(p.photoId) ===
                current.resources!.sources.get(p.photoId) &&
                previous!.resources?.metadata.get(p.photoId) ===
                  current.resources!.metadata.get(p.photoId)),
          )) &&
        previous.width === width &&
        previous.height === height
      )
        return
      try {
        const resolveStart = performance.now()
        const scene = resolveScene(
          current.composition,
          current.resources.metadata,
          { width, height },
          { thumbnail: mode === 'thumbnail' },
        )
        const resolveMs = performance.now() - resolveStart
        if (buffer.width !== width) buffer.width = width
        if (buffer.height !== height) buffer.height = height
        const context = buffer.getContext('2d', { alpha: false })
        if (!context) throw new Error('Canvas 2D não disponível')
        const start = performance.now()
        renderScene(context, scene, current.resources.sources)
        const target = canvas.getContext('2d', { alpha: false })
        if (!target) throw new Error('Canvas 2D não disponível')
        // Resize, copy and CSS ratio commit within one animation frame, after a complete draw.
        if (canvas.width !== width) canvas.width = width
        if (canvas.height !== height) canvas.height = height
        target.setTransform(1, 0, 0, 1, 0, 0)
        target.drawImage(buffer, 0, 0)
        container.style.setProperty('--paper-ratio', String(ratio))
        const model = getModel(current.composition.modelId)
        canvas.setAttribute('aria-label', `Colagem: ${model.name}. ${model.description}`)
        canvas.dataset.model = current.composition.modelId
        canvas.dataset.format = current.composition.formatId
        canvas.dataset.renderCount = String(Number(canvas.dataset.renderCount ?? 0) + 1)
        canvas.dataset.renderMs = String(performance.now() - start)
        canvas.dataset.resolveMs = String(resolveMs)
        canvas.dataset.ready = 'true'
        container.dataset.ready = 'true'
        previous = { ...current, width, height }
        setDrawError(false)
      } catch {
        setDrawError(true)
      }
    }
    const schedule = () => {
      if (!pending && !disposed) {
        if (mode === 'thumbnail') {
          pending = 1
          cancelThumbnail = scheduleThumbnail(draw)
        } else pending = requestAnimationFrame(draw)
      }
    }
    requestDraw.current = schedule
    const unsubscribe = draft?.subscribe(schedule)
    const observer = mode === 'preview' ? new ResizeObserver(schedule) : null
    if (observer) observer.observe(container.parentElement!)
    // Re-arm the DPR query after a screen-density change, including changes without window resize.
    let density = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`)
    const densityChanged = () => {
      density.removeEventListener('change', densityChanged)
      density = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`)
      density.addEventListener('change', densityChanged)
      schedule()
    }
    if (mode !== 'thumbnail') {
      density.addEventListener('change', densityChanged)
      window.addEventListener('resize', schedule)
    }
    schedule()
    return () => {
      disposed = true
      unsubscribe?.()
      if (mode === 'thumbnail') cancelThumbnail?.()
      else if (pending) cancelAnimationFrame(pending)
      observer?.disconnect()
      density.removeEventListener('change', densityChanged)
      window.removeEventListener('resize', schedule)
      buffer.width = 0
      buffer.height = 0
      requestDraw.current = () => {}
    }
  }, [mode, draft])

  useLayoutEffect(() => {
    latest.current = { composition, resources, active }
    requestDraw.current()
  }, [composition, resources, active])

  return (
    <div
      ref={wrapper}
      className={
        mode === 'preview'
          ? 'paper canvas-surface'
          : mode === 'thumbnail'
            ? 'model-thumbnail canvas-surface'
            : 'summary-canvas canvas-surface'
      }
      style={{ '--paper-ratio': initialRatio } as CSSProperties}
    >
      <canvas
        ref={canvasRef}
        role={mode === 'preview' ? 'img' : undefined}
        aria-hidden={mode === 'preview' ? undefined : true}
        data-testid={mode === 'preview' ? 'composition-preview' : undefined}
        width="1"
        height="1"
      />
      {children}
      {mode === 'preview' ? (
        <>
          <span className="canvas-loading" role="status">
            Preparando a prévia…
          </span>
          {error || drawError ? (
            <div className="canvas-error" role="alert">
              <p>{error ?? 'Não foi possível desenhar esta prévia.'}</p>
              <button
                className="button small"
                type="button"
                onClick={() => {
                  if (error) retry()
                  else requestDraw.current()
                }}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
