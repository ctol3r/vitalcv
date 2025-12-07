'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Bell, ShieldAlert } from 'lucide-react'

export type SentinelAlert = {
  id: string
  clinicianId?: string
  clinicianName?: string
  department?: string
  privilegeId?: string
  privilegeName?: string
  signalType: 'oppe-drift' | 'complication-cluster' | 'risk-trend' | 'enrollment-anomaly'
  severity: 'critical' | 'high' | 'medium'
  anomalyScore: number
  threshold: number
  timestamp: string
  description: string
  supervisorAgentNotified?: boolean
}

type SentinelAlertsProps = {
  alerts: SentinelAlert[]
  className?: string
  title?: string
  description?: string
  onAlertClick?: (alert: SentinelAlert) => void
  onSupervisorAgentTrigger?: (alert: SentinelAlert) => void
}

const SEVERITY_COLORS: Record<SentinelAlert['severity'], string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
}

const SEVERITY_ICONS: Record<SentinelAlert['severity'], typeof AlertTriangle> = {
  critical: ShieldAlert,
  high: AlertTriangle,
  medium: Bell,
}

const SIGNAL_TYPE_LABELS: Record<SentinelAlert['signalType'], string> = {
  'oppe-drift': 'OPPE drift',
  'complication-cluster': 'Complication cluster',
  'risk-trend': 'Risk micro-trend',
  'enrollment-anomaly': 'Enrollment anomaly',
}

export function SentinelAlerts({
  alerts,
  className,
  title = 'Early-warning alerts',
  description = 'Alerts when anomalies surpass threshold',
  onAlertClick,
  onSupervisorAgentTrigger,
}: SentinelAlertsProps) {
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())

  const activeAlerts = useMemo(() => {
    return alerts
      .filter((a) => !acknowledgedAlerts.has(a.id))
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 }
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
        if (severityDiff !== 0) return severityDiff
        return b.anomalyScore - a.anomalyScore
      })
  }, [alerts, acknowledgedAlerts])

  const acknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts((prev) => new Set([...prev, alertId]))
  }

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length
  const highCount = activeAlerts.filter((a) => a.severity === 'high').length
  const mediumCount = activeAlerts.filter((a) => a.severity === 'medium').length

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
          <p className="text-sm text-muted-foreground">No active alerts. All anomalies are below threshold.</p>
        </CardContent>
      </Card>
    )
  }

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
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        alert.severity === 'critical' ? 'text-rose-600' : alert.severity === 'high' ? 'text-amber-600' : 'text-sky-600',
                      )}
                      aria-hidden="true"
                    />
                    <Badge variant="outline" className={cn('text-xs font-semibold', SEVERITY_COLORS[alert.severity])}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {SIGNAL_TYPE_LABELS[alert.signalType]}
                    </Badge>
                    {alert.supervisorAgentNotified && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-900 border-purple-200 text-xs">
                        SupervisorAgent notified
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(alert.timestamp)}</span>
                  </div>

                  {alert.clinicianName && (
                    <p className="text-sm font-semibold">
                      {alert.clinicianName}
                      {alert.department && <span className="text-muted-foreground"> • {alert.department}</span>}
                    </p>
                  )}

                  {alert.privilegeName && <p className="text-sm text-muted-foreground">{alert.privilegeName}</p>}

                  <p className="text-sm text-muted-foreground">{alert.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Anomaly score</span>
                      <p className="font-semibold">{Math.round(alert.anomalyScore)}%</p>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Threshold</span>
                      <p className="font-medium">{Math.round(alert.threshold)}%</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {onAlertClick && (
                    <Button variant="outline" size="sm" onClick={() => onAlertClick(alert)} className="whitespace-nowrap">
                      View details
                    </Button>
                  )}
                  {onSupervisorAgentTrigger && !alert.supervisorAgentNotified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSupervisorAgentTrigger(alert)}
                      className="whitespace-nowrap text-xs"
                    >
                      Notify SupervisorAgent
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => acknowledgeAlert(alert.id)} className="whitespace-nowrap text-xs">
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

