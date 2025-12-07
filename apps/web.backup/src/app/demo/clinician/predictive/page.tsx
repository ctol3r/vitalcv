'use client'

import { useMemo, useState } from 'react'
import { ForecastTrendChart, type ForecastDataPoint } from '@/components/predictive/ForecastTrendChart'
import { SignalExplanationDrawer, type FeatureContribution } from '@/components/predictive/SignalExplanationDrawer'
import { SafetyAlerts, type PredictedRisk, type RiskThreshold } from '@/components/predictive/SafetyAlerts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingDown, TrendingUp, Zap } from 'lucide-react'

type RiskDriver = {
  id: string
  label: string
  impact: 'positive' | 'negative' // positive = increases risk, negative = decreases
  magnitude: number // 0-1
  evidence: string[]
  category: 'quality' | 'volume' | 'credentialing' | 'compliance' | 'other'
}

type WhatIfScenario = {
  id: string
  name: string
  description: string
  action: string
  expectedImpact: {
    risk7d: number
    risk14d: number
    risk30d: number
    risk60d: number
  }
}

const PRIVILEGE_DATA = {
  name: 'Procedural sedation',
  facility: 'Main OR • Campus A',
  currentRisk: {
    risk7d: 45,
    risk14d: 58,
    risk30d: 72,
    risk60d: 85,
  },
  trajectory: [
    { date: '2024-01-01', risk7d: 42, risk14d: 55, risk30d: 68, risk60d: 80 },
    { date: '2024-01-08', risk7d: 44, risk14d: 57, risk30d: 70, risk60d: 82 },
    { date: '2024-01-15', risk7d: 45, risk14d: 58, risk30d: 72, risk60d: 85 },
  ],
  keyDrivers: [
    {
      id: 'driver-1',
      label: 'OPPE volume drop',
      impact: 'positive',
      magnitude: 0.65,
      evidence: ['OPPE bot: 15% drop in last 30d', 'Case volume tracking'],
      category: 'volume',
    },
    {
      id: 'driver-2',
      label: 'FPPE variance',
      impact: 'positive',
      magnitude: 0.48,
      evidence: ['Peer review notes: 2 flagged cases', 'Committee review pending'],
      category: 'quality',
    },
    {
      id: 'driver-3',
      label: 'Simulation hours gap',
      impact: 'positive',
      magnitude: 0.32,
      evidence: ['Credentialing DB: 45h required, 30h completed', 'Deadline: 14 days'],
      category: 'credentialing',
    },
    {
      id: 'driver-4',
      label: 'DEA sync stable',
      impact: 'negative',
      magnitude: 0.15,
      evidence: ['DEA registry: All licenses active', 'No flags'],
      category: 'compliance',
    },
  ] as RiskDriver[],
  whatIfScenarios: [
    {
      id: 'scenario-1',
      name: 'Complete simulation hours',
      description: 'Complete remaining 15 hours of simulation training',
      action: 'Complete simulation hours within 7 days',
      expectedImpact: {
        risk7d: 38,
        risk14d: 48,
        risk30d: 58,
        risk60d: 68,
      },
    },
    {
      id: 'scenario-2',
      name: 'Address FPPE variance',
      description: 'Resolve peer review flagged cases with addendum',
      action: 'Submit peer review addendum within 3 days',
      expectedImpact: {
        risk7d: 42,
        risk14d: 52,
        risk30d: 62,
        risk60d: 72,
      },
    },
    {
      id: 'scenario-3',
      name: 'Increase case volume',
      description: 'Return to historical case volume levels',
      action: 'Schedule additional cases to meet volume targets',
      expectedImpact: {
        risk7d: 40,
        risk14d: 50,
        risk30d: 65,
        risk60d: 78,
      },
    },
  ] as WhatIfScenario[],
}

const THRESHOLDS: RiskThreshold[] = [
  { horizon: '7d', critical: 75, high: 60, medium: 45 },
  { horizon: '14d', critical: 80, high: 65, medium: 50 },
  { horizon: '30d', critical: 85, high: 70, medium: 55 },
  { horizon: '60d', critical: 90, high: 75, medium: 60 },
]

