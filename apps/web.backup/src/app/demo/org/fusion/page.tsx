'use client'

import { useMemo } from 'react'
import { ActivitySquare, ArrowUpRight, Download, Gauge, Layers, ShieldCheck, SignalHigh } from 'lucide-react'

import { FusionScoreBadge } from '@/components/fusion/FusionScoreBadge'
import { FusionTrendChart, type FusionTrendDatum } from '@/components/fusion/FusionTrendChart'
import { QualitySignalFeed, type QualitySignal } from '@/components/fusion/QualitySignalFeed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type CredentialSignal = {
  id: string
  label: string
  status: 'green' | 'yellow' | 'red'
  metric: string
  helper: string
}

const STATUS_BADGE: Record<CredentialSignal['status'], string> = {
  green: 'bg-emerald-100 text-emerald-900',
  yellow: 'bg-amber-100 text-amber-900',
  red: 'bg-rose-100 text-rose-900',
}

const MATRIX_COLUMNS = [
  { id: 'green', label: 'Green', className: 'bg-emerald-50 text-emerald-900' },
  { id: 'yellow', label: 'Yellow', className: 'bg-amber-50 text-amber-900' },
  { id: 'red', label: 'Red', className: 'bg-rose-50 text-rose-900' },
] as const

const MATRIX_ROWS = [
  {
    id: 'quality',
    label: 'Quality throughput',
    values: {
      green: '27 metrics on target',
      yellow: '2 trending down',
      red: '1 blocking review',
    },
  },
  {
    id: 'credential',
    label: 'Credential hygiene',
    values: {
      green: '14 states verified',
      yellow: '1 expiring in <30d',
      red: '0 holds',
    },
  },
  {
    id: 'experience',
    label: 'Experience signals',
    values: {
      green: 'OPPE 78th percentile',
      yellow: 'FPPE follow-up',
      red: '0 escalations',
    },
  },
] as const

