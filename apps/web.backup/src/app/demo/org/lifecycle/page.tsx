'use client'

import { useMemo, useState } from 'react'
import { FutureTimeline, type TimelineEvent } from '@/components/lifecycle/FutureTimeline'
import { InterventionSimulator, type Intervention, type ProjectedOutcome } from '@/components/lifecycle/InterventionSimulator'
import { RiskVisualizer, type PrivilegeRisk } from '@/components/lifecycle/RiskVisualizer'
import { ForecastTrendChart, type ForecastDataPoint } from '@/components/predictive/ForecastTrendChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Shield, Users, FileCheck } from 'lucide-react'

// Mock data - in production, this would come from APIs
const MOCK_PRIVILEGE_RISKS: PrivilegeRisk[] = [
  {
    id: 'sedation',
    name: 'Procedural sedation',
    category: 'procedural',
    risk7d: 45,
    risk14d: 58,
    risk30d: 72,
    risk60d: 85,
    cci: 68,
    predictiveSafety: 55,
  },
  {
    id: 'telehealth',
    name: 'Telehealth prescribing',
    category: 'prescribing',
    risk7d: 22,
    risk14d: 28,
    risk30d: 35,
    risk60d: 42,
    cci: 82,
    predictiveSafety: 75,
  },
  {
    id: 'cardiac',
    name: 'Cardiac cath lab',
    category: 'procedural',
    risk7d: 52,
    risk14d: 65,
    risk30d: 78,
    risk60d: 88,
    cci: 58,
    predictiveSafety: 48,
  },
  {
    id: 'trauma',
    name: 'Trauma call team',
    category: 'supervision',
    risk7d: 68,
    risk14d: 75,
    risk30d: 82,
    risk60d: 92,
    cci: 52,
    predictiveSafety: 42,
  },
  {
    id: 'icu',
    name: 'ICU coverage',
    category: 'supervision',
    risk7d: 38,
    risk14d: 44,
    risk30d: 52,
    risk60d: 58,
    cci: 72,
    predictiveSafety: 68,
  },
]

const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'event-1',
    date: '2024-10-15',
    type: 'past',
    category: 'credential',
    title: 'Board certification renewed',
    description: 'ABMS board certification renewed for 10 clinicians',
    status: 'completed',
  },
  {
    id: 'event-2',
    date: '2024-11-01',
    type: 'past',
    category: 'privilege',
    title: 'Privilege review completed',
    description: 'Quarterly privilege review for procedural privileges',
    status: 'completed',
  },
  {
    id: 'event-3',
    date: new Date().toISOString().split('T')[0],
    type: 'future',
    category: 'enrollment',
    title: 'Payer enrollment update due',
    description: 'Medicare enrollment verification required',
    status: 'pending',
  },
  {
    id: 'event-4',
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'future',
    category: 'credential',
    title: 'DEA license renewal',
    description: '5 DEA licenses expiring in 30 days',
    status: 'projected',
  },
  {
    id: 'event-5',
    date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'future',
    category: 'compliance',
    title: 'Compact validity review',
    description: 'Nurse compact license validity check',
    status: 'projected',
  },
  {
    id: 'event-6',
    date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    type: 'future',
    category: 'milestone',
    title: 'Annual credentialing cycle',
    description: 'Full credentialing review for all active clinicians',
    status: 'projected',
  },
]

const MOCK_INTERVENTIONS: Intervention[] = [
  {
    id: 'renew-board',
    name: 'Renew board certification early',
    description: 'Complete board certification renewal 60 days ahead of schedule',
    category: 'credential',
    action: 'Submit renewal application and documentation',
    enabled: false,
  },
  {
    id: 'fppe-training',
    name: 'Complete FPPE training',
    description: 'Complete focused professional practice evaluation training for high-risk privileges',
    category: 'training',
    action: 'Schedule and complete FPPE training modules',
    enabled: false,
  },
  {
    id: 'payer-enrollment',
    name: 'Update payer enrollment',
    description: 'Update Medicare and commercial payer enrollment status',
    category: 'enrollment',
    action: 'Submit updated enrollment forms to payers',
    enabled: false,
  },
  {
    id: 'compact-verification',
    name: 'Verify compact validity',
    description: 'Verify and update nurse compact license validity',
    category: 'compliance',
    action: 'Run compact validity check and update records',
    enabled: false,
  },
]

