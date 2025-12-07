'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Bell, TrendingDown, ShieldAlert, Clock } from 'lucide-react'

export type ForecastAlert = {
  id: string
  type: 'critical_demand' | 'supply_drop' | 'privilege_renewal'
  severity: 'critical' | 'high' | 'medium'
  title: string
  description: string
  department?: string
  role?: string
  affectedCount?: number
  impactDate: string
  timestamp: string
  actionable?: boolean
  relatedForecastId?: string
}

type ForecastAlertsProps = {
  alerts: ForecastAlert[]
  className?: string
  title?: string
  description?: string
  onAlertClick?: (alert: ForecastAlert) => void
  onDismiss?: (alertId: string) => void
}

const SEVERITY_COLORS: Record<ForecastAlert['severity'], string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
}

const TYPE_ICONS: Record<ForecastAlert['type'], typeof AlertTriangle> = {
  critical_demand: ShieldAlert,
  supply_drop: TrendingDown,
  privilege_renewal: Clock,
}

const TYPE_LABELS: Record<ForecastAlert['type'], string> = {
  critical_demand: 'Critical Demand',
  supply_drop: 'Supply Drop',
  privilege_renewal: 'Privilege Renewal',
}

export function ForecastAlerts({
  alerts,
  className,
  title = 'Forecast alerts',
  description = 'Alerts for critical demand, supply drops, and privilege renewals affecting coverage',
  onAlertClick,
  onDismiss,
}: ForecastAlertsProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())

  const activeAlerts = useMemo(() => {
    return alerts
      .filter((a) => !dismissedAlerts.has(a.id))
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 }
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
        if (severityDiff !== 0) return severityDiff
        return new Date(a.impactDate).getTime() - new Date(b.impactDate).getTime()
      })
  }, [alerts, dismissedAlerts])

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]))
    onDismiss?.(alertId)
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
          <p className="text-sm text-muted-foreground">No active alerts. All forecasts are within normal parameters.</p>
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
          const Icon = TYPE_ICONS[alert.type]
          return (
            <article
              key={alert.id}
              className={cn(
                'rounded-lg border bg-background p-4 transition-shadow hover:shadow-sm',
                alert.severity === 'critical' && 'border-rose-300 shadow-sm',
                alert.severity === 'high' && 'border-amber-300',
                alert.severity === 'medium' && 'border-sky-300',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon
                      className={cn('h-4 w-4', alert.severity === 'critical' ? 'text-rose-600' : alert.severity === 'high' ? 'text-amber-600' : 'text-sky-600')}
                      aria-hidden="true"
                    />
                    <Badge variant="outline" className={cn('text-xs font-semibold', SEVERITY_COLORS[alert.severity])}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[alert.type]}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {alert.department && alert.role && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Department</span>
                        <p className="font-medium text-xs">
                          {alert.department} • {alert.role}
                        </p>
                      </div>
                    )}
                    {alert.affectedCount !== undefined && (
                      <div>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Affected</span>
                        <p className="font-semibold">{alert.affectedCount} clinicians</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Impact Date</span>
                      <p className="font-medium text-xs">{formatDate(alert.impactDate)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {onAlertClick && (
                    <Button variant="outline" size="sm" onClick={() => onAlertClick(alert)} className="whitespace-nowrap">
                      View details
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDismiss(alert.id)} className="whitespace-nowrap text-xs">
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

function formatDate(input: string) {
  const date = new Date(input)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

