// Adapted from shadcn/ui (MIT): Radix behavior, recortes visual tokens.
import type { ComponentProps } from 'react'
import { Dialog as Primitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = Primitive.Root
export const DialogClose = Primitive.Close
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description

export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content className={cn('dialog-content', className)} {...props}>
        {children}
        <Primitive.Close className="icon-btn dialog-close" aria-label="Fechar janela">
          <X />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  )
}