const BASELINE_OUTCOME: ProjectedOutcome = {
  risk7d: 45,
  risk14d: 58,
  risk30d: 72,
  risk60d: 85,
  privilegeReadiness: 68,
  enrollmentStability: 75,
  compactValidity: 82,
}

export default function OrgLifecyclePage() {
  const [selectedHorizon, setSelectedHorizon] = useState<'7d' | '14d' | '30d' | '60d'>('30d')

  const forecastData: ForecastDataPoint[] = useMemo(() => {
    const baseDate = new Date()
    return Array.from({ length: 12 }, (_, idx) => {
      const date = new Date(baseDate.getTime() + idx * 7 * 24 * 60 * 60 * 1000)
      // Mock trend data
      const baseRisk = 50 + idx * 2
      return {
        date: date.toISOString().split('T')[0],
        risk7d: baseRisk,
        risk14d: baseRisk + 8,
        risk30d: baseRisk + 20,
        risk60d: baseRisk + 35,
        category: 'procedural' as const,
      }
    })
  }, [])

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const avgRisk = MOCK_PRIVILEGE_RISKS.reduce((sum, risk) => {
      return sum + (risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number)
    }, 0) / MOCK_PRIVILEGE_RISKS.length

    const privilegeReadiness = MOCK_PRIVILEGE_RISKS.reduce((sum, risk) => sum + (risk.cci || 0), 0) / MOCK_PRIVILEGE_RISKS.length

    return {
      avgRisk: Math.round(avgRisk),
      privilegeReadiness: Math.round(privilegeReadiness),
      enrollmentStability: BASELINE_OUTCOME.enrollmentStability || 75,
      compactValidity: BASELINE_OUTCOME.compactValidity || 82,
    }
  }, [selectedHorizon])

  const handleSimulate = (enabledInterventions: string[], projectedOutcome: ProjectedOutcome) => {
    console.log('Simulation with interventions:', enabledInterventions, projectedOutcome)
    // In production, this would update the forecast engine and refresh data
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Lifecycle Trajectory</p>
        <h1 className="text-3xl font-bold tracking-tight">Lifecycle trajectory dashboard</h1>
        <p className="text-muted-foreground max-w-3xl">
          Displays projected risk curves, privilege readiness futures, enrollment stability, and compact validity horizon.
          Screen-reader friendly with comprehensive accessibility support.
        </p>
      </header>

      {/* Key metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. risk ({selectedHorizon})</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.avgRisk}%</div>
            <p className="text-xs text-muted-foreground">Across all privileges</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Privilege readiness</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.privilegeReadiness}%</div>
            <p className="text-xs text-muted-foreground">CCI average</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrollment stability</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.enrollmentStability}%</div>
            <p className="text-xs text-muted-foreground">Payer enrollment status</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compact validity</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateMetrics.compactValidity}%</div>
            <p className="text-xs text-muted-foreground">Nurse compact licenses</p>
          </CardContent>
        </Card>
      </section>

      {/* Risk visualizer and timeline */}
      <section className="grid gap-6 lg:grid-cols-2">
        <RiskVisualizer
          risks={MOCK_PRIVILEGE_RISKS}
          selectedHorizon={selectedHorizon}
          onHorizonChange={setSelectedHorizon}
          title="Risk across privileges"
          description="Predicted risk visualization integrating predictiveSafety + CCI + forecastEngine"
        />
        <FutureTimeline
          events={MOCK_TIMELINE_EVENTS}
          title="Lifecycle timeline"
          description="Past events and projected future milestones"
        />
      </section>

      {/* Forecast trend and intervention simulator */}
      <section className="grid gap-6 lg:grid-cols-2">
        <ForecastTrendChart
          data={forecastData}
          title="Projected risk curves"
          description="Risk forecast trajectory across time horizons"
        />
        <InterventionSimulator
          interventions={MOCK_INTERVENTIONS}
          baselineOutcome={BASELINE_OUTCOME}
          onSimulate={handleSimulate}
          title="Intervention simulator"
          description="Change future conditions to see new projected outcomes"
        />
      </section>
    </div>
  )
}

