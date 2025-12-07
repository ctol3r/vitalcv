'use client'

import { useMemo, useState } from 'react'
import { FutureTimeline, type TimelineEvent } from '@/components/lifecycle/FutureTimeline'
import { ForecastTrendChart, type ForecastDataPoint } from '@/components/predictive/ForecastTrendChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Award, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

type CredentialRenewal = {
  id: string
  name: string
  type: 'board' | 'license' | 'certification' | 'privilege'
  currentExpiry: string
  projectedRenewal: string
  status: 'current' | 'due_soon' | 'overdue' | 'projected'
  daysUntil: number
}

type PrivilegeMilestone = {
  id: string
  name: string
  category: 'procedural' | 'prescribing' | 'supervision' | 'consultation'
  currentLevel: number
  projectedLevel: number
  milestoneDate: string
  progress: number
}

type CompetencyGrowth = {
  date: string
  competency: number
  risk: number
}

type RiskEvent = {
  id: string
  date: string
  type: 'dip' | 'spike'
  value: number
  description: string
  category: 'credential' | 'training' | 'volume' | 'quality'
}

// Mock data
const MOCK_CREDENTIAL_RENEWALS: CredentialRenewal[] = [
  {
    id: 'board-1',
    name: 'ABMS Board Certification',
    type: 'board',
    currentExpiry: '2025-06-15',
    projectedRenewal: '2025-06-15',
    status: 'current',
    daysUntil: 217,
  },
  {
    id: 'license-1',
    name: 'State Medical License',
    type: 'license',
    currentExpiry: '2025-12-31',
    projectedRenewal: '2025-12-31',
    status: 'current',
    daysUntil: 416,
  },
  {
    id: 'dea-1',
    name: 'DEA License',
    type: 'license',
    currentExpiry: '2025-03-20',
    projectedRenewal: '2025-03-20',
    status: 'due_soon',
    daysUntil: 130,
  },
  {
    id: 'privilege-1',
    name: 'Procedural Sedation',
    type: 'privilege',
    currentExpiry: '2025-09-01',
    projectedRenewal: '2025-09-01',
    status: 'projected',
    daysUntil: 305,
  },
]

const MOCK_PRIVILEGE_MILESTONES: PrivilegeMilestone[] = [
  {
    id: 'milestone-1',
    name: 'Cardiac Cath Lab',
    category: 'procedural',
    currentLevel: 3,
    projectedLevel: 4,
    milestoneDate: '2025-05-15',
    progress: 75,
  },
  {
    id: 'milestone-2',
    name: 'ICU Supervision',
    category: 'supervision',
    currentLevel: 2,
    projectedLevel: 3,
    milestoneDate: '2025-08-01',
    progress: 45,
  },
  {
    id: 'milestone-3',
    name: 'Telehealth Prescribing',
    category: 'prescribing',
    currentLevel: 1,
    projectedLevel: 2,
    milestoneDate: '2025-04-30',
    progress: 90,
  },
]

const MOCK_COMPETENCY_GROWTH: CompetencyGrowth[] = [
  { date: '2024-01-01', competency: 65, risk: 45 },
  { date: '2024-04-01', competency: 68, risk: 42 },
  { date: '2024-07-01', competency: 72, risk: 38 },
  { date: '2024-10-01', competency: 75, risk: 35 },
  { date: '2025-01-01', competency: 78, risk: 32 },
  { date: '2025-04-01', competency: 82, risk: 28 },
  { date: '2025-07-01', competency: 85, risk: 25 },
]

const MOCK_RISK_EVENTS: RiskEvent[] = [
  {
    id: 'risk-1',
    date: '2025-02-15',
    type: 'spike',
    value: 72,
    description: 'Expected risk increase due to credential renewal period',
    category: 'credential',
  },
  {
    id: 'risk-2',
    date: '2025-05-01',
    type: 'dip',
    value: 28,
    description: 'Risk reduction after completing FPPE training',
    category: 'training',
  },
  {
    id: 'risk-3',
    date: '2025-08-15',
    type: 'spike',
    value: 65,
    description: 'Temporary increase during privilege expansion review',
    category: 'quality',
  },
]

const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'timeline-1',
    date: '2024-12-01',
    type: 'past',
    category: 'credential',
    title: 'Board certification maintained',
    description: 'ABMS board certification verified',
    status: 'completed',
  },
  {
    id: 'timeline-2',
    date: '2025-01-15',
    type: 'future',
    category: 'credential',
    title: 'DEA license renewal due',
    description: 'DEA license renewal required in 130 days',
    status: 'pending',
  },
  {
    id: 'timeline-3',
    date: '2025-04-30',
    type: 'future',
    category: 'privilege',
    title: 'Telehealth prescribing milestone',
    description: 'Expected to reach level 2 proficiency',
    status: 'projected',
  },
  {
    id: 'timeline-4',
    date: '2025-05-15',
    type: 'future',
    category: 'milestone',
    title: 'Cardiac cath lab milestone',
    description: 'Expected to reach level 4 proficiency',
    status: 'projected',
  },
  {
    id: 'timeline-5',
    date: '2025-06-15',
    type: 'future',
    category: 'credential',
    title: 'Board certification renewal',
    description: 'ABMS board certification renewal due',
    status: 'projected',
  },
]

