'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const TOAST_OPTIONS: ToasterProps['toastOptions'] = {
  classNames: {
    toast:
      'group border border-border bg-[#0f1522] text-foreground shadow-[0_20px_60px_rgba(8,14,26,0.45)]',
    title: 'text-sm font-medium text-white',
    description: 'text-xs text-foreground',
    actionButton:
      'bg-[var(--vt-success)] text-foreground hover:bg-[var(--vt-success)]/90',
    cancelButton:
      'border border-border bg-muted text-foreground/60 hover:bg-muted hover:text-foreground',
    closeButton:
      'border border-border bg-black/30 text-foreground hover:bg-muted hover:text-foreground',
  },
}

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      toastOptions={TOAST_OPTIONS}
      {...props}
    />
  )
}

export { Toaster }
