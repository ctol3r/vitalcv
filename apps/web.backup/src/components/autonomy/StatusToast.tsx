'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export type AutonomyEventType =
  | 'issuance'
  | 'revocation'
  | 'override'
  | 'bias_flagged'
  | 'kill_switch'
  | 'compliance_violation'

export interface AutonomyStatusNotification {
  id: string
  type: AutonomyEventType
  title: string
  message: string
  timestamp: string
  severity?: 'info' | 'warning' | 'error' | 'success'
  actionId?: string
  linkTo?: string
  metadata?: Record<string, unknown>
}

interface StatusToastProps {
  notification: AutonomyStatusNotification | null
  onDismiss?: (id?: string) => void
  autoDismissMs?: number
}

const eventConfig: Record<
  AutonomyEventType,
  {
    icon: typeof Info
    defaultSeverity: 'info' | 'warning' | 'error' | 'success'
    container: string
    badge: string
  }
> = {
  issuance: {
    icon: CheckCircle2,
    defaultSeverity: 'success',
    container: 'border-emerald-200 bg-emerald-50/95',
    badge: 'bg-emerald-100 text-emerald-900',
  },
  revocation: {
    icon: AlertTriangle,
    defaultSeverity: 'warning',
    container: 'border-amber-200 bg-amber-50/95',
    badge: 'bg-amber-100 text-amber-900',
  },
  override: {
    icon: ShieldAlert,
    defaultSeverity: 'warning',
    container: 'border-orange-200 bg-orange-50/95',
    badge: 'bg-orange-100 text-orange-900',
  },
  bias_flagged: {
    icon: AlertTriangle,
    defaultSeverity: 'error',
    container: 'border-red-200 bg-red-50/95',
    badge: 'bg-red-100 text-red-900',
  },
  kill_switch: {
    icon: ShieldAlert,
    defaultSeverity: 'error',
    container: 'border-red-200 bg-red-50/95',
    badge: 'bg-red-100 text-red-900',
  },
  compliance_violation: {
    icon: ShieldAlert,
    defaultSeverity: 'error',
    container: 'border-red-200 bg-red-50/95',
    badge: 'bg-red-100 text-red-900',
  },
}

export function StatusToast({
  notification,
  onDismiss,
  autoDismissMs = 6000,
}: StatusToastProps) {
  const router = useRouter()
  const config = notification ? eventConfig[notification.type] : null

  useEffect(() => {
    if (!notification || autoDismissMs <= 0) {
      return
    }
    const timer = setTimeout(() => onDismiss?.(notification.id), autoDismissMs)
    return () => clearTimeout(timer)
  }, [notification, autoDismissMs, onDismiss])

  if (!notification || !config) {
    return null
  }

  const Icon = config.icon
  const severity = notification.severity || config.defaultSeverity

  function handleViewDetails() {
    if (notification.linkTo) {
      router.push(notification.linkTo)
      onDismiss?.(notification.id)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 md:justify-end md:px-6 lg:px-8">
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className={cn(
          'pointer-events-auto w-full max-w-md rounded-xl border shadow-lg shadow-black/10 backdrop-blur',
          config.container
        )}
      >
        <div className="flex gap-3 p-4">
          <span className="sr-only">
            {notification.type.replace('_', ' ')} notification - {severity}
          </span>
          <span className={cn('mt-1 flex h-10 w-10 items-center justify-center rounded-full', config.badge)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDismiss?.(notification.id)}
                aria-label="Dismiss notification"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <time dateTime={notification.timestamp}>
                {new Date(notification.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              {notification.linkTo && (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-foreground underline-offset-2"
                  onClick={handleViewDetails}
                >
                  View Details
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function useAutonomyToastQueue(autoDismissMs = 6000) {
  const [queue, setQueue] = useState<AutonomyStatusNotification[]>([])
  const [active, setActive] = useState<AutonomyStatusNotification | null>(null)

  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0])
      setQueue((prev) => prev.slice(1))
    }
  }, [queue, active])

  const pushToast = useCallback((notification: AutonomyStatusNotification) => {
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

// Helper function to create notifications for common events
export function createAutonomyNotification(
  type: AutonomyEventType,
  title: string,
  message: string,
  options?: {
    actionId?: string
    linkTo?: string
    severity?: 'info' | 'warning' | 'error' | 'success'
    metadata?: Record<string, unknown>
  }
): AutonomyStatusNotification {
  return {
    id: `autonomy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    severity: options?.severity,
    actionId: options?.actionId,
    linkTo: options?.linkTo,
    metadata: options?.metadata,
  }
}

// Example usage helpers
export const AutonomyNotifications = {
  issuance: (target: string, actionId?: string) =>
    createAutonomyNotification(
      'issuance',
      'Credential Issued',
      `Credential automatically issued for ${target}`,
      {
        actionId,
        linkTo: actionId ? `/demo/org/autonomy/control?action=${actionId}` : undefined,
      }
    ),

  revocation: (target: string, reason: string, actionId?: string) =>
    createAutonomyNotification(
      'revocation',
      'Credential Revoked',
      `Credential revoked for ${target}: ${reason}`,
      {
        actionId,
        linkTo: actionId ? `/demo/org/autonomy/control?action=${actionId}` : undefined,
        severity: 'warning',
      }
    ),

  override: (actionId: string, initiatedBy: string) =>
    createAutonomyNotification(
      'override',
      'Manual Override',
      `Autonomous action ${actionId} overridden by ${initiatedBy}`,
      {
        actionId,
        linkTo: `/demo/org/autonomy/control?override=${actionId}`,
        severity: 'warning',
      }
    ),

  biasFlagged: (type: string, affectedCount: number) =>
    createAutonomyNotification(
      'bias_flagged',
      'Bias Detected',
      `${type} bias detected affecting ${affectedCount} actions`,
      {
        linkTo: '/demo/system/ethics',
        severity: 'error',
        metadata: { biasType: type, affectedCount },
      }
    ),

  killSwitch: (activated: boolean) =>
    createAutonomyNotification(
      'kill_switch',
      activated ? 'Kill Switch Activated' : 'Kill Switch Deactivated',
      activated
        ? 'All autonomous workflows have been halted'
        : 'Autonomous workflows have been resumed',
      {
        linkTo: '/demo/org/autonomy/control',
        severity: 'error',
      }
    ),

  complianceViolation: (regulation: string, actionId: string) =>
    createAutonomyNotification(
      'compliance_violation',
      'Compliance Violation',
      `Action ${actionId} violates ${regulation} requirements`,
      {
        actionId,
        linkTo: `/demo/org/autonomy/compliance?action=${actionId}`,
        severity: 'error',
        metadata: { regulation },
      }
    ),
}

