'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { trapFocus, setInert } from '@/lib/accessibility'
import { cn } from '@/lib/utils'

export interface AccessibleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  closeOnEscape?: boolean
  closeOnOutsideClick?: boolean
}

/**
 * AccessibleModal component
 *
 * A fully accessible modal dialog with:
 * - Focus trap
 * - ARIA role dialog
 * - Labelled headers and close buttons
 * - ESC key dismissal
 * - Inert underlying content when open
 */
export function AccessibleModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  closeOnEscape = true,
  closeOnOutsideClick = true,
}: AccessibleModalProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!open) return

    // Store the previously focused element
    previousActiveElementRef.current = document.activeElement as HTMLElement

    // Make body content inert
    const mainContent = document.querySelector('main')
    if (mainContent) {
      setInert(mainContent, true)
    }

    // Trap focus within modal
    let cleanup: (() => void) | undefined
    if (contentRef.current) {
      cleanup = trapFocus(contentRef.current)
    }

    // Handle ESC key
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      // Restore focus to previous element
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus()
      }

      // Remove inert from body content
      if (mainContent) {
        setInert(mainContent, false)
      }

      // Cleanup focus trap
      cleanup?.()

      // Remove ESC handler
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, closeOnEscape, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(className)}
        onPointerDownOutside={(e) => {
          if (!closeOnOutsideClick) {
            e.preventDefault()
          }
        }}
        onInteractOutside={(e) => {
          if (!closeOnOutsideClick) {
            e.preventDefault()
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
      >
        <DialogHeader>
          <DialogTitle id="modal-title">{title}</DialogTitle>
          {description && (
            <DialogDescription id="modal-description">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="py-4">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

