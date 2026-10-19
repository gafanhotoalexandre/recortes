import assets from './demo-assets.json'
import type { PhotoMetadata } from '@/core/types'
import type { PhotoSource } from '@/core/render/canvas'

export interface DemoResources {
  sources: ReadonlyMap<string, PhotoSource>
  metadata: ReadonlyMap<string, PhotoMetadata>
  dispose: () => void
}

// Browser resource acquisition is separate from scene resolution and rendering.
export async function loadDemoResources(signal: AbortSignal): Promise<DemoResources> {
  const images: HTMLImageElement[] = []
  const sources = new Map<string, PhotoSource>()
  const metadata = new Map<string, PhotoMetadata>()
  let disposed = false
  const dispose = () => {
    disposed = true
    for (const image of images) image.src = ''
    images.length = 0
    sources.clear()
    metadata.clear()
  }
  const abort = () => dispose()
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    await Promise.all(
      assets.photos.map(async (photo) => {
        const image = new Image()
        images.push(image)
        image.src = photo.src
        await image.decode()
        signal.throwIfAborted()
        if (disposed) throw new DOMException('Recursos liberados', 'AbortError')
        sources.set(photo.id, { image, width: image.naturalWidth, height: image.naturalHeight })
        metadata.set(photo.id, {
          id: photo.id,
          width: image.naturalWidth,
          height: image.naturalHeight,
        })
      }),
    )
    signal.removeEventListener('abort', abort)
    return { sources, metadata, dispose }
  } catch (error) {
    signal.removeEventListener('abort', abort)
    dispose()
    throw error
  }
}
