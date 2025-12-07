'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BellRing, Filter, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type DriftSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
type DriftStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'

interface DriftEvent {
  id: string
  summary: string
  severity: DriftSeverity
  status: DriftStatus
  category: string
  recommendation?: string | null
  lastDetectedAt: string
  metadata?: Record<string, any> | null
}

type DriftResponse = {
  events: DriftEvent[]
}

const severityPalette: Record<DriftSeverity, string> = {
  CRITICAL: 'text-destructive',
  WARNING: 'text-amber-600 dark:text-amber-400',
  INFO: 'text-muted-foreground',
}

export default function OrgDriftCenterPage() {
  const [events, setEvents] = useState<DriftEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState<DriftSeverity | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<DriftStatus | 'ALL'>('OPEN')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/demo/org/drift', { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load drift events (${response.status})`)
        }
        const payload = (await response.json()) as DriftResponse
        if (!cancelled) {
          setEvents(payload.events)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message ?? 'Unable to load drift events')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (severityFilter !== 'ALL' && event.severity !== severityFilter) return false
      if (statusFilter !== 'ALL' && event.status !== statusFilter) return false
      if (search.trim().length > 0) {
        const target = `${event.summary} ${event.recommendation ?? ''}`.toLowerCase()
        if (!target.includes(search.trim().toLowerCase())) return false
      }
      return true
    })
  }, [events, severityFilter, statusFilter, search])

  const metrics = useMemo(() => {
    return {
      total: events.length,
      critical: events.filter((event) => event.severity === 'CRITICAL' && event.status === 'OPEN').length,
      acknowledged: events.filter((event) => event.status === 'ACKNOWLEDGED').length,
      resolvedLastWeek: events.filter((event) => {
        if (!event.lastDetectedAt) return false
        const detected = new Date(event.lastDetectedAt)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        return detected >= weekAgo && event.status === 'RESOLVED'
      }).length,
    }
  }, [events])

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Drift Center</p>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-7 w-7 text-primary" aria-hidden="true" />
              Drift Center
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Monitor permission, privileging, and payer drift signals in one SR-friendly workspace. Critical drift queues immediate mitigations and notifications.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <BellRing className="h-4 w-4 mr-2" />
              Notify ops
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <SummaryCard label="Active drift" value={metrics.total.toString()} description="All severities" icon={AlertTriangle} />
        <SummaryCard label="Critical open" value={metrics.critical.toString()} description="Requires hold or reevaluation" icon={ShieldAlert} tone="danger" />
        <SummaryCard label="Acknowledged" value={metrics.acknowledged.toString()} description="Pending remediation plans" icon={Filter} tone="info" />
        <SummaryCard label="Resolved this week" value={metrics.resolvedLastWeek.toString()} description="Auto + manual closures" icon={RefreshCw} tone="success" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>Filter by severity, status, or keyword. Live region will announce filter updates.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Severity</span>
            <div className="flex gap-2">
              {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={severityFilter === filter ? 'default' : 'outline'}
                  onClick={() => setSeverityFilter(filter)}
                  aria-pressed={severityFilter === filter}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status</span>
            <div className="flex gap-2">
              {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'] as const).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(filter)}
                  aria-pressed={statusFilter === filter}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <Input
              placeholder="Search summary or recommendation"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load drift signals</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">Loading drift events…</div>
      ) : (
        <section aria-live="polite">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredEvents.length} of {events.length} events
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="py-2 font-medium">Summary</th>
                  <th className="py-2 font-medium">Severity</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Last detected</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-t text-sm">
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <Link href={`/demo/org/drift/${event.id}`} className="font-semibold hover:underline focus-visible:underline">
                          {event.summary}
                        </Link>
                        <p className="text-muted-foreground text-xs">{event.recommendation ?? 'No recommendation recorded'}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs font-semibold ${severityPalette[event.severity]}`}>{event.severity}</span>
                    </td>
                    <td className="py-3">
                      <Badge variant={event.status === 'OPEN' ? 'destructive' : 'secondary'}>{event.status}</Badge>
                    </td>
                    <td className="py-3 text-muted-foreground text-sm">{new Date(event.lastDetectedAt).toLocaleString()}</td>
                    <td className="py-3">
                      <Button size="sm" asChild variant="outline">
                        <Link href={`/demo/org/drift/${event.id}`}>Review</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No drift events match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

type SummaryCardProps = {
  label: string
  value: string
  description: string
  icon: typeof AlertTriangle
  tone?: 'danger' | 'info' | 'success'
}

function SummaryCard({ label, value, description, icon: Icon, tone = 'info' }: SummaryCardProps) {
  const toneClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-muted-foreground'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={`h-5 w-5 ${toneClass}`} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