export default function ClinicianLifecyclePage() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'credential' | 'privilege' | 'training'>('all')

  const forecastData: ForecastDataPoint[] = useMemo(() => {
    return MOCK_COMPETENCY_GROWTH.map((point) => ({
      date: point.date,
      risk7d: point.risk,
      risk14d: point.risk + 5,
      risk30d: point.risk + 12,
      risk60d: point.risk + 20,
      category: 'procedural' as const,
    }))
  }, [])

  const getStatusColor = (status: CredentialRenewal['status']) => {
    switch (status) {
      case 'current':
        return 'bg-emerald-50 text-emerald-900 border-emerald-200'
      case 'due_soon':
        return 'bg-amber-50 text-amber-900 border-amber-200'
      case 'overdue':
        return 'bg-rose-50 text-rose-900 border-rose-200'
      case 'projected':
        return 'bg-slate-50 text-slate-900 border-slate-200'
    }
  }

  const getTypeIcon = (type: CredentialRenewal['type']) => {
    switch (type) {
      case 'board':
        return Award
      case 'license':
        return FileCheck
      case 'certification':
        return Award
      case 'privilege':
        return TrendingUp
    }
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Lifecycle Forecast</p>
        <h1 className="text-3xl font-bold tracking-tight">Clinician lifecycle forecast</h1>
        <p className="text-muted-foreground max-w-3xl">
          Shows expected credential renewals, privilege milestones, projected competency growth, and risk dips/spikes across
          forecast horizons.
        </p>
      </header>

      {/* Credential renewals */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Expected credential renewals
            </CardTitle>
            <CardDescription>Upcoming credential and license renewal dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_CREDENTIAL_RENEWALS.map((renewal) => {
                const Icon = getTypeIcon(renewal.type)
                const isUrgent = renewal.daysUntil < 90

                return (
                  <article
                    key={renewal.id}
                    className={cn(
                      'rounded-lg border p-4 transition-shadow',
                      isUrgent && 'border-amber-300 bg-amber-50/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <h4 className="font-semibold">{renewal.name}</h4>
                          <Badge variant="outline" className={cn('text-xs', getStatusColor(renewal.status))}>
                            {renewal.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground">Expires: </span>
                            <span className="font-medium">{new Date(renewal.currentExpiry).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Days until: </span>
                            <span className={cn('font-medium', isUrgent && 'text-amber-600')}>
                              {renewal.daysUntil} days
                            </span>
                          </div>
                        </div>
                      </div>
                      {isUrgent && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                          Action required
                        </Badge>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Privilege milestones and competency growth */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Privilege milestones
            </CardTitle>
            <CardDescription>Expected privilege level progression</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {MOCK_PRIVILEGE_MILESTONES.map((milestone) => (
              <article key={milestone.id} className="rounded-lg border bg-background p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{milestone.name}</h4>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {milestone.category}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Level</div>
                      <div className="text-lg font-bold">
                        {milestone.currentLevel} → {milestone.projectedLevel}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{milestone.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${milestone.progress}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Expected: {new Date(milestone.milestoneDate).toLocaleDateString()}
                  </div>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Projected competency growth
            </CardTitle>
            <CardDescription>Expected competency improvement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_COMPETENCY_GROWTH.slice(-4).map((point, idx) => {
                const isProjected = idx >= MOCK_COMPETENCY_GROWTH.length - 2
                return (
                  <div key={point.date} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-semibold text-primary">{Math.round(point.competency)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium">Competency score</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(point.date).toLocaleDateString()}
                          {isProjected && <Badge variant="outline" className="ml-2 text-xs">Projected</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Risk</div>
                      <div className="text-sm font-semibold text-emerald-600">{Math.round(point.risk)}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Risk dips and spikes */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Risk dips and spikes
            </CardTitle>
            <CardDescription>Projected risk changes across forecast horizons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {MOCK_RISK_EVENTS.map((event) => {
                const Icon = event.type === 'spike' ? TrendingUp : TrendingDown
                const isSpike = event.type === 'spike'

                return (
                  <article
                    key={event.id}
                    className={cn(
                      'rounded-lg border p-4',
                      isSpike ? 'border-amber-200 bg-amber-50/30' : 'border-emerald-200 bg-emerald-50/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon
                            className={cn('h-4 w-4', isSpike ? 'text-amber-600' : 'text-emerald-600')}
                            aria-hidden="true"
                          />
                          <h4 className="font-semibold capitalize">{event.type}</h4>
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Risk value</div>
                        <div className={cn('text-lg font-bold', isSpike ? 'text-amber-600' : 'text-emerald-600')}>
                          {Math.round(event.value)}%
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Forecast trend and timeline */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ForecastTrendChart
          data={forecastData}
          title="Competency and risk trajectory"
          description="Projected competency growth and risk reduction over time"
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <FutureTimeline
          events={MOCK_TIMELINE_EVENTS}
          title="Lifecycle timeline"
          description="Credential renewals, privilege milestones, and projected events"
        />
      </section>
    </div>
  )
}

