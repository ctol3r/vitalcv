'use client'

import { useMemo, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Bell, ShieldAlert } from 'lucide-react'

export type RiskThreshold = {
  horizon: '7d' | '14d' | '30d' | '60d'
  critical: number // e.g., 80
  high: number // e.g., 65
  medium: number // e.g., 50
}

export type PredictedRisk = {
  id: string
  privilegeId?: string
  privilegeName?: string
  horizon: '7d' | '14d' | '30d' | '60d'
  value: number
  timestamp: string
  category?: string
}

export type SafetyAlert = {
  id: string
  privilegeId?: string
  privilegeName?: string
  horizon: '7d' | '14d' | '30d' | '60d'
  severity: 'critical' | 'high' | 'medium'
  currentRisk: number
  thresholdCrossed: number
  timestamp: string
  autoHoldTriggered?: boolean
}

type SafetyAlertsProps = {
  risks: PredictedRisk[]
  thresholds: RiskThreshold[]
  className?: string
  title?: string
  description?: string
  onAutoHoldTrigger?: (alert: SafetyAlert) => void
  onAlertClick?: (alert: SafetyAlert) => void
}

const SEVERITY_COLORS: Record<SafetyAlert['severity'], string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
}

const SEVERITY_ICONS: Record<SafetyAlert['severity'], typeof AlertTriangle> = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: Bell,
}

const HORIZON_LABELS: Record<SafetyAlert['horizon'], string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '60d': '60 days',
}

export function SafetyAlerts({
  risks,
  thresholds,
  className,
  title = 'Predictive safety alerts',
  description = 'Alerts when predicted risk crosses safety thresholds',
  onAutoHoldTrigger,
  onAlertClick,
}: SafetyAlertsProps) {
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())

  const alerts = useMemo(() => {
    const alertList: SafetyAlert[] = []

    risks.forEach((risk) => {
      const threshold = thresholds.find((t) => t.horizon === risk.horizon)
      if (!threshold) return

      let severity: SafetyAlert['severity'] | null = null
      let thresholdCrossed = 0

      if (risk.value >= threshold.critical) {
        severity = 'critical'
        thresholdCrossed = threshold.critical
      } else if (risk.value >= threshold.high) {
        severity = 'high'
        thresholdCrossed = threshold.high
      } else if (risk.value >= threshold.medium) {
        severity = 'medium'
        thresholdCrossed = threshold.medium
      }

      if (severity) {
        const alert: SafetyAlert = {
          id: `${risk.id}-${risk.horizon}`,
          privilegeId: risk.privilegeId,
          privilegeName: risk.privilegeName,
          horizon: risk.horizon,
          severity,
          currentRisk: risk.value,
          thresholdCrossed,
          timestamp: risk.timestamp,
          autoHoldTriggered: severity === 'critical',
        }

        // Auto-hold logic: trigger for critical alerts
        if (severity === 'critical' && onAutoHoldTrigger) {
          // Debounce: only trigger if not already acknowledged
          if (!acknowledgedAlerts.has(alert.id)) {
            setTimeout(() => {
              onAutoHoldTrigger(alert)
            }, 0)
          }
        }

        alertList.push(alert)
      }
    })

    // Sort by severity (critical first) then by risk value
    return alertList.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return b.currentRisk - a.currentRisk
    })
  }, [risks, thresholds, acknowledgedAlerts, onAutoHoldTrigger])

  const activeAlerts = alerts.filter((a) => !acknowledgedAlerts.has(a.id))

  const acknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts((prev) => new Set([...prev, alertId]))
  }

  if (activeAlerts.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active alerts. All predicted risks are below thresholds.</p>
        </CardContent>
      </Card>
    )
  }

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length
  const highCount = activeAlerts.filter((a) => a.severity === 'high').length
  const mediumCount = activeAlerts.filter((a) => a.severity === 'medium').length

  return (
    <Card className={cn('border-rose-200 bg-rose-50/30', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {(criticalCount > 0 || highCount > 0 || mediumCount > 0) && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-600" aria-hidden="true" />
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" />
                {highCount} high
              </span>
            )}
            {mediumCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-600" aria-hidden="true" />
                {mediumCount} medium
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {activeAlerts.map((alert) => {
          const Icon = SEVERITY_ICONS[alert.severity]
          return (
            <article
              key={alert.id}
              className={cn(
                'rounded-lg border bg-background p-4 transition-shadow',
                alert.severity === 'critical' && 'border-rose-300 shadow-sm',
                alert.severity === 'high' && 'border-amber-300',
                alert.severity === 'medium' && 'border-sky-300',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon className={cn('h-4 w-4', alert.severity === 'critical' ? 'text-rose-600' : alert.severity === 'high' ? 'text-amber-600' : 'text-sky-600')} aria-hidden="true" />
                    <Badge variant="outline" className={cn('text-xs font-semibold', SEVERITY_COLORS[alert.severity])}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    {alert.autoHoldTriggered && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-900 border-purple-200 text-xs">
                        Auto-hold triggered
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{HORIZON_LABELS[alert.horizon]}</span>
                  </div>

                  {alert.privilegeName && (
                    <p className="text-sm font-semibold">{alert.privilegeName}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Current risk</span>
                      <p className="font-semibold">{Math.round(alert.currentRisk)}%</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Threshold</span>
                      <p className="font-medium">{Math.round(alert.thresholdCrossed)}%</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Time</span>
                      <p className="font-medium text-xs">{formatRelativeTime(alert.timestamp)}</p>
                    </div>
                  </div>

                  {alert.autoHoldTriggered && (
                    <p className="text-xs text-muted-foreground">
                      SafetyRadar automatically triggered a hold for this privilege pending committee review.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {onAlertClick && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAlertClick(alert)}
                      className="whitespace-nowrap"
                    >
                      View details
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="whitespace-nowrap text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </CardContent>
    </Card>
  )
}

function formatRelativeTime(input: string) {
  const target = new Date(input)
  const now = new Date()
  const diffMs = now.getTime() - target.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
}

