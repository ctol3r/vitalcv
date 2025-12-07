'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, X, CheckCircle2, Clock, ExternalLink, Bell } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW'

type AuditAlert = {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  obligation: string
  dueDate: string
  recommendedActions: string[]
  acknowledged: boolean
  resolved: boolean
  createdAt: string
}

type AuditAlertsNotificationProps = {
  alerts?: AuditAlert[]
  onAcknowledge?: (alertId: string) => void
  onResolve?: (alertId: string) => void
  realTime?: boolean
}

export function AuditAlertsNotification({
  alerts: initialAlerts,
  onAcknowledge,
  onResolve,
  realTime = true,
}: AuditAlertsNotificationProps) {
  const [alerts, setAlerts] = useState<AuditAlert[]>(initialAlerts || buildMockAlerts())
  const [isMinimized, setIsMinimized] = useState(false)

  // Simulate real-time updates
  useEffect(() => {
    if (!realTime) return

    const interval = setInterval(() => {
      // In a real app, this would poll the AuditAlertService
      // For now, we'll just simulate occasional new alerts
      if (Math.random() > 0.95) {
        const newAlert: AuditAlert = {
          id: `alert-${Date.now()}`,
          severity: ['HIGH', 'MEDIUM', 'LOW'][Math.floor(Math.random() * 3)] as AlertSeverity,
          title: 'New Compliance Alert',
          description: 'A new compliance issue has been detected.',
          obligation: 'GDPR-001',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          recommendedActions: ['Review the issue', 'Take corrective action'],
          acknowledged: false,
          resolved: false,
          createdAt: new Date().toISOString(),
        }
        setAlerts((prev) => [newAlert, ...prev])
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [realTime])

  const handleAcknowledge = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert)),
    )
    onAcknowledge?.(alertId)
  }

  const handleResolve = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, resolved: true, acknowledged: true } : alert)),
    )
    onResolve?.(alertId)
  }

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged && !a.resolved)
  const highPriorityAlerts = unacknowledgedAlerts.filter((a) => a.severity === 'HIGH')

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full shadow-lg"
          size="lg"
        >
          <Bell className="h-5 w-5 mr-2" aria-hidden="true" />
          {unacknowledgedAlerts.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unacknowledgedAlerts.length}
            </Badge>
          )}
        </Button>
      </div>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] z-50 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>Audit Alerts</CardTitle>
            {unacknowledgedAlerts.length > 0 && (
              <Badge variant="destructive">{unacknowledgedAlerts.length}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <CardDescription>
          Real-time compliance alerts and notifications. {highPriorityAlerts.length > 0 && (
            <span className="text-destructive font-medium">
              {highPriorityAlerts.length} high priority alert{highPriorityAlerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-y-auto max-h-[500px]">
        {unacknowledgedAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          unacknowledgedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-md border p-3 space-y-2',
                alert.severity === 'HIGH' && 'border-rose-300 bg-rose-50',
                alert.severity === 'MEDIUM' && 'border-amber-300 bg-amber-50',
                alert.severity === 'LOW' && 'border-blue-300 bg-blue-50',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle
                      className={cn(
                        'h-4 w-4',
                        alert.severity === 'HIGH' && 'text-rose-600',
                        alert.severity === 'MEDIUM' && 'text-amber-600',
                        alert.severity === 'LOW' && 'text-blue-600',
                      )}
                      aria-hidden="true"
                    />
                    <h4 className="font-medium text-sm">{alert.title}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        alert.severity === 'HIGH' && 'border-rose-300 text-rose-900',
                        alert.severity === 'MEDIUM' && 'border-amber-300 text-amber-900',
                        alert.severity === 'LOW' && 'border-blue-300 text-blue-900',
                      )}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{alert.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>Obligation: {alert.obligation}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Due: {new Date(alert.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                  {alert.recommendedActions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Recommended Actions:</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                        {alert.recommendedActions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAcknowledge(alert.id)}
                >
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleResolve(alert.id)}
                >
                  Resolve
                </Button>
              </div>
            </div>
          ))
        )}

        {/* Show resolved alerts count */}
        {alerts.filter((a) => a.resolved).length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              {alerts.filter((a) => a.resolved).length} resolved alert
              {alerts.filter((a) => a.resolved).length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildMockAlerts(): AuditAlert[] {
  return [
    {
      id: 'alert-001',
      severity: 'HIGH',
      title: 'CCPA Data Deletion Request Overdue',
      description: 'Consumer data deletion request has exceeded the 45-day response window.',
      obligation: 'CCPA-001',
      dueDate: '2025-11-20',
      recommendedActions: [
        'Review the pending deletion request',
        'Complete data deletion within 24 hours',
        'Update compliance records',
      ],
      acknowledged: false,
      resolved: false,
      createdAt: '2025-11-15T10:00:00Z',
    },
    {
      id: 'alert-002',
      severity: 'MEDIUM',
      title: 'HIPAA Risk Assessment Due',
      description: 'Annual HIPAA risk assessment must be completed within 30 days.',
      obligation: 'HIPAA-001',
      dueDate: '2025-11-25',
      recommendedActions: [
        'Schedule risk assessment meeting',
        'Review current security controls',
        'Document findings',
      ],
      acknowledged: false,
      resolved: false,
      createdAt: '2025-11-14T09:00:00Z',
    },
    {
      id: 'alert-003',
      severity: 'LOW',
      title: 'GDPR DPO Training Reminder',
      description: 'Data Protection Officer training certification expires next month.',
      obligation: 'GDPR-001',
      dueDate: '2025-12-01',
      recommendedActions: ['Enroll in DPO training course', 'Complete certification renewal'],
      acknowledged: false,
      resolved: false,
      createdAt: '2025-11-13T14:00:00Z',
    },
  ]
}

