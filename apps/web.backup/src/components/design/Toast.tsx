'use client'

import * as React from 'react'
import { XIcon, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center gap-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-background text-foreground',
        success: 'border-success bg-success/10 text-success-foreground',
        error: 'border-destructive bg-destructive/10 text-destructive',
        warning: 'border-warning bg-warning/10 text-warning-foreground',
        info: 'border-info bg-info/10 text-info-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface ToastProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  duration?: number
  onClose?: () => void
  action?: React.ReactNode
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      className,
      variant,
      title,
      description,
      duration = 5000,
      onClose,
      action,
      ...props
    },
    ref,
  ) => {
    const [isVisible, setIsVisible] = React.useState(true)
    const timeoutRef = React.useRef<NodeJS.Timeout>()

    React.useEffect(() => {
      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          setIsVisible(false)
          setTimeout(() => onClose?.(), 300) // Wait for animation
        }, duration)
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [duration, onClose])

    const handleClose = () => {
      setIsVisible(false)
      setTimeout(() => onClose?.(), 300)
    }

    const icons = {
      success: CheckCircle2,
      error: AlertCircle,
      warning: AlertTriangle,
      info: Info,
      default: Info,
    }

    const Icon = icons[variant || 'default']

    if (!isVisible) return null

    return (
      <div
        ref={ref}
        data-slot="toast"
        className={cn(toastVariants({ variant, className }))}
        role="alert"
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        {...props}
      >
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {title && (
            <div
              data-slot="toast-title"
              className="text-sm font-semibold [&+div]:text-xs"
            >
              {title}
            </div>
          )}
          {description && (
            <div data-slot="toast-description" className="text-sm opacity-90">
              {description}
            </div>
          )}
        </div>
        {action && (
          <div data-slot="toast-action" className="flex-shrink-0">
            {action}
          </div>
        )}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          aria-label="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    )
  },
)
Toast.displayName = 'Toast'

export interface ToastContainerProps {
  toasts: Array<ToastProps & { id: string }>
  onRemove: (id: string) => void
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
}

function ToastContainer({
  toasts,
  onRemove,
  position = 'bottom-right',
}: ToastContainerProps) {
  const positionClasses = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'top-center': 'top-0 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
  }

  return (
    <div
      data-slot="toast-container"
      className={cn(
        'pointer-events-none fixed z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]',
        positionClasses[position],
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  )
}

export { Toast, ToastContainer, toastVariants }

