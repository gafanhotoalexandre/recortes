import type { CompositionState } from '../composition/state'
import { getModel } from '../models/registry'
import { frameMask, multiply, resolveGeometry, rotation, sourceCrop } from '../geometry/resolve'
import type { PhotoMetadata, Scene, SceneNode, Size, TextNode } from '../types'

export function resolveScene(
  composition: CompositionState,
  photos: ReadonlyMap<string, PhotoMetadata>,
  size: Size,
  options: { thumbnail?: boolean } = {},
): Scene {
  const model = getModel(composition.modelId)
  const geometry = resolveGeometry(model, composition.formatId, composition.appearance, size)
  const { width: w, height: h } = size
  const a = geometry.appearance
  const nodes: SceneNode[] = [
    {
      id: 'paper',
      kind: 'shape',
      shape: { kind: 'roundRect', rect: { x: 0, y: 0, width: w, height: h }, radius: 0 },
      fill: a.paperColor,
    },
  ]
  nodes.push(...(model.variants[composition.formatId].background?.(size, a) ?? []))
  for (const frame of geometry.frames) {
    const placement = composition.placements[frame.index]
    if (!placement || placement.id !== frame.placementId)
      throw new Error('Posição fotográfica inconsistente')
    const photo = placement.photoId ? photos.get(placement.photoId) : undefined
    if (placement.photoId && !photo) throw new Error('Fotografia ainda não disponível')
    if (a.border || frame.paperBorder) {
      nodes.push({
        id: `${frame.id}-paper`,
        kind: 'shape',
        transform: frame.transform,
        shape: frameMask(frame, a.corner, w * 0.006),
        fill: '#fffef9',
        ...(frame.shadow
          ? { shadow: { color: '#32283a28', blur: w * 0.008, offsetY: w * 0.004 } }
          : {}),
      })
    }
    nodes.push({
      id: frame.id,
      kind: 'photo',
      photoId: placement.photoId,
      source: photo ? sourceCrop(photo, frame, placement.crop) : null,
      destination: {
        x: -frame.width / 2,
        y: -frame.height / 2,
        width: frame.width,
        height: frame.height,
      },
      mask: frameMask(frame, a.corner),
      transform: frame.transform,
      emptyLabel: options.thumbnail ? null : `+ foto ${frame.index + 1}`,
      emptyFontSize: Math.max(10, w * 0.022),
    })
    if (frame.tape) {
      nodes.push({
        id: `${frame.id}-tape`,
        kind: 'shape',
        transform: multiply(frame.transform, rotation(-0.06, 0, -frame.height / 2)),
        fill: '#d9caa2c4',
        shape: {
          kind: 'roundRect',
          rect: {
            x: -frame.width * 0.18,
            y: -frame.height * 0.04,
            width: frame.width * 0.36,
            height: frame.height * 0.1,
          },
          radius: 0,
        },
      })
    }
  }
  if (a.caption) {
    const caption: TextNode = {
      id: 'caption',
      kind: 'text',
      text: a.caption,
      x: w * 0.5,
      y: h * 0.882,
      size: Math.min(w * 0.044, h * 0.034),
      font: a.font === 'serif' ? 'Georgia' : 'Arial',
      italic: a.font === 'serif',
      color: '#514257',
      align: 'center',
      baseline: 'middle',
      maxWidth: w * 0.83,
      minScale: 0.15,
    }
    nodes.push(caption)
  }
  if (a.date)
    nodes.push({
      id: 'date',
      kind: 'text',
      text: a.date,
      x: w * 0.5,
      y: h * 0.927,
      size: w * 0.023,
      font: 'Arial',
      color: '#7d6c83',
      align: 'center',
      baseline: 'middle',
      maxWidth: w * 0.8,
      minScale: 0.15,
    })
  return { size, modelId: model.id, formatId: composition.formatId, nodes, frames: geometry.frames }
}
