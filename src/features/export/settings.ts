import type { CompositionState } from '@/core/composition/state'
import { getFormat } from '@/core/models/formats'
import { getModel } from '@/core/models/registry'
import { resolveScene } from '@/core/render/scene'
import type { PhotoMetadata, Size } from '@/core/types'

export type ExportType = 'png' | 'jpeg' | 'pdf'
export type ExportSize = 'high' | 'share'
export interface ExportOptions { type: ExportType; size: ExportSize; name: string }
export const defaultExportOptions: ExportOptions = { type: 'png', size: 'high', name: '' }
export interface ExportSnapshot {
  composition: CompositionState
  metadata: ReadonlyMap<string, PhotoMetadata>
  originals: ReadonlyMap<string, Blob>
}
export interface ExportRequest {
  snapshot: ExportSnapshot
  type: ExportType
  size: ExportSize
  /** Internal comparison switch; the product uses the measured default. */
  pdfImage?: 'jpeg' | 'png'
}
export function outputSize(composition: CompositionState, size: ExportSize): Size {
  const format = getFormat(composition.formatId)
  const scale = size === 'high' ? 1 : Math.min(1, 1800 / Math.max(format.width, format.height))
  return { width: Math.round(format.width * scale), height: Math.round(format.height * scale) }
}
export function outputName(name: string, caption: string, type: ExportType): string {
  const slug =
    (name || caption || 'minha-colagem')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 55)
      .replace(/-+$/g, '') || 'minha-colagem'
  return `recortes-${slug}.${type === 'jpeg' ? 'jpg' : type}`
}
export function missingPhotos(composition: CompositionState): number {
  return composition.placements
    .slice(0, getModel(composition.modelId).frameOrder.length)
    .filter((p) => !p.photoId).length
}
export function lowResolutionFrames(
  composition: CompositionState,
  metadata: ReadonlyMap<string, PhotoMetadata>,
  size: ExportSize,
): number[] {
  const scene = resolveScene(composition, metadata, outputSize(composition, size))
  return scene.nodes.flatMap((node) => {
    if (node.kind !== 'photo' || !node.photoId || !node.source) return []
    const photo = metadata.get(node.photoId)!
    const ratio = Math.min(
      (photo.width * node.source.width) / node.destination.width,
      (photo.height * node.source.height) / node.destination.height,
    )
    return ratio < 0.6 ? [scene.frames.findIndex((f) => f.id === node.id) + 1] : []
  })
}