export default function ClinicianPredictivePage() {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'procedural' | 'prescribing' | 'supervision' | 'consultation'>('all')
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [explanationOpen, setExplanationOpen] = useState(false)

  const forecastData: ForecastDataPoint[] = useMemo(() => {
    return PRIVILEGE_DATA.trajectory.map((point) => ({
      date: point.date,
      risk7d: point.risk7d,
      risk14d: point.risk14d,
      risk30d: point.risk30d,
      risk60d: point.risk60d,
      category: 'procedural' as const,
    }))
  }, [])

  const predictedRisks: PredictedRisk[] = useMemo(() => {
    const current = PRIVILEGE_DATA.currentRisk
    return [
      {
        id: 'current-7d',
        privilegeId: 'sedation',
        privilegeName: PRIVILEGE_DATA.name,
        horizon: '7d',
        value: current.risk7d,
        timestamp: new Date().toISOString(),
        category: 'procedural',
      },
      {
        id: 'current-14d',
        privilegeId: 'sedation',
        privilegeName: PRIVILEGE_DATA.name,
        horizon: '14d',
        value: current.risk14d,
        timestamp: new Date().toISOString(),
        category: 'procedural',
      },
      {
        id: 'current-30d',
        privilegeId: 'sedation',
        privilegeName: PRIVILEGE_DATA.name,
        horizon: '30d',
        value: current.risk30d,
        timestamp: new Date().toISOString(),
        category: 'procedural',
      },
      {
        id: 'current-60d',
        privilegeId: 'sedation',
        privilegeName: PRIVILEGE_DATA.name,
        horizon: '60d',
        value: current.risk60d,
        timestamp: new Date().toISOString(),
        category: 'procedural',
      },
    ]
  }, [])

  const featureContributions: FeatureContribution[] = useMemo(() => {
    return PRIVILEGE_DATA.keyDrivers.map((driver) => ({
      feature: driver.label,
      contribution: driver.impact === 'positive' ? driver.magnitude : -driver.magnitude,
      evidence: driver.evidence,
    }))
  }, [])

  const selectedScenarioData = PRIVILEGE_DATA.whatIfScenarios.find((s) => s.id === selectedScenario)

  const handleAutoHoldTrigger = (alert: any) => {
    console.log('Auto-hold triggered for:', alert)
  }

  const handleAlertClick = (alert: any) => {
    setExplanationOpen(true)
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Predictive Safety</p>
        <h1 className="text-3xl font-bold tracking-tight">Predicted risk trajectory</h1>
        <p className="text-muted-foreground max-w-3xl">
          View predicted risk across forecast horizons, key drivers contributing to risk, and what-if analysis to explore
          remediation scenarios.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{PRIVILEGE_DATA.name}</CardTitle>
            <CardDescription>{PRIVILEGE_DATA.facility}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">7 days</dt>
                <dd className="mt-1 text-2xl font-bold">{Math.round(PRIVILEGE_DATA.currentRisk.risk7d)}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">14 days</dt>
                <dd className="mt-1 text-2xl font-bold">{Math.round(PRIVILEGE_DATA.currentRisk.risk14d)}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">30 days</dt>
                <dd className="mt-1 text-2xl font-bold">{Math.round(PRIVILEGE_DATA.currentRisk.risk30d)}%</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">60 days</dt>
                <dd className="mt-1 text-2xl font-bold">{Math.round(PRIVILEGE_DATA.currentRisk.risk60d)}%</dd>
              </div>
            </dl>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Risk trajectory</p>
                <Button size="sm" variant="outline" onClick={() => setExplanationOpen(true)}>
                  Explain prediction
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <SafetyAlerts risks={predictedRisks} thresholds={THRESHOLDS} onAutoHoldTrigger={handleAutoHoldTrigger} onAlertClick={handleAlertClick} />
      </section>

      <ForecastTrendChart
        data={forecastData}
        title="Predicted risk trajectory"
        description="Risk forecast across 7/14/30/60 day horizons"
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Key risk drivers
            </CardTitle>
            <CardDescription>Features contributing most to predicted risk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRIVILEGE_DATA.keyDrivers.map((driver, index) => {
              const isPositive = driver.impact === 'positive'
              const Icon = isPositive ? TrendingUp : TrendingDown

              return (
                <article key={driver.id} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {index + 1}
                        </span>
                        <p className="font-semibold">{driver.label}</p>
                        <Badge variant="outline" className="text-xs" style={{ textTransform: 'capitalize' }}>
                          {driver.category}
                        </Badge>
                        <Icon
                          className={cn('h-4 w-4', isPositive ? 'text-rose-600' : 'text-emerald-600')}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className={cn('h-2 rounded-full transition-all', isPositive ? 'bg-rose-500' : 'bg-emerald-500')}
                            style={{ width: `${Math.min(100, driver.magnitude * 100)}%` }}
                            aria-hidden="true"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{Math.round(driver.magnitude * 100)}%</span>
                      </div>

                      {driver.evidence.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {driver.evidence.map((ev, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="mt-0.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden="true" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What-if remediation analysis</CardTitle>
            <CardDescription>Explore potential remediation scenarios and their expected impact</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRIVILEGE_DATA.whatIfScenarios.map((scenario) => {
              const isSelected = selectedScenario === scenario.id
              const improvement7d = PRIVILEGE_DATA.currentRisk.risk7d - scenario.expectedImpact.risk7d
              const improvement60d = PRIVILEGE_DATA.currentRisk.risk60d - scenario.expectedImpact.risk60d

              return (
                <article
                  key={scenario.id}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'bg-background hover:bg-muted/50',
                  )}
                  onClick={() => setSelectedScenario(isSelected ? null : scenario.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{scenario.name}</p>
                        {isSelected && <Badge variant="outline" className="text-xs">Selected</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">Action: {scenario.action}</p>

                      {isSelected && (
                        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Expected impact
                          </p>
                          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                            <div>
                              <dt className="text-muted-foreground">7d</dt>
                              <dd className="font-semibold">
                                {Math.round(scenario.expectedImpact.risk7d)}%
                                {improvement7d > 0 && (
                                  <span className="ml-1 text-emerald-600">-{Math.round(improvement7d)}%</span>
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">14d</dt>
                              <dd className="font-semibold">{Math.round(scenario.expectedImpact.risk14d)}%</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">30d</dt>
                              <dd className="font-semibold">{Math.round(scenario.expectedImpact.risk30d)}%</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">60d</dt>
                              <dd className="font-semibold">
                                {Math.round(scenario.expectedImpact.risk60d)}%
                                {improvement60d > 0 && (
                                  <span className="ml-1 text-emerald-600">-{Math.round(improvement60d)}%</span>
                                )}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <SignalExplanationDrawer
        open={explanationOpen}
        onOpenChange={setExplanationOpen}
        signalId="sedation"
        predictedRisk={PRIVILEGE_DATA.currentRisk.risk30d}
        horizon="30d"
        features={featureContributions}
        privilegeName={PRIVILEGE_DATA.name}
      />
    </div>
  )
}

