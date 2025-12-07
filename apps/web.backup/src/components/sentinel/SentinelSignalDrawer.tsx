'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp, Clock, Link2 } from 'lucide-react'

export type SentinelSignalSeverity = 'critical' | 'high' | 'medium' | 'low'

export type SentinelSignal = {
  id: string
  label: string
  severity: SentinelSignalSeverity
  zScore: number
  anomalyScore: number
  timestamp: string
  summary: string
  eventHistory: Array<{
    id: string
    timestamp: string
    event: string
    value: number
  }>
  causalLinks?: Array<{
    id: string
    type: 'correlation' | 'temporal' | 'causal'
    description: string
    strength: number
    relatedSignal?: string
  }>
}

export type SentinelSignalDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  signal: SentinelSignal | null
}

const SEVERITY_COLORS: Record<SentinelSignalSeverity, string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
  low: 'bg-emerald-50 text-emerald-900 border-emerald-200',
}

const LINK_TYPE_LABELS: Record<'correlation' | 'temporal' | 'causal', string> = {
  correlation: 'Correlation',
  temporal: 'Temporal',
  causal: 'Causal',
}

export function SentinelSignalDrawer({ open, onOpenChange, signal }: SentinelSignalDrawerProps) {
  if (!signal) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 right-0 left-auto h-screen max-h-screen w-full max-w-4xl translate-x-0 translate-y-0 space-y-6 overflow-y-auto rounded-none border-l bg-background px-6 py-8 shadow-2xl focus-visible:outline-hidden sm:px-10"
        showCloseButton
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold">Anomaly signal detail</DialogTitle>
          <DialogDescription className="text-base">{signal.label}</DialogDescription>
        </DialogHeader>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" className={cn('text-sm font-semibold', SEVERITY_COLORS[signal.severity])}>
              {signal.severity.toUpperCase()}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>Detected {formatRelativeTime(signal.timestamp)}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{signal.summary}</p>
        </section>

        <section aria-label="Anomaly metrics" className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Z-Score
            </div>
            <p className="mt-1 text-2xl font-bold">{signal.zScore.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {Math.abs(signal.zScore) > 3 ? 'Significant deviation' : Math.abs(signal.zScore) > 2 ? 'Moderate deviation' : 'Within normal range'}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Anomaly Score
            </div>
            <p className="mt-1 text-2xl font-bold">{Math.round(signal.anomalyScore)}%</p>
            <p className="text-xs text-muted-foreground">Composite risk indicator</p>
          </div>
        </section>

        {signal.eventHistory.length > 0 && (
          <section aria-label="Event history" className="space-y-4">
            <header className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Event history</p>
            </header>
            <div className="space-y-2 rounded-lg border">
              {signal.eventHistory.map((event, index) => (
                <article key={event.id} className="border-b last:border-b-0 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(event.timestamp)}</span>
                    <Badge variant="outline" className="text-xs">
                      {event.value.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium">{event.event}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {signal.causalLinks && signal.causalLinks.length > 0 && (
          <section aria-label="Causal link suggestions" className="space-y-4">
            <header className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-600" aria-hidden="true" />
              <p className="text-sm font-semibold uppercase tracking-wide">Causal link suggestions</p>
            </header>
            <div className="grid gap-3 md:grid-cols-2">
              {signal.causalLinks.map((link) => (
                <div key={link.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{LINK_TYPE_LABELS[link.type]}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(link.strength * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
                  {link.relatedSignal && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Related: <span className="font-medium">{link.relatedSignal}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </DialogContent>
    </Dialog>
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

