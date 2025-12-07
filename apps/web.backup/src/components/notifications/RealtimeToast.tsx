'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, Info, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ToastTone = 'info' | 'success' | 'warning' | 'critical'

export type RealtimeToastNotification = {
  id: string
  title: string
  body?: string
  tone?: ToastTone
  timestamp?: string
  actionLabel?: string
  onAction?: () => void
}

type RealtimeToastProps = {
  notification: RealtimeToastNotification | null
  onDismiss?: (id?: string) => void
  autoDismissMs?: number
}

const toneConfig: Record<
  ToastTone,
  {
    icon: typeof BellRing
    container: string
    badge: string
  }
> = {
  info: {
    icon: BellRing,
    container: 'border-sky-200 bg-sky-50/95',
    badge: 'bg-sky-100 text-sky-900',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-emerald-200 bg-emerald-50/95',
    badge: 'bg-emerald-100 text-emerald-900',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-amber-200 bg-amber-50/95',
    badge: 'bg-amber-100 text-amber-900',
  },
  critical: {
    icon: AlertTriangle,
    container: 'border-rose-200 bg-rose-50/95',
    badge: 'bg-rose-100 text-rose-900',
  },
}

export function RealtimeToast({ notification, onDismiss, autoDismissMs = 6000 }: RealtimeToastProps) {
  const tone = toneConfig[notification?.tone ?? 'info']

  useEffect(() => {
    if (!notification || autoDismissMs <= 0) {
      return
    }
    const timer = setTimeout(() => onDismiss?.(notification.id), autoDismissMs)
    return () => clearTimeout(timer)
  }, [notification, autoDismissMs, onDismiss])

  if (!notification) {
    return null
  }

  const Icon = tone.icon

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:justify-end md:px-6 lg:px-8">
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          'pointer-events-auto w-full max-w-sm rounded-xl border shadow-lg shadow-black/10 backdrop-blur',
          tone.container
        )}
      >
        <div className="flex gap-3 p-4">
          <span className="sr-only">{notification.tone ?? 'info'} notification</span>
          <span className={cn('mt-1 flex h-10 w-10 items-center justify-center rounded-full', tone.badge)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                {notification.body && <p className="text-sm text-muted-foreground">{notification.body}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDismiss?.(notification.id)}
                aria-label="Dismiss alert"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {notification.timestamp && (
                <time dateTime={notification.timestamp}>
                  {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              )}
              {notification.actionLabel && notification.onAction && (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-foreground underline-offset-2"
                  onClick={() => notification.onAction?.()}
                >
                  {notification.actionLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function useRealtimeToastQueue(autoDismissMs = 6000) {
  const [queue, setQueue] = useState<RealtimeToastNotification[]>([])
  const [active, setActive] = useState<RealtimeToastNotification | null>(null)

  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0])
      setQueue((prev) => prev.slice(1))
    }
  }, [queue, active])

  const pushToast = useCallback((notification: RealtimeToastNotification) => {
    setQueue((prev) => [...prev, notification])
  }, [])

  const dismissToast = useCallback((id?: string) => {
    setActive((current) => {
      if (!current) {
        return null
      }
      if (!id || current.id === id) {
        return null
      }
      return current
    })
  }, [])

  return useMemo(
    () => ({
      toast: active,
      pushToast,
      dismissToast,
      autoDismissMs,
      queueSize: queue.length,
    }),
    [active, pushToast, dismissToast, autoDismissMs, queue.length]
  )
}


