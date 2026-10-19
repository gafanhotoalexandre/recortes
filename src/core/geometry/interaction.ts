import { clamp, sourceCrop } from './resolve'
import type { Crop, Matrix, Size } from '../types'
export function inversePoint(matrix: Matrix, x: number, y: number) {
  const [a, b, c, d, e, f] = matrix,
    det = a * d - b * c
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) throw Error('Transformação inválida')
  return { x: (d * (x - e) - c * (y - f)) / det, y: (-b * (x - e) + a * (y - f)) / det }
}
export function visibleCrop(photo: Size, frame: Size, crop: Crop): Crop {
  const rect = sourceCrop(photo, frame, crop)
  return { centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2, zoom: crop.zoom }
}
export function zoomCrop(photo: Size, frame: Size, crop: Crop, zoom: number): Crop {
  return visibleCrop(photo, frame, { ...visibleCrop(photo, frame, crop), zoom: clamp(zoom, 1, 3) })
}
export function panCrop(photo: Size, frame: Size, crop: Crop, dx: number, dy: number): Crop {
  const start = visibleCrop(photo, frame, crop)
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height) * start.zoom
  return visibleCrop(photo, frame, {
    ...start,
    centerX: start.centerX - dx / scale / photo.width,
    centerY: start.centerY - dy / scale / photo.height,
  })
}
