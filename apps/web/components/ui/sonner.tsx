'use client'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const TOAST_OPTIONS: ToasterProps['toastOptions'] = {
  classNames: {
    toast:
      'group border border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-primary)] shadow-[0_20px_60px_rgba(26,24,21,0.16)]',
    title: 'text-sm font-medium text-[var(--vt-text-primary)]',
    description: 'text-xs text-foreground',
    actionButton:
      'bg-[var(--vt-success)] text-foreground hover:bg-[var(--vt-success)]/90',
    cancelButton:
      'border border-border bg-muted text-foreground/60 hover:bg-muted hover:text-foreground',
    closeButton:
      'border border-border bg-muted text-foreground hover:bg-muted hover:text-foreground',
  },
}

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  )
}

export { Toaster }
