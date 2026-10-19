// One completed download may outlive the closing dialog, so browsers can consume it.
let url: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
export function releaseDownload() {
  clearTimeout(timer)
  timer = undefined
  if (url) URL.revokeObjectURL(url)
  url = null
}
export function retainDownload(blob: Blob): string {
  releaseDownload()
  url = URL.createObjectURL(blob)
  return url
}
export function scheduleDownloadRelease() {
  if (!url) return
  clearTimeout(timer)
  timer = setTimeout(releaseDownload, 60_000)
}
