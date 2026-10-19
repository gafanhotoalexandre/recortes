import { useSyncExternalStore } from 'react'
import { applyEdit, type Edit } from '@/core/composition/editor'
import type { CompositionState } from '@/core/composition/state'
export class EditingDraft {
  private listeners = new Set<() => void>()
  private edit: Edit | null = null
  private current: CompositionState
  constructor(private base: CompositionState) {
    this.current = base
  }
  getSnapshot = () => this.current
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  private emit() {
    this.listeners.forEach((fn) => fn())
  }
  sync(base: CompositionState) {
    this.base = base
    this.current = base
    this.edit = null
    this.emit()
  }
  change(edit: Edit) {
    this.edit = edit
    this.current = applyEdit(this.base, edit)
    this.emit()
  }
  commit(): Edit | null {
    const edit = this.current === this.base ? null : this.edit
    this.base = this.current
    this.edit = null
    this.emit()
    return edit
  }
  cancel() {
    if (this.current === this.base) return
    this.edit = null
    this.current = this.base
    this.emit()
  }
}
// Only controls subscribe through React. Canvas subscribes imperatively and coalesces paints.
export function useDraftValue<T>(draft: EditingDraft, select: (c: CompositionState) => T): T {
  return useSyncExternalStore(draft.subscribe, () => select(draft.getSnapshot()))
}
