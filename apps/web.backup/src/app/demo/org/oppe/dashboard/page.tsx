'use client'

import { useMemo } from 'react'
import { AlertTriangle, BarChart3, FileSpreadsheet, Stethoscope } from 'lucide-react'
import { TrendChart } from '@/components/oppe/TrendChart'
import { EventFeed } from '@/components/oppe/EventFeed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OrgOppeDashboardPage() {
  const dashboard = useMemo(() => getMockOrgOppeDashboard(), [])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Quality Oversight</p>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="h-7 w-7 text-primary" aria-hidden="true" />
            OPPE Oversight Dashboard
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Live view of organizational OPPE scores, case throughput, and complication signals. Screen reader hints announce updates when metrics refresh.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
          <Button size="sm">Notify reviewers</Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <SummaryCard icon={BarChart3} label="OPPE Score" value={`${dashboard.overallScore}`} description="Weighted 6-month score" tone="primary" />
        <SummaryCard icon={FileSpreadsheet} label="Cases Reviewed" value={`${dashboard.casesReviewed.toLocaleString()}`} description="Rolling 90 days" />
        <SummaryCard icon={AlertTriangle} label="Complication rate" value={`${dashboard.complicationRate.toFixed(1)}%`} description="Risk-adjusted" tone="warning" />
        <SummaryCard icon={AlertTriangle} label="Active flags" value={`${dashboard.activeFlags}`} description="Require action" tone="danger" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Key OPPE trends">
        <TrendChart
          title="Case volume trend"
          description="Monthly case volume for all privileging departments."
          data={dashboard.caseVolumeTrend}
          valueFormatter={(value) => value.toLocaleString()}
          srHint="Case volume trend line chart"
        />
        <TrendChart
          title="Complication rate trend"
          description="Risk-adjusted complications per 100 cases."
          data={dashboard.complicationTrend}
          valueFormatter={(value) => `${value.toFixed(1)}%`}
          unitLabel="Percent"
          targetValue={dashboard.complicationTarget}
          srHint="Complication percentage trend line chart"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <EventFeed events={dashboard.events} title="Recent procedure events" description="Tap an event to review the flagged context and recommended remediation." />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality flags</CardTitle>
              <CardDescription>Privileges and service lines that contributed to the current OPPE score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard.flags.map((flag) => (
                <div key={flag.id} className="rounded-md border px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{flag.name}</p>
                    <Badge variant={flag.severity === 'critical' ? 'destructive' : 'secondary'}>{flag.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    Impact: {flag.impact > 0 ? '+' : ''}
                    {flag.impact} pts · Owner {flag.owner}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reviewer notes</CardTitle>
              <CardDescription>Highlights from the most recent quality committee huddle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {dashboard.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

type SummaryCardProps = {
  icon: typeof Stethoscope
  label: string
  value: string
  description: string
  tone?: 'primary' | 'warning' | 'danger'
}

function SummaryCard({ icon: Icon, label, value, description, tone = 'primary' }: SummaryCardProps) {
  const toneClass =
    tone === 'danger' ? 'text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-primary'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={toneClass + ' h-4 w-4'} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function getMockOrgOppeDashboard() {
  const now = new Date()
  return {
    overallScore: 92,
    casesReviewed: 842,
    complicationRate: 1.4,
    complicationTarget: 1.2,
    activeFlags: 4,
    caseVolumeTrend: Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now)
      date.setMonth(now.getMonth() - (5 - index))
      return {
        label: date.toLocaleString('default', { month: 'short' }),
        value: 600 + index * 40 + (index % 2 === 0 ? 35 : -20),
      }
    }),
    complicationTrend: [
      { label: 'Apr', value: 1.8 },
      { label: 'May', value: 1.6 },
      { label: 'Jun', value: 1.5 },
      { label: 'Jul', value: 1.3 },
      { label: 'Aug', value: 1.4 },
      { label: 'Sep', value: 1.2 },
    ],
    events: [
      {
        id: 'evt-101',
        clinician: 'Dr. Alice Carter',
        privilegeCode: 'CARD-320',
        procedure: 'Left heart cath',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
        severity: 'critical' as const,
        summary: 'Two complications over 30 cases triggered peer review.',
        detail:
          'While both events resolved without ICU transfer, the complication count exceeded the peer review threshold. Concurrent sedation checklist training recommended.',
        scoreImpact: -12,
        recommendedAction: 'Assign chart drill-down',
      },
      {
        id: 'evt-102',
        clinician: 'Dr. Bob Singh',
        privilegeCode: 'ORTHO-210',
        procedure: 'Partial knee arthroplasty',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        severity: 'warning' as const,
        summary: 'Readmission spike flagged for Ortho service line.',
        detail: 'Readmissions climbed to 7% vs 3% target. Evaluate infection control bundle adherence.',
        scoreImpact: -6,
        recommendedAction: 'Schedule targeted FPPE',
      },
      {
        id: 'evt-103',
        clinician: 'PA. Mei Chen',
        privilegeCode: 'PROC-112',
        procedure: 'Central line placement',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
        severity: 'info' as const,
        summary: 'Procedure volume exceeded peer benchmark.',
        detail: 'High procedure volume triggered a reminder to review competency tracking for advanced practice providers.',
        scoreImpact: 3,
        recommendedAction: 'Share trend with leadership',
      },
    ],
    flags: [
      {
        id: 'flag-01',
        name: 'Cath Lab – Sedation',
        severity: 'critical',
        summary: 'Checklist completion fell below 85% for 2 weeks.',
        impact: -8,
        owner: 'Quality RN',
      },
      {
        id: 'flag-02',
        name: 'Ortho LOS',
        severity: 'warning',
        summary: 'Average length of stay above pathway guidance.',
        impact: -4,
        owner: 'Service Chief',
      },
      {
        id: 'flag-03',
        name: 'Neuro credential review',
        severity: 'warning',
        summary: 'Pending competency attestations for robotics add-on.',
        impact: -2,
        owner: 'Medical Staff Office',
      },
    ],
    notes: [
      'OPPE committee approved fast-track review for service lines with zero red flags.',
      'Data refresh cadence increased to every 12 hours for demo purposes.',
      'Next huddle: Tuesday 10:00 AM with privileging leadership.',
    ],
  }
}

