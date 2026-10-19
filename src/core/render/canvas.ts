import type { Scene, SceneNode, Shape, TextNode } from '../types'
import { archProfile } from '../geometry/resolve'

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export interface PhotoSource {
  image: CanvasImageSource
  width: number
  height: number
}

export function shapePath(shape: Shape): Path2D {
  const path = new Path2D()
  if (shape.kind === 'roundRect') {
    const r = shape.rect
    path.roundRect(r.x, r.y, r.width, r.height, shape.radius)
  } else if (shape.kind === 'arch') {
    const { x, y, width: w, height: h } = shape.rect
    const { rx, ry } = archProfile(shape.rect)
    path.moveTo(x, y + h)
    path.lineTo(x, y + ry)
    path.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 2)
    path.lineTo(x + w, y + h)
    path.closePath()
  } else if (shape.kind === 'ellipse') {
    path.ellipse(shape.x, shape.y, shape.rx, shape.ry, 0, 0, Math.PI * 2)
  } else {
    shape.points.forEach(([x, y], i) => {
      if (i) path.lineTo(x, y)
      else path.moveTo(x, y)
    })
  }
  return path
}

function setFittedFont(ctx: Context2D, node: TextNode): void {
  const font = (size: number) => `${node.italic ? 'italic ' : ''}${size}px ${node.font}`
  ctx.font = font(node.size)
  if (!node.maxWidth || ctx.measureText(node.text).width <= node.maxWidth) return
  let lo = node.size * (node.minScale ?? 0.15),
    hi = node.size
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    ctx.font = font(mid)
    if (ctx.measureText(node.text).width > node.maxWidth) hi = mid
    else lo = mid
  }
  ctx.font = font(lo)
}

// Both full-scene previews and future sequential export use this exact painter.
export function drawNode(ctx: Context2D, node: SceneNode, source?: PhotoSource): void {
  ctx.save()
  try {
    if (node.transform) ctx.transform(...node.transform)
    if (node.kind === 'shape') {
      const path = shapePath(node.shape)
      if (node.shadow) {
        ctx.shadowColor = node.shadow.color
        ctx.shadowBlur = node.shadow.blur
        ctx.shadowOffsetY = node.shadow.offsetY
      }
      if (node.fill) {
        ctx.fillStyle = node.fill
        ctx.fill(path)
      }
      if (node.stroke) {
        ctx.strokeStyle = node.stroke.color
        ctx.lineWidth = node.stroke.width
        ctx.stroke(path)
      }
    } else if (node.kind === 'text') {
      ctx.fillStyle = node.color
      ctx.textAlign = node.align
      ctx.textBaseline = node.baseline
      setFittedFont(ctx, node)
      ctx.fillText(node.text, node.x, node.y)
    } else {
      const rect = node.destination
      ctx.clip(shapePath(node.mask))
      if (node.photoId && node.source) {
        if (!source) throw new Error('Fonte fotográfica ausente')
        const s = node.source
        ctx.drawImage(
          source.image,
          s.x * source.width,
          s.y * source.height,
          s.width * source.width,
          s.height * source.height,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        )
      } else {
        ctx.fillStyle = '#dfd7e6'
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
        if (node.emptyLabel) {
          ctx.fillStyle = '#8a789b'
          ctx.font = `${node.emptyFontSize}px Arial`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(node.emptyLabel, 0, 0, rect.width * 0.85)
        }
      }
    }
  } finally {
    ctx.restore()
  }
}

export function initializeContext(ctx: Context2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
}

export function renderScene(
  ctx: Context2D,
  scene: Scene,
  sources: ReadonlyMap<string, PhotoSource>,
): void {
  ctx.save()
  try {
    initializeContext(ctx)
    for (const node of scene.nodes)
      drawNode(
        ctx,
        node,
        node.kind === 'photo' && node.photoId ? sources.get(node.photoId) : undefined,
      )
  } finally {
    ctx.restore()
  }
}
