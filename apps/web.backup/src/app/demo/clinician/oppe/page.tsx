'use client'

import { useMemo } from 'react'
import { Calendar, Clock, ShieldCheck, TrendingUp } from 'lucide-react'
import { TrendChart } from '@/components/oppe/TrendChart'
import { EventFeed } from '@/components/oppe/EventFeed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ClinicianOppePage() {
  const data = useMemo(() => getMockClinicianOppe(), [])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Demo • Clinician</p>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
            {data.clinicianName}
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Personal OPPE quick view. Track your rolling performance score, upcoming review cycles, and events that influenced the score.
          </p>
        </div>
        <Button size="sm" variant="outline">
          Download snapshot PDF
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <SummaryCard icon={TrendingUp} label="OPPE Score" value={`${data.score}`} description="Rolling 6 months" />
        <SummaryCard icon={Clock} label="Current cycle" value={data.currentCycle.label} description={`${data.currentCycle.start} – ${data.currentCycle.end}`} />
        <SummaryCard icon={Calendar} label="Next review" value={data.nextReviewDate} description="Auto scheduled" />
        <SummaryCard icon={ShieldCheck} label="Flags" value={`${data.flags.length}`} description="Require your acknowledgement" tone="warning" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart
            title="Performance trend"
            description="Composite OPPE score over the last 6 months."
            data={data.trend}
            valueFormatter={(value) => `${value} pts`}
            srHint="Performance score line chart"
            targetValue={90}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming OPPE cycles</CardTitle>
            <CardDescription>Stay ahead of your reviews.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.upcomingCycles.map((cycle) => (
              <div key={cycle.label} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{cycle.label}</p>
                  <Badge variant="secondary">{cycle.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {cycle.start} – {cycle.end}
                </p>
                <p className="text-xs text-muted-foreground">{cycle.action}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventFeed events={data.events} title="Contributing events" description="Events factored into your OPPE score. Filter by severity to focus follow-up." />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Flag follow-ups</CardTitle>
            <CardDescription>Quick tasks assigned to you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.flags.map((flag) => (
              <div key={flag.id} className="rounded-md border p-3 space-y-1">
                <p className="font-semibold">{flag.title}</p>
                <p className="text-sm text-muted-foreground">{flag.detail}</p>
                <Button size="sm" variant="link" className="px-0 text-primary">
                  Mark as reviewed
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

type SummaryCardProps = {
  icon: typeof ShieldCheck
  label: string
  value: string
  description: string
  tone?: 'default' | 'warning'
}

function SummaryCard({ icon: Icon, label, value, description, tone = 'default' }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={tone === 'warning' ? 'text-amber-600 h-4 w-4' : 'text-primary h-4 w-4'} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function getMockClinicianOppe() {
  const now = new Date()
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  return {
    clinicianName: 'Dr. Jamie Patel',
    score: 94,
    currentCycle: {
      label: 'CY Q3 2025',
      start: 'Jul 1',
      end: 'Sep 30',
    },
    nextReviewDate: 'Oct 15',
    trend: months.map((month, idx) => ({ label: month, value: 88 + idx })),
    upcomingCycles: [
      { label: 'Q4 2025', start: 'Oct 1', end: 'Dec 31', status: 'scheduled', action: 'Submit case log by Nov 15' },
      { label: 'Q1 2026', start: 'Jan 1', end: 'Mar 31', status: 'pending', action: 'Watchlist for robotics privileges' },
    ],
    events: [
      {
        id: 'evt-201',
        clinician: 'You',
        privilegeCode: 'CARD-220',
        procedure: 'PCI with stent',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 26).toISOString(),
        severity: 'warning' as const,
        summary: 'Contrast volume exceeded expected range',
        detail: 'Two cases required higher contrast due to anatomy. Addendum requested.',
        scoreImpact: -3,
        recommendedAction: 'Document rationale',
      },
      {
        id: 'evt-202',
        clinician: 'You',
        privilegeCode: 'CARD-115',
        procedure: 'Diagnostic cath',
        timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
        severity: 'info' as const,
        summary: 'Peer benchmark outperformance',
        detail: 'Door-to-cath time remained in top decile for the region.',
        scoreImpact: 4,
        recommendedAction: 'Share tips during next huddle',
      },
    ],
    flags: [
      { id: 'flag-a', title: 'Upload sedation CME certificate', detail: 'Required before robotics add-on review (due Oct 5).' },
      { id: 'flag-b', title: 'Acknowledge complication review', detail: 'Chart review complete. Leave note acknowledging remediation.' },
    ],
  }
}

