'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Activity, RefreshCw, Shield, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type SignalType = 'DRIFT' | 'SAFETY' | 'QUALITY' | 'ENROLLMENT'
type SignalSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

interface Signal {
  id: string
  type: SignalType
  severity: SignalSeverity
  label: string
  value: number
  timestamp: string
  metadata?: Record<string, any> | null
}

type SignalResponse = {
  signals: Signal[]
}

const SEVERITY_COLORS: Record<SignalSeverity, string> = {
  CRITICAL: 'bg-rose-500 border-rose-600',
  HIGH: 'bg-amber-500 border-amber-600',
  MEDIUM: 'bg-sky-500 border-sky-600',
  LOW: 'bg-emerald-500 border-emerald-600',
  INFO: 'bg-slate-500 border-slate-600',
}

const SEVERITY_BADGES: Record<SignalSeverity, string> = {
  CRITICAL: 'bg-rose-50 text-rose-900 border-rose-200',
  HIGH: 'bg-amber-50 text-amber-900 border-amber-200',
  MEDIUM: 'bg-sky-50 text-sky-900 border-sky-200',
  LOW: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  INFO: 'bg-slate-50 text-slate-900 border-slate-200',
}

const TYPE_ICONS: Record<SignalType, typeof Activity> = {
  DRIFT: TrendingUp,
  SAFETY: Shield,
  QUALITY: Activity,
  ENROLLMENT: AlertTriangle,
}

export function SignalMonitor() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/demo/org/supervisor/signals', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load signals (${response.status})`)
        }
        const payload = (await response.json()) as SignalResponse
        if (!cancelled) {
          setSignals(payload.signals)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load signals')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const interval = setInterval(load, 10000) // Refresh every 10 seconds for live feed
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  const signalsByType = signals.reduce(
    (acc, signal) => {
      if (!acc[signal.type]) {
        acc[signal.type] = []
      }
      acc[signal.type].push(signal)
      return acc
    },
    {} as Record<SignalType, Signal[]>
  )

  const severityCounts = signals.reduce(
    (acc, signal) => {
      acc[signal.severity] = (acc[signal.severity] || 0) + 1
      return acc
    },
    {} as Record<SignalSeverity, number>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Signal Monitor
            </CardTitle>
            <CardDescription>Live feed of drift/safety/quality/enrollment signals</CardDescription>
          </div>
          <RefreshCw className={cn('h-4 w-4 text-muted-foreground', loading && 'animate-spin')} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {(Object.keys(SEVERITY_COLORS) as SignalSeverity[]).map((severity) => (
            <div key={severity} className="rounded-lg border bg-muted/30 p-2 text-center">
              <div className="text-xs text-muted-foreground">{severity}</div>
              <div className="text-lg font-bold">{severityCounts[severity] || 0}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading signals…</div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(TYPE_ICONS) as SignalType[]).map((type) => {
              const typeSignals = signalsByType[type] || []
              if (typeSignals.length === 0) return null

              const Icon = TYPE_ICONS[type]
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {type} ({typeSignals.length})
                  </div>
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    {typeSignals.slice(0, 5).map((signal) => (
                      <div key={signal.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full border',
                              SEVERITY_COLORS[signal.severity]
                            )}
                            aria-label={`${signal.severity} severity`}
                          />
                          <span className="font-medium">{signal.label}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', SEVERITY_BADGES[signal.severity])}
                        >
                          {signal.severity}
                        </Badge>
                      </div>
                    ))}
                    {typeSignals.length > 5 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{typeSignals.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {signals.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No signals available.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

