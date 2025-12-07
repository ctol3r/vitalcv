'use client'

import { useMemo, useState } from 'react'
import { Award, Building2, FileCheck, Shield, TrendingUp, Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ReputationTrendChart } from '@/components/reputation/TrendChart'
import type { ReputationTrendDatum } from '@/components/reputation/TrendChart'

type ReputationBreakdown = {
  overall: number
  quality: number
  credential: number
  enrollment: number
  peer: number
}

type PortfolioEntry = {
  id: string
  type: 'credential' | 'privilege' | 'enrollment'
  name: string
  issuer: string
  status: 'active' | 'expiring' | 'expired' | 'pending'
  expiryDate?: string
  lastUpdated: string
}

type ReputationFactor = {
  id: string
  type: 'positive' | 'negative' | 'neutral'
  category: 'quality' | 'credential' | 'enrollment' | 'peer'
  description: string
  impact: number
  timestamp: string
}

type ClinicianReputationData = {
  clinician: {
    name: string
    npi: string
    specialty: string
  }
  reputation: ReputationBreakdown
  portfolio: PortfolioEntry[]
  factors: ReputationFactor[]
  trend: ReputationTrendDatum[]
}

export default function ClinicianReputationPage() {
  const data = useMemo(() => buildMockData(), [])
  const [srMessage, setSrMessage] = useState('')

  const handleRequestUpdate = async (entryId: string) => {
    setSrMessage(`Requesting update for ${data.portfolio.find((e) => e.id === entryId)?.name}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage('Update request submitted successfully')
    setTimeout(() => setSrMessage(''), 2000)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Reputation</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Reputation Dashboard
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Your overall reputation score and breakdown across quality, credentials, enrollments, and peer recognition. Track factors affecting
              your score over time.
            </p>
          </div>
        </div>
      </header>

      {/* Overall Score Section */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5" aria-label="Reputation breakdown">
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data.reputation.overall.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>
        <MetricCard
          icon={Award}
          label="Quality"
          value={data.reputation.quality.toFixed(1)}
          description="Clinical outcomes & performance"
          color="text-emerald-600"
        />
        <MetricCard
          icon={FileCheck}
          label="Credential"
          value={data.reputation.credential.toFixed(1)}
          description="Licenses & certifications"
          color="text-blue-600"
        />
        <MetricCard
          icon={Building2}
          label="Enrollment"
          value={data.reputation.enrollment.toFixed(1)}
          description="Payer network participation"
          color="text-amber-600"
        />
        <MetricCard icon={Users} label="Peer" value={data.reputation.peer.toFixed(1)} description="Peer recognition & endorsements" color="text-purple-600" />
      </section>

      {/* Trend Chart */}
      <section>
        <ReputationTrendChart
          title="Reputation Trend"
          description="Track your reputation score changes over time. Toggle metrics to see individual component trends."
          data={data.trend}
          srHint="Reputation score trend over time"
        />
      </section>

      {/* Portfolio Entries */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Entries</CardTitle>
            <CardDescription>Your credentials, privileges, and enrollments contributing to your reputation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.portfolio.map((entry) => (
                <div key={entry.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{entry.name}</p>
                        <StatusBadge status={entry.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.issuer}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.type === 'credential' && 'Credential'}
                        {entry.type === 'privilege' && 'Privilege'}
                        {entry.type === 'enrollment' && 'Enrollment'} • Last updated {entry.lastUpdated}
                      </p>
                      {entry.expiryDate && (
                        <p className="text-xs text-muted-foreground">
                          {entry.status === 'expiring' && '⚠️ '}
                          Expires {entry.expiryDate}
                        </p>
                      )}
                    </div>
                    {entry.status === 'expiring' && (
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(entry.id)}>
                        Request Update
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Factors Affecting Changes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Factors</CardTitle>
            <CardDescription>Events and changes affecting your reputation score.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.factors.map((factor) => (
                <div key={factor.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {factor.type === 'positive' && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
                      {factor.type === 'negative' && <AlertCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />}
                      <Badge variant={factor.type === 'positive' ? 'default' : factor.type === 'negative' ? 'destructive' : 'secondary'}>
                        {factor.category}
                      </Badge>
                    </div>
                    <span className={`text-sm font-semibold ${factor.impact >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {factor.impact > 0 ? '+' : ''}
                      {factor.impact.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm">{factor.description}</p>
                  <p className="text-xs text-muted-foreground">{factor.timestamp}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  color,
}: {
  icon: typeof Shield
  label: string
  value: string
  description: string
  color?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || ''}`} aria-hidden="true" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: PortfolioEntry['status'] }) {
  const config = {
    active: { label: 'Active', variant: 'default' as const },
    expiring: { label: 'Expiring Soon', variant: 'default' as const },
    expired: { label: 'Expired', variant: 'destructive' as const },
    pending: { label: 'Pending', variant: 'secondary' as const },
  }[status]

  return <Badge variant={config.variant}>{config.label}</Badge>
}

function buildMockData(): ClinicianReputationData {
  const now = new Date()
  const trend: ReputationTrendDatum[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    trend.push({
      date: date.toISOString().split('T')[0],
      overall: 85 + Math.random() * 5 - 2.5,
      quality: 88 + Math.random() * 4 - 2,
      credential: 90 + Math.random() * 3 - 1.5,
      enrollment: 82 + Math.random() * 6 - 3,
      peer: 80 + Math.random() * 8 - 4,
      events:
        i === 3
          ? [
              {
                id: 'e1',
                type: 'credential_renewed',
                description: 'Medical license renewed',
                impact: 2.5,
                timestamp: date.toISOString(),
              },
            ]
          : i === 5
            ? [
                {
                  id: 'e2',
                  type: 'enrollment_added',
                  description: 'New payer enrollment approved',
                  impact: 1.5,
                  timestamp: date.toISOString(),
                },
              ]
            : undefined,
    })
  }

  return {
    clinician: {
      name: 'Dr. Sarah Chen',
      npi: '1750392145',
      specialty: 'Cardiology',
    },
    reputation: {
      overall: 86.2,
      quality: 88.5,
      credential: 91.0,
      enrollment: 83.5,
      peer: 81.0,
    },
    portfolio: [
      {
        id: 'p1',
        type: 'credential',
        name: 'Medical License',
        issuer: 'State Medical Board',
        status: 'active',
        expiryDate: '2026-12-31',
        lastUpdated: 'Nov 15, 2025',
      },
      {
        id: 'p2',
        type: 'credential',
        name: 'Board Certification - Cardiology',
        issuer: 'American Board of Internal Medicine',
        status: 'active',
        expiryDate: '2027-06-30',
        lastUpdated: 'Nov 10, 2025',
      },
      {
        id: 'p3',
        type: 'privilege',
        name: 'Cardiac Catheterization',
        issuer: 'Northwind Medical Center',
        status: 'active',
        lastUpdated: 'Oct 28, 2025',
      },
      {
        id: 'p4',
        type: 'enrollment',
        name: 'Medicare Enrollment',
        issuer: 'CMS',
        status: 'active',
        expiryDate: '2026-03-15',
        lastUpdated: 'Nov 1, 2025',
      },
      {
        id: 'p5',
        type: 'enrollment',
        name: 'Aetna Network',
        issuer: 'Aetna',
        status: 'expiring',
        expiryDate: '2025-12-20',
        lastUpdated: 'Oct 15, 2025',
      },
    ],
    factors: [
      {
        id: 'f1',
        type: 'positive',
        category: 'credential',
        description: 'Medical license renewed successfully',
        impact: 2.5,
        timestamp: 'Nov 15, 2025',
      },
      {
        id: 'f2',
        type: 'positive',
        category: 'enrollment',
        description: 'New payer enrollment approved (UnitedHealthcare)',
        impact: 1.5,
        timestamp: 'Nov 1, 2025',
      },
      {
        id: 'f3',
        type: 'positive',
        category: 'peer',
        description: 'Received peer endorsement from Dr. Martinez',
        impact: 0.8,
        timestamp: 'Oct 28, 2025',
      },
      {
        id: 'f4',
        type: 'negative',
        category: 'enrollment',
        description: 'Aetna enrollment expiring soon - renewal pending',
        impact: -1.2,
        timestamp: 'Oct 15, 2025',
      },
      {
        id: 'f5',
        type: 'positive',
        category: 'quality',
        description: 'OPPE score improved (92 → 94)',
        impact: 1.0,
        timestamp: 'Oct 10, 2025',
      },
    ],
    trend,
  }
}

