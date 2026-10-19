import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  id: string
  title: string
  className: string
  open: boolean
  onClose: () => void
  children: ReactNode
  count?: number
}

// One persistent subtree: nonmodal in the grid, showModal() on narrow screens.
export function ResponsivePanel({ id, title, className, open, onClose, children, count }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeHandler = useRef(onClose)
  useEffect(() => {
    closeHandler.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const dialog = ref.current!
    const media = window.matchMedia('(max-width: 720px)')
    const sync = () => {
      if (dialog.open) dialog.close()
      if (media.matches) {
        if (open) dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
    }
    const breakpoint = () => {
      closeHandler.current()
      sync()
    }
    sync()
    media.addEventListener('change', breakpoint)
    const before = document.body.style.overflow
    if (media.matches && open) document.body.style.overflow = 'hidden'
    return () => {
      media.removeEventListener('change', breakpoint)
      document.body.style.overflow = before
      if (dialog.open) dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      id={id}
      className={cn('rail responsive-panel', className)}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose()
      }}
    >
      <div className="rail-head">
        <h2 id={`${id}-title`}>
          {title}
          {count ? <span className="counter">{count}</span> : null}
        </h2>
        <button
          type="button"
          className="icon-btn sheet-close"
          aria-label={`Fechar ${title.toLowerCase()}`}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  )
}
