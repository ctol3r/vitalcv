'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CircleAlert, Info, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type QualitySignalSeverity = 'critical' | 'high' | 'medium' | 'low'

export type QualitySignal = {
  id: string
  title: string
  summary: string
  severity: QualitySignalSeverity
  timestamp: string
  metric: string
  source?: string
  value?: string
  trend?: 'up' | 'down' | 'flat'
}

type QualitySignalFeedProps = {
  signals: QualitySignal[]
  className?: string
  defaultFilter?: QualitySignalSeverity | 'all'
  onSelect?: (signal: QualitySignal) => void
}

const SEVERITY_ORDER: QualitySignalSeverity[] = ['critical', 'high', 'medium', 'low']

const SEVERITY_CONFIG: Record<
  QualitySignalSeverity,
  {
    label: string
    badgeClass: string
    accent: string
    icon: typeof AlertTriangle
    iconColor: string
  }
> = {
  critical: {
    label: 'Critical',
    badgeClass: 'bg-rose-100 text-rose-900',
    accent: 'border-rose-200 bg-rose-50',
    icon: ShieldAlert,
    iconColor: 'text-rose-600',
  },
  high: {
    label: 'High',
    badgeClass: 'bg-amber-100 text-amber-900',
    accent: 'border-amber-200 bg-amber-50',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
  },
  medium: {
    label: 'Medium',
    badgeClass: 'bg-sky-100 text-sky-900',
    accent: 'border-sky-200 bg-sky-50',
    icon: CircleAlert,
    iconColor: 'text-sky-600',
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-emerald-100 text-emerald-900',
    accent: 'border-emerald-200 bg-emerald-50',
    icon: Info,
    iconColor: 'text-emerald-600',
  },
}

const FILTERS: Array<{ value: QualitySignalSeverity | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function QualitySignalFeed({ signals, className, defaultFilter = 'all', onSelect }: QualitySignalFeedProps) {
  const [filter, setFilter] = useState<QualitySignalSeverity | 'all'>(defaultFilter)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') {
      return signals
    }
    return signals.filter((signal) => signal.severity === filter)
  }, [signals, filter])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filtered.some((signal) => signal.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  const selectedSignal = filtered.find((signal) => signal.id === selectedId) ?? null

  const grouped = useMemo(() => {
    return SEVERITY_ORDER.map((severity) => ({
      severity,
      items: filtered.filter((signal) => signal.severity === severity),
    })).filter((group) => group.items.length > 0)
  }, [filtered])

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Quality signal feed</CardTitle>
            <CardDescription>Grouped severity feed with inline drill-down.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Quality signal filters">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filter === option.value ? 'default' : 'outline'}
                className={cn(
                  'rounded-full',
                  filter === option.value ? 'bg-primary text-primary-foreground' : 'bg-background',
                )}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signals matched the selected filter.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => {
              const config = SEVERITY_CONFIG[group.severity]
              const Icon = config.icon
              return (
                <section key={group.severity} aria-label={`${config.label} severity signals`} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Badge className={config.badgeClass}>{config.label}</Badge>
                    <span className="text-muted-foreground">{group.items.length} signals</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((signal) => (
                      <button
                        key={signal.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(signal.id)
                          onSelect?.(signal)
                        }}
                        className={cn(
                          'flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selectedId === signal.id ? config.accent : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', config.iconColor)} aria-hidden="true" />
                            <p className="font-semibold">{signal.title}</p>
                          </div>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {formatRelative(signal.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{signal.summary}</p>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>
                            Metric: <span className="font-medium text-foreground">{signal.metric}</span>
                          </span>
                          {signal.value && (
                            <span>
                              Value: <span className="font-medium text-foreground">{signal.value}</span>
                            </span>
                          )}
                          {signal.source && (
                            <span>
                              Source: <span className="font-medium text-foreground">{signal.source}</span>
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
        {selectedSignal && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected signal detail</p>
            <h4 className="mt-1 text-lg font-semibold">{selectedSignal.title}</h4>
            <p className="text-sm text-muted-foreground">{selectedSignal.summary}</p>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Metric</dt>
                <dd className="font-medium">{selectedSignal.metric}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Observed value</dt>
                <dd className="font-medium">{selectedSignal.value ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium">{selectedSignal.source ?? 'Multiple feeds'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Captured</dt>
                <dd className="font-medium">{new Date(selectedSignal.timestamp).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatRelative(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60000))
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}


