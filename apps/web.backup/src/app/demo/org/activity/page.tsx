'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Building2,
  Globe2,
  GraduationCap,
  LucideIcon,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from 'lucide-react'

import { CredentialSyncBadge, type CredentialSyncSource } from '@/components/state/CredentialSyncBadge'
import { RealtimeToast, useRealtimeToastQueue } from '@/components/notifications/RealtimeToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type ActivityCategory = 'license' | 'pecos' | 'dea' | 'board' | 'compact' | 'compliance'
type ActivitySeverity = 'info' | 'notice' | 'warning' | 'critical'

type ActivityEvent = {
  id: string
  category: ActivityCategory
  title: string
  summary: string
  timestamp: string
  actor: string
  severity: ActivitySeverity
  detail?: string
  metadata?: Record<string, string>
}

type ComplianceAlertScript = {
  id: string
  clinician: string
  status: 'FAIL' | 'WARN'
  rule: string
  detail: string
  delayMs: number
}

const CATEGORY_CONFIG: Record<
  ActivityCategory,
  {
    label: string
    icon: LucideIcon
    badge: string
    colorClass: string
    freshnessHours: number
    description: string
  }
> = {
  license: {
    label: 'Licensure',
    icon: ShieldCheck,
    badge: 'bg-sky-50 text-sky-900',
    colorClass: 'text-sky-600',
    freshnessHours: 24,
    description: 'State board verifications and PSV checks',
  },
  pecos: {
    label: 'PECOS',
    icon: Building2,
    badge: 'bg-emerald-50 text-emerald-900',
    colorClass: 'text-emerald-600',
    freshnessHours: 72,
    description: 'CMS enrollment and revalidation activity',
  },
  dea: {
    label: 'DEA',
    icon: Syringe,
    badge: 'bg-amber-50 text-amber-900',
    colorClass: 'text-amber-600',
    freshnessHours: 336,
    description: 'Registration status monitoring',
  },
  board: {
    label: 'Board',
    icon: GraduationCap,
    badge: 'bg-violet-50 text-violet-900',
    colorClass: 'text-violet-600',
    freshnessHours: 168,
    description: 'ABMS/AOA certification updates',
  },
  compact: {
    label: 'Compact',
    icon: Globe2,
    badge: 'bg-rose-50 text-rose-900',
    colorClass: 'text-rose-600',
    freshnessHours: 168,
    description: 'IMLC and other multi-state privileges',
  },
  compliance: {
    label: 'Compliance',
    icon: BellRing,
    badge: 'bg-rose-100 text-rose-900',
    colorClass: 'text-rose-600',
    freshnessHours: 12,
    description: 'NCQA + TJC packet alerts',
  },
}

const SEVERITY_STYLES: Record<
  ActivitySeverity,
  {
    badge: string
    description: string
  }
> = {
  info: {
    badge: 'bg-slate-100 text-slate-900',
    description: 'Informational',
  },
  notice: {
    badge: 'bg-sky-100 text-sky-900',
    description: 'Needs review soon',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-900',
    description: 'Action recommended',
  },
  critical: {
    badge: 'bg-rose-100 text-rose-900',
    description: 'Immediate attention',
  },
}

