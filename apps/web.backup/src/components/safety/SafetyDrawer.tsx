'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PrivilegeState, PrivilegeStateBadge } from '@/components/privileges/PrivilegeStateBadge'
import { cn } from '@/lib/utils'
import { AlertTriangle, ClipboardList, Link2, Shield } from 'lucide-react'

const SEVERITY_BADGES: Record<SafetySeverity, string> = {
  critical: 'bg-rose-50 text-rose-900 border-rose-200',
  high: 'bg-amber-50 text-amber-900 border-amber-200',
  medium: 'bg-sky-50 text-sky-900 border-sky-200',
  low: 'bg-emerald-50 text-emerald-900 border-emerald-200',
}

const STEP_STATUS_BADGES: Record<SafetyStep['status'], string> = {
  blocked: 'bg-rose-50 text-rose-900 border-rose-200',
  pending: 'bg-amber-50 text-amber-900 border-amber-200',
  scheduled: 'bg-slate-100 text-slate-900 border-slate-200',
  completed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
}

export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low'

export type SafetySignal = {
  id: string
  label: string
  severity: SafetySeverity
  summary: string
  lastNoted: string
  weight: 'primary' | 'supporting'
  contributingEvidence: string[]
}

export type SafetyDependency = {
  id: string
  name: string
  type: 'credentialing' | 'quality' | 'staffing' | 'it' | 'other'
  status: 'healthy' | 'degraded' | 'offline'
  description: string
}

export type SafetyStep = {
  id: string
  action: string
  owner: string
  status: 'blocked' | 'pending' | 'scheduled' | 'completed'
  due: string
}

export type SafetyDrawerProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  privilegeName: string
  clinicianName?: string
  facility?: string
  state: PrivilegeState
  stateReason: string
  summary: string
  signals: SafetySignal[]
  dependencies: SafetyDependency[]
  nextSteps: SafetyStep[]
  severityPattern?: Array<{
    label: string
    severity: SafetySeverity
    value: number
  }>
}

export function SafetyDrawer({
  open,
  onOpenChange,
  privilegeName,
  clinicianName,
  facility,
  state,
  stateReason,
  summary,
  signals,
  dependencies,
  nextSteps,
  severityPattern = [],
}: SafetyDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 right-0 left-auto h-screen max-h-screen w-full max-w-4xl translate-x-0 translate-y-0 space-y-6 overflow-y-auto rounded-none border-l bg-background px-6 py-8 shadow-2xl focus-visible:outline-hidden sm:px-10"
        showCloseButton
      >
        <DialogHeader className="text-left">
          <DialogTitle className="text-2xl font-semibold">Privilege safety detail</DialogTitle>
          <DialogDescription className="text-base">
            {clinicianName ? `${privilegeName} • ${clinicianName}` : privilegeName}
            {facility ? ` • ${facility}` : ''}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-wrap items-center gap-4">
          <PrivilegeStateBadge state={state} reason={stateReason} />
          <p className="text-sm text-muted-foreground max-w-3xl">{summary}</p>
        </section>

        {severityPattern.length > 0 && (
          <section aria-label="Severity pattern" className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Severity pattern
            </div>
            <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              {severityPattern.map((point) => (
                <div key={point.label} className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{point.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', mapSeverityToBar(point.severity))}
                        style={{ width: `${Math.min(100, point.value)}%` }}
                      />
                    </div>
                    <Badge variant="outline" className={SEVERITY_BADGES[point.severity]}>
                      {point.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Signals impacting status" className="space-y-4">
          <header className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Signals impacting status</p>
          </header>
          <div className="space-y-3 rounded-lg border">
            {signals.map((signal) => (
              <article key={signal.id} className="border-b last:border-b-0 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className={cn('text-xs font-semibold', SEVERITY_BADGES[signal.severity])}>
                    {signal.severity.toUpperCase()}
                  </Badge>
                  <p className="font-semibold">{signal.label}</p>
                  <span className="text-xs text-muted-foreground">Updated {formatRelativeTime(signal.lastNoted)}</span>
                  {signal.weight === 'primary' && (
                    <Badge className="bg-purple-100 text-purple-900 border-purple-200 text-[11px]">Primary driver</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{signal.summary}</p>
                {signal.contributingEvidence.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {signal.contributingEvidence.map((evidence) => (
                      <li key={evidence} className="rounded-full bg-muted px-2 py-1">
                        {evidence}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Dependencies" className="space-y-4">
          <header className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Dependencies</p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            {dependencies.map((dependency) => (
              <div key={dependency.id} className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{dependency.name}</span>
                  <Badge variant="outline" className={mapDependencyStatus(dependency.status)}>
                    {dependency.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{dependency.type}</p>
                <p className="mt-2 text-sm text-muted-foreground">{dependency.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Next steps" className="space-y-3">
          <header className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-semibold uppercase tracking-wide">Next steps</p>
          </header>
          <ol className="space-y-3">
            {nextSteps.map((step) => (
              <li key={step.id} className="rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className={cn('text-xs font-semibold', STEP_STATUS_BADGES[step.status])}>
                    {step.status}
                  </Badge>
                  <p className="font-semibold">{step.action}</p>
                </div>
                <dl className="mt-2 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide">Owner</dt>
                    <dd className="font-medium text-foreground">{step.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide">Due</dt>
                    <dd className="font-medium text-foreground">{formatRelativeTime(step.due)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      </DialogContent>
    </Dialog>
  )
}

function mapSeverityToBar(severity: SafetySeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-rose-500'
    case 'high':
      return 'bg-amber-500'
    case 'medium':
      return 'bg-sky-500'
    default:
      return 'bg-emerald-500'
  }
}

function mapDependencyStatus(status: SafetyDependency['status']) {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    case 'degraded':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'offline':
      return 'bg-rose-50 text-rose-900 border-rose-200'
    default:
      return ''
  }
}

function formatRelativeTime(input: string) {
  const target = new Date(input)
  const now = new Date()
  const diffMs = now.getTime() - target.getTime()
  const diffMinutes = Math.round(diffMs / 60000)

  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.round(diffHours / 24)
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`
}


