// A single small thumbnail per frame. New inputs replace the pending work at its consumer.
const queue = new Set<() => void>()
let frame = 0
function tick() {
  frame = 0
  const task = queue.values().next().value
  if (task) {
    queue.delete(task)
    task()
  }
  if (queue.size && !frame) frame = requestAnimationFrame(tick)
}
export function scheduleThumbnail(task: () => void): () => void {
  queue.add(task)
  if (!frame) frame = requestAnimationFrame(tick)
  return () => {
    queue.delete(task)
    if (!queue.size && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
}
