import type {
  Appearance,
  Crop,
  FrameGeometry,
  Matrix,
  ModelDefinition,
  Rect,
  ResolvedGeometry,
  Shape,
  Size,
} from '../types'

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}
export function rotation(angle: number, x = 0, y = 0): Matrix {
  return [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), x, y]
}

export function effectiveAppearance(model: ModelDefinition, appearance: Appearance): Appearance {
  const caps = model.capabilities
  return {
    ...appearance,
    margin: caps.margin.editable ? clamp(appearance.margin, 0, caps.margin.max) : 0,
    corner: caps.corners.editable ? clamp(appearance.corner, 0, caps.corners.max) : 0,
    border: caps.border && appearance.border,
    caption: caps.text.caption ? appearance.caption : '',
    date: caps.text.date ? appearance.date : '',
  }
}

export function resolveGeometry(
  model: ModelDefinition,
  formatId: ResolvedGeometry['formatId'],
  appearance: Appearance,
  size: Size,
): ResolvedGeometry {
  if (![size.width, size.height].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('Dimensões de destino inválidas')
  const effective = effectiveAppearance(model, appearance)
  const factor = 1 - effective.margin / 100
  const frames = model.variants[formatId].frames.map((frame, index): FrameGeometry => {
    const x = (0.5 + (frame.x - 0.5) * factor) * size.width
    const y = (0.45 + (frame.y - 0.45) * factor) * size.height
    const width = frame.width * factor * size.width,
      height = frame.height * factor * size.height
    return {
      ...frame,
      x,
      y,
      width,
      height,
      index,
      placementId: `position-${index + 1}`,
      radius: frame.mask === 'arch' ? 0 : (Math.min(width, height) * effective.corner) / 100,
      transform: rotation((frame.rotation * Math.PI) / 180, x + width / 2, y + height / 2),
    }
  })
  return { size, modelId: model.id, formatId, appearance: effective, frames }
}

export function frameMask(frame: FrameGeometry, corner: number, border = 0): Shape {
  const rect = {
    x: -frame.width / 2 - border,
    y: -frame.height / 2 - border,
    width: frame.width + border * 2,
    height: frame.height + border * 2,
  }
  return frame.mask === 'arch'
    ? { kind: 'arch', rect }
    : {
        kind: 'roundRect',
        rect,
        radius: (Math.min(rect.width, rect.height) * corner) / 100 + border,
      }
}

export function archProfile(rect: Rect) {
  return { rx: rect.width / 2, ry: Math.min(rect.width / 2, rect.height * 0.43) }
}

// Canonical center/zoom are never overwritten by the effective frame-dependent crop.
export function sourceCrop(photo: Size, frame: Size, crop: Crop): Rect {
  if (
    ![photo.width, photo.height, frame.width, frame.height, crop.zoom].every(
      (n) => Number.isFinite(n) && n > 0,
    ) ||
    ![crop.centerX, crop.centerY].every(Number.isFinite)
  )
    throw new Error('Enquadramento inválido')
  const scale =
    Math.max(frame.width / photo.width, frame.height / photo.height) * Math.max(1, crop.zoom)
  const width = Math.min(1, frame.width / scale / photo.width)
  const height = Math.min(1, frame.height / scale / photo.height)
  return {
    x: clamp(crop.centerX - width / 2, 0, 1 - width),
    y: clamp(crop.centerY - height / 2, 0, 1 - height),
    width,
    height,
  }
}
