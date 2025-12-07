'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { AlertTriangle, ArrowLeft, Download, Share2, ShieldCheck, Sparkles } from 'lucide-react'

import { FusionScoreBadge } from '@/components/fusion/FusionScoreBadge'
import { FusionTrendChart, type FusionTrendDatum } from '@/components/fusion/FusionTrendChart'
import { QualitySignalFeed, type QualitySignal } from '@/components/fusion/QualitySignalFeed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type FusionPanelPacket = {
  clinician: {
    name: string
    specialty: string
    npi: string
  }
  fusionScore: number
  percentile: number
  breakdown: { label: string; value: number }[]
  fusionSignals: QualitySignal[]
  trend: FusionTrendDatum[]
  oppe: {
    summary: string
    metrics: { label: string; value: string; helper: string }[]
  }
  psv: {
    automation: string
    metrics: { label: string; value: string; helper: string }[]
  }
  compliance: {
    checklist: { label: string; status: 'clear' | 'watch'; helper: string }[]
  }
  drift: { label: string; status: 'stable' | 'watch'; helper: string }[]
  enrollmentCorrelations: { payer: string; correlation: string; note: string }[]
}

export default function CommitteeFusionPanelPage({ params }: { params: { clinicianId: string } }) {
  const packet = useMemo(() => buildFusionPanel(params.clinicianId), [params.clinicianId])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <Link href={`/demo/org/committee/${params.clinicianId}`} className="underline">
            Back to packet
          </Link>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Committee • Fusion analysis</p>
            <h1 className="text-3xl font-bold">Fusion panel for {packet.clinician.name}</h1>
            <p className="max-w-3xl text-muted-foreground">
              AI-crafted view blending OPPE, PSV, compliance, drift monitors, and payer enrollment correlations for a
              single-clinician decision packet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                OPPE + PSV fused
              </Badge>
              <Badge variant="secondary" className="gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Compliance clear
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FusionScoreBadge
              score={packet.fusionScore}
              percentile={packet.percentile}
              breakdown={packet.breakdown}
              signals={[
                { label: 'OPPE 78th percentile', severity: 'positive' },
                { label: 'PSV automation 14h', severity: 'positive' },
                { label: 'Enrollment 1 pending', severity: 'warning' },
              ]}
            />
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              Export analysis
            </Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share link
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Clinician snapshot</CardTitle>
            <CardDescription>Identifiers and specialty focus</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{packet.clinician.name}</p>
            <p className="text-muted-foreground">{packet.clinician.specialty}</p>
            <p className="text-muted-foreground">NPI {packet.clinician.npi}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>OPPE signals</CardTitle>
            <CardDescription>{packet.oppe.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {packet.oppe.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-semibold">{metric.label}</p>
                <p className="text-2xl font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>PSV coverage</CardTitle>
            <CardDescription>{packet.psv.automation}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {packet.psv.metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-semibold">{metric.label}</p>
                <p className="text-lg">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <FusionTrendChart data={packet.trend} className="lg:col-span-2" />
        <Card>
          <CardHeader>
            <CardTitle>Compliance checklist</CardTitle>
            <CardDescription>Key governance controls surfaced for committee</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {packet.compliance.checklist.map((item) => (
              <div key={item.label} className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.label}</p>
                  <Badge
                    variant={item.status === 'clear' ? 'secondary' : 'outline'}
                    className={item.status === 'watch' ? 'border-amber-300 text-amber-900' : undefined}
                  >
                    {item.status === 'clear' ? 'Clear' : 'Watch'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <QualitySignalFeed signals={packet.fusionSignals} />
        <Card>
          <CardHeader>
            <CardTitle>Drift monitors</CardTitle>
            <CardDescription>Enrollment, credential, and quality drift correlations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {packet.drift.map((monitor) => (
              <div key={monitor.label} className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{monitor.label}</p>
                  <Badge
                    variant={monitor.status === 'stable' ? 'secondary' : 'outline'}
                    className={monitor.status === 'watch' ? 'border-amber-300 text-amber-900' : undefined}
                  >
                    {monitor.status === 'stable' ? 'Stable' : 'Watch'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{monitor.helper}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Enrollment correlations</CardTitle>
            <CardDescription>PSV + enrollment signals mapped to payer actions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-2 text-primary">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Flag drift to payer
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Payer</th>
                <th className="px-3 py-2 font-semibold">Correlation</th>
                <th className="px-3 py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {packet.enrollmentCorrelations.map((row) => (
                <tr key={row.payer} className="border-t">
                  <td className="px-3 py-3 font-semibold">{row.payer}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.correlation}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function buildFusionPanel(_clinicianId: string): FusionPanelPacket {
  const trend = buildClinicianTrend()
  return {
    clinician: {
      name: 'Dr. Maya Lennox',
      specialty: 'Interventional Cardiology',
      npi: '1750392145',
    },
    fusionScore: 87,
    percentile: 82,
    breakdown: [
      { label: 'Quality', value: 89 },
      { label: 'Credential', value: 83 },
      { label: 'Experience', value: 92 },
    ],
    fusionSignals: buildFusionSignals(),
    trend,
    oppe: {
      summary: 'OPPE percentile lifted 4 points after FPPE remediation.',
      metrics: [
        { label: 'Peer percentile', value: '78th', helper: 'Cardiology cohort' },
        { label: 'Case volume', value: '612', helper: 'Rolling 12 months' },
        { label: 'Complications', value: '1.9%', helper: 'Target 2.4%' },
      ],
    },
    psv: {
      automation: 'PSV automation running every 4h with 96% coverage.',
      metrics: [
        { label: 'Median turnaround', value: '14h', helper: 'Last 30 days' },
        { label: 'Sources synced', value: '23 feeds', helper: 'Boards + licensure + DEA' },
        { label: 'Exceptions', value: '1 open', helper: 'DEA renewal due' },
      ],
    },
    compliance: {
      checklist: [
        { label: 'Sanctions + exclusions', status: 'clear', helper: 'No OIG/SAM hits detected.' },
        { label: 'PECOS lifecycle', status: 'watch', helper: 'Revalidation doc uploaded, awaiting CMS receipt.' },
        { label: 'Medicaid attestation', status: 'clear', helper: 'CA + OR recertified in Oct.' },
      ],
    },
    drift: [
      { label: 'Enrollment drift', status: 'watch', helper: 'Anthem robotics log outstanding 9 days.' },
      { label: 'FPPE dependency', status: 'stable', helper: 'Imaging peer review on track for Nov 30.' },
      { label: 'Quality vs PSV lag', status: 'stable', helper: 'PSV &lt; 18h aligns with OPPE uptick.' },
    ],
    enrollmentCorrelations: [
      { payer: 'Anthem CA', correlation: 'Robotic cases ↔ PSV doc loops', note: 'Upload console logs to unblock decision.' },
      { payer: 'Aetna National', correlation: 'OPPE percentile ↔ auto-approval', note: 'Auto renew scheduled Dec 1.' },
      { payer: 'Humana', correlation: 'FPPE closure ↔ panel expansion', note: 'Humana waiting for FPPE note; due next week.' },
    ],
  }
}

function buildFusionSignals(): QualitySignal[] {
  return [
    {
      id: 'fusion-critical',
      title: 'Robotics case documentation gap',
      summary: 'Payer requires console log evidence before finalizing enrollment.',
      severity: 'high',
      timestamp: new Date().toISOString(),
      metric: 'Payer enrollment',
      value: 'Pending',
      source: 'Anthem CA',
    },
    {
      id: 'fusion-quality',
      title: 'OPPE trending up',
      summary: 'Moving average climbed to 78th percentile vs 74th last quarter.',
      severity: 'medium',
      timestamp: minutesAgo(80),
      metric: 'OPPE percentile',
      value: '78th',
      source: 'OPPE feed',
    },
    {
      id: 'fusion-compliance',
      title: 'PECOS revalidation',
      summary: 'CMS acknowledged receipt; waiting on CFO signature upload.',
      severity: 'low',
      timestamp: minutesAgo(160),
      metric: 'PECOS status',
      value: 'In review',
      source: 'PECOS API',
    },
    {
      id: 'fusion-risk',
      title: 'Sanction sweep clean',
      summary: 'Hourly SAM/OIG sweeps show zero matches for clinician.',
      severity: 'low',
      timestamp: minutesAgo(210),
      metric: 'Sanction hits',
      value: '0',
      source: 'Compliance bot',
    },
  ]
}

function buildClinicianTrend(): FusionTrendDatum[] {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
  return months.map((label, index) => ({
    label,
    combined: 80 + index * 1.5,
    credential: 76 + index * 1.2,
    quality: 82 + index * 1.7,
  }))
}

function minutesAgo(amount: number) {
  const date = new Date()
  date.setMinutes(date.getMinutes() - amount)
  return date.toISOString()
}