export default function OrgActivityPage() {
  const { events, latestEvent, acknowledgeLatest, sourceFreshness } = useOrgActivityStream()
  const { toast, pushToast, dismissToast, autoDismissMs } = useRealtimeToastQueue(5500)

  useEffect(() => {
    if (!latestEvent) {
      return
    }
    pushToast({
      id: latestEvent.id,
      title: `${CATEGORY_CONFIG[latestEvent.category].label} update`,
      body: latestEvent.summary,
      tone: mapSeverityToTone(latestEvent.severity),
      timestamp: latestEvent.timestamp,
    })
    acknowledgeLatest()
  }, [latestEvent, pushToast, acknowledgeLatest])

  const summaryCards = useMemo(() => buildSummaryCards(events), [events])
  const riskBreakdown = useMemo(() => buildRiskBreakdown(events), [events])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <RealtimeToast notification={toast} onDismiss={dismissToast} autoDismissMs={autoDismissMs} />
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Credential Ops</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Real-time credential activity</h1>
            <p className="max-w-3xl text-muted-foreground">
              Live feed of board, license, PECOS, DEA, and compact events as they arrive from subscription processors. The
              stream auto-sorts newest updates first and surfaces accessibility-friendly announcements for clinicians.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CredentialSyncBadge sources={sourceFreshness} defaultThresholdHours={48} />
            <Button variant="outline" size="sm" className="gap-2">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              Download evidence bundle
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={cn('h-4 w-4', card.iconColor)} aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" aria-live="polite">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Live credential activity</CardTitle>
              <CardDescription>Newest national and state events for subscribed clinicians.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" className="gap-2">
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="divide-y rounded-lg border" role="list">
              {events.map((event) => (
                <article key={event.id} className="p-4 transition hover:bg-muted/40" role="listitem">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                      <CATEGORY_CONFIG[event.category].icon
                        className={cn('h-4 w-4', CATEGORY_CONFIG[event.category].colorClass)}
                        aria-hidden="true"
                      />
                      <span>{CATEGORY_CONFIG[event.category].label}</span>
                      <span aria-hidden="true">•</span>
                      <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
                    </div>
                    <Badge className={SEVERITY_STYLES[event.severity].badge}>{SEVERITY_STYLES[event.severity].description}</Badge>
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">{event.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{event.actor}</span>
                    {event.metadata &&
                      Object.entries(event.metadata).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
                          {key}: {value}
                        </span>
                      ))}
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk snapshot</CardTitle>
              <CardDescription>Counts of open signals by severity and domain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riskBreakdown.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.helper}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={SEVERITY_STYLES[item.severity].badge}>{item.count} open</Badge>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Compact eligibility timeline</CardTitle>
              <CardDescription>Last refreshed with state partners.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {sourceFreshness
                .filter((source) => source.id === 'compact' || source.label.includes('Compact'))
                .slice(0, 2)
                .map((entry) => (
                  <div key={entry.id} className="rounded-md border bg-muted/30 p-3">
                    <p className="font-semibold">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatRelative(entry.lastUpdated)}</p>
                  </div>
                ))}
              <p className="text-xs text-muted-foreground">
                Compact eligibility badges update as soon as state feeds land, so org admins can reroute clinicians by the next shift.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function useOrgActivityStream() {
  const [events, setEvents] = useState<ActivityEvent[]>(() => buildSeedEvents())
  const [latestEvent, setLatestEvent] = useState<ActivityEvent | null>(null)
  const [sourceMap, setSourceMap] = useState<Record<ActivityCategory, string>>(() => {
    const initial: Record<ActivityCategory, string> = {
      license: events.find((event) => event.category === 'license')?.timestamp ?? new Date().toISOString(),
      pecos: events.find((event) => event.category === 'pecos')?.timestamp ?? new Date().toISOString(),
      dea: events.find((event) => event.category === 'dea')?.timestamp ?? new Date().toISOString(),
      board: events.find((event) => event.category === 'board')?.timestamp ?? new Date().toISOString(),
      compact: events.find((event) => event.category === 'compact')?.timestamp ?? new Date().toISOString(),
      compliance: new Date().toISOString(),
    }
    return initial
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const next = generateEvent()
      setEvents((current) => [next, ...current].slice(0, 30))
      setSourceMap((current) => ({
        ...current,
        [next.category]: next.timestamp,
      }))
      setLatestEvent(next)
    }, 9000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timers = COMPLIANCE_ALERTS.map((alert) =>
      setTimeout(() => {
        const event = buildComplianceEvent(alert)
        setEvents((current) => [event, ...current].slice(0, 30))
        setSourceMap((current) => ({
          ...current,
          compliance: event.timestamp,
        }))
        setLatestEvent(event)
      }, alert.delayMs)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const acknowledgeLatest = () => setLatestEvent(null)

  const sourceFreshness: CredentialSyncSource[] = useMemo(
    () =>
      (Object.keys(sourceMap) as ActivityCategory[]).map((category) => ({
        id: category,
        label: `${CATEGORY_CONFIG[category].label} data`,
        lastUpdated: sourceMap[category],
        thresholdHours: CATEGORY_CONFIG[category].freshnessHours,
        description: CATEGORY_CONFIG[category].description,
      })),
    [sourceMap]
  )

  return { events, latestEvent, acknowledgeLatest, sourceFreshness }
}

function buildSeedEvents(): ActivityEvent[] {
  return [
    generateEvent('license'),
    generateEvent('pecos'),
    generateEvent('dea'),
    generateEvent('board'),
    generateEvent('compact'),
    generateEvent('license'),
    generateEvent('pecos'),
  ].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
}

function generateEvent(forcedCategory?: ActivityCategory): ActivityEvent {
  const category = forcedCategory ?? pickRandom(Object.keys(CATEGORY_CONFIG) as ActivityCategory[])
  const now = new Date()
  const offsetMinutes = Math.floor(Math.random() * 240)
  now.setMinutes(now.getMinutes() - offsetMinutes)

  const actor = pickRandom([
    'Chai subscription processor',
    'Florida Board webhook',
    'CMS PECOS feed',
    'Internal credential bot',
    'DEA licensing service',
  ])

  const titleTemplates: Record<ActivityCategory, string[]> = {
    license: [
      'License status refreshed',
      'Discipline-free attestation logged',
      'PV report delivered',
    ],
    pecos: ['PECOS enrollment synced', 'Revalidation date confirmed', 'PECOS roster change noted'],
    dea: ['DEA registration validated', 'DEA status expiring soon', 'DEA sanction scan clean'],
    board: ['Board certification updated', 'MOC requirements synced', 'Board attestation delivered'],
    compact: ['Compact eligibility expanded', 'Compact renewals captured', 'New compact flag raised'],
    compliance: ['Compliance FAIL alert', 'Compliance WARN signal', 'TJC readiness updated'],
  }

  const severityRoll = Math.random()
  const severity: ActivitySeverity =
    severityRoll > 0.9 ? 'critical' : severityRoll > 0.7 ? 'warning' : severityRoll > 0.4 ? 'notice' : 'info'

  const metadata = {
    status:
      severity === 'critical'
        ? 'Requires action'
        : severity === 'warning'
          ? 'Monitor'
          : severity === 'notice'
            ? 'Scheduled'
            : 'Synced',
    source: actor.split(' ')[0],
  }

  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    category,
    title: pickRandom(titleTemplates[category]),
    summary: buildSummaryText(category, severity),
    timestamp: now.toISOString(),
    actor,
    severity,
    metadata,
  }
}

function buildSummaryText(category: ActivityCategory, severity: ActivitySeverity): string {
  const base = CATEGORY_CONFIG[category].label
  switch (severity) {
    case 'critical':
      return `${base} feed returned a blocking discrepancy that needs immediate review.`
    case 'warning':
      return `${base} feed highlighted a freshness gap; queued for analyst triage.`
    case 'notice':
      return `${base} feed delivered an on-time refresh with minor notes.`
    default:
      return `${base} feed synced successfully with no action needed.`
  }
}

const COMPLIANCE_ALERTS: ComplianceAlertScript[] = [
  {
    id: 'lewis-fail',
    clinician: 'Dr. Leo Alvarez',
    status: 'FAIL',
    rule: 'CR1 PSV',
    detail: 'PSV older than 180 days; compliance escalated to Credentials Committee.',
    delayMs: 4500,
  },
  {
    id: 'lennox-warn',
    clinician: 'Dr. Maya Lennox',
    status: 'WARN',
    rule: 'TJC FPPE',
    detail: 'FPPE imaging review pending sign-off. Reminder sent to imaging lead.',
    delayMs: 12000,
  },
]

function buildComplianceEvent(alert: ComplianceAlertScript): ActivityEvent {
  const severity: ActivitySeverity = alert.status === 'FAIL' ? 'critical' : 'warning'
  return {
    id: `compliance-${alert.id}`,
    category: 'compliance',
    title: `${alert.rule} ${alert.status}`,
    summary: alert.detail,
    timestamp: new Date().toISOString(),
    actor: 'Compliance automation',
    severity,
    metadata: {
      clinician: alert.clinician,
      status: alert.status,
    },
  }
}

function pickRandom<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function mapSeverityToTone(severity: ActivitySeverity): 'info' | 'success' | 'warning' | 'critical' {
  if (severity === 'info') {
    return 'success'
  }
  if (severity === 'notice') {
    return 'info'
  }
  if (severity === 'warning') {
    return 'warning'
  }
  return 'critical'
}

function formatTimestamp(timestamp: string): string {
  const value = new Date(timestamp)
  return value.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelative(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(ms / (1000 * 60))
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function buildSummaryCards(events: ActivityEvent[]) {
  return (Object.keys(CATEGORY_CONFIG) as ActivityCategory[]).map((category) => {
    const latest = events.find((event) => event.category === category)
    return {
      id: category,
      label: CATEGORY_CONFIG[category].label,
      icon: CATEGORY_CONFIG[category].icon,
      iconColor: CATEGORY_CONFIG[category].colorClass,
      value: latest ? formatRelative(latest.timestamp) : 'No data',
      helper: latest?.summary ?? CATEGORY_CONFIG[category].description,
    }
  })
}

function buildRiskBreakdown(events: ActivityEvent[]) {
  return (Object.keys(CATEGORY_CONFIG) as ActivityCategory[]).map((category) => {
    const relevant = events.filter((event) => event.category === category && event.severity !== 'info')
    const severity: ActivitySeverity =
      relevant.some((event) => event.severity === 'critical')
        ? 'critical'
        : relevant.some((event) => event.severity === 'warning')
          ? 'warning'
          : relevant.length > 0
            ? 'notice'
            : 'info'
    return {
      id: category,
      label: CATEGORY_CONFIG[category].label,
      severity,
      count: relevant.length,
      helper: CATEGORY_CONFIG[category].description,
    }
  })
}


