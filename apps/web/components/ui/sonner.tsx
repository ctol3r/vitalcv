'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

const TOAST_OPTIONS: ToasterProps['toastOptions'] = {
  classNames: {
    toast:
      'group border border-white/10 bg-[#0f1522] text-white shadow-[0_20px_60px_rgba(8,14,26,0.45)]',
    title: 'text-sm font-medium text-white',
    description: 'text-xs text-white/55',
    actionButton:
      'bg-[var(--vt-success)] text-white hover:bg-[var(--vt-success)]/90',
    cancelButton:
      'border border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white',
    closeButton:
      'border border-white/10 bg-black/30 text-white/55 hover:bg-white/10 hover:text-white',
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