export default function OrgFusionDashboardPage() {
  const qualitySignals = useMemo(() => buildQualitySignals(), [])
  const credentialSignals = useMemo(() => buildCredentialSignals(), [])
  const trendData = useMemo(() => buildTrendSeries(), [])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Fusion Ops</p>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Layers className="h-8 w-8 text-primary" aria-hidden="true" />
              Org Fusion dashboard
            </h1>
            <p className="max-w-3xl text-muted-foreground">
              Composite credential, quality, and risk posture in a single glass pane. Track AI-detected signals, enrollment
              drift, and performance trends without hopping between OPPE, PSV, and compliance tabs.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                All PSV feeds healthy
              </Badge>
              <Badge variant="secondary" className="gap-2">
                <SignalHigh className="h-4 w-4" aria-hidden="true" />
                18 live quality signals
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FusionScoreBadge
              score={86}
              percentile={78}
              breakdown={[
                { label: 'Quality', value: 88 },
                { label: 'Credential', value: 82 },
                { label: 'Performance', value: 91 },
              ]}
              signals={[
                { label: 'OPPE trending +4 pts', severity: 'positive' },
                { label: 'PECOS backlog 3 cases', severity: 'warning' },
              ]}
              size="lg"
            />
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              Download fused packet
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Fusion KPIs">
        {[
          {
            label: 'Composite delta',
            value: '+4.2 pts',
            helper: 'vs last 30 days',
            icon: <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />,
          },
          {
            label: 'Credential SLA',
            value: '14h median',
            helper: 'PSV round-trip',
            icon: <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />,
          },
          {
            label: 'Quality engagement',
            value: '92%',
            helper: 'Clinicians w/ signal baselines',
            icon: <ActivitySquare className="h-5 w-5 text-primary" aria-hidden="true" />,
          },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <FusionTrendChart data={trendData} className="lg:col-span-2" targetValue={85} />
        <Card>
          <CardHeader>
            <CardTitle>Quality + credential blend</CardTitle>
            <CardDescription>AI correlation of leading indicators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">OPPE vs PSV</p>
              <p className="text-base font-semibold">0.82 correlation</p>
              <p className="text-muted-foreground">Clinician throughput rises when PSV turnaround &lt; 18h.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Enrollment drift</p>
              <p className="text-base font-semibold">3 enrollments lagging</p>
              <p className="text-muted-foreground">Payer evidence loops average 9 days without AI prep.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Risk posture</p>
              <p className="text-base font-semibold text-emerald-600">Low</p>
              <p className="text-muted-foreground">No sanctions, PECOS refreshed this week.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <QualitySignalFeed signals={qualitySignals} />
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div>
              <CardTitle>Credential signals</CardTitle>
              <CardDescription>PSV freshness, enrollment queues, sanctions, and automation.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-2 self-start text-primary">
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              Open credential matrix
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {credentialSignals.map((signal) => (
              <div key={signal.id} className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{signal.label}</p>
                  <Badge className={STATUS_BADGE[signal.status]}>
                    {signal.status === 'green' ? 'On track' : signal.status === 'yellow' ? 'Watch' : 'At risk'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{signal.helper}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Metric</p>
                <p className="font-medium">{signal.metric}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Red / Yellow / Green matrix</CardTitle>
          <CardDescription>Composite readiness aligned to quality, credential, and experience signals.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="border-b px-3 py-2 text-left font-semibold text-muted-foreground">Domain</th>
                {MATRIX_COLUMNS.map((column) => (
                  <th key={column.id} className="border-b px-3 py-2 text-left font-semibold text-muted-foreground">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-semibold">{row.label}</td>
                  {MATRIX_COLUMNS.map((column) => (
                    <td key={column.id} className={cn('px-3 py-3', column.className, 'rounded-md font-medium')}>
                      {row.values[column.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function buildTrendSeries(): FusionTrendDatum[] {
  const labels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  return labels.map((label, index) => ({
    label,
    combined: 78 + index * 1.2 + (index % 2 === 0 ? 1 : -0.5),
    credential: 74 + index * 1.1,
    quality: 80 + index * 1.4 + (index % 3 === 0 ? 2 : 0),
  }))
}

function buildQualitySignals(): QualitySignal[] {
  return [
    {
      id: 'sig-critical',
      title: 'Sepsis bundle lag',
      summary: 'Compliance dipped to 82% vs 95% threshold after night shift reroute.',
      severity: 'critical',
      timestamp: minutesAgo(18),
      metric: 'Sepsis bundle compliance',
      value: '82%',
      source: 'Epic quality tap',
    },
    {
      id: 'sig-high',
      title: 'Readmission spike',
      summary: 'Heart failure readmits up 6 cases week over week due to discharge education gaps.',
      severity: 'high',
      timestamp: minutesAgo(42),
      metric: '30-day readmit',
      value: '12.1%',
      source: 'Vizient cohort',
    },
    {
      id: 'sig-medium',
      title: 'OPPE variance reduced',
      summary: 'Cardiology peer percentile improved to 78th vs 74th prior cycle.',
      severity: 'medium',
      timestamp: minutesAgo(90),
      metric: 'OPPE percentile',
      value: '78th',
      source: 'OPPE sandbox',
    },
    {
      id: 'sig-low',
      title: 'Patient experience steady',
      summary: 'HCAHPS courtesy question stable at 92% favorable.',
      severity: 'low',
      timestamp: minutesAgo(190),
      metric: 'HCAHPS courtesy',
      value: '92%',
      source: 'Press Ganey',
    },
  ]
}

function buildCredentialSignals(): CredentialSignal[] {
  return [
    {
      id: 'cred-1',
      label: 'PSV automation health',
      status: 'green',
      metric: '14h median turnaround',
      helper: '17 states + 6 boards synced overnight.',
    },
    {
      id: 'cred-2',
      label: 'Enrollment backlog',
      status: 'yellow',
      metric: '3 enrollments awaiting payer reply',
      helper: 'Anthem + Humana requests additional robotic case docs.',
    },
    {
      id: 'cred-3',
      label: 'Sanction sweep',
      status: 'green',
      metric: '0 matches (SAM/OIG)',
      helper: 'Hourly sanction fetch from SAM.gov and LEIE APIs.',
    },
    {
      id: 'cred-4',
      label: 'DEA renewal queue',
      status: 'red',
      metric: '1 DEA expiring in 21 days',
      helper: 'Auto reminder sent; compliance awaiting attest upload.',
    },
  ]
}

function minutesAgo(amount: number) {
  const date = new Date()
  date.setMinutes(date.getMinutes() - amount)
  return date.toISOString()
}


