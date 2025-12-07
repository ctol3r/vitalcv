'use client'

import { useMemo, useState } from 'react'
import { SafetyAlerts, type PredictedRisk, type RiskThreshold } from '@/components/predictive/SafetyAlerts'
import { ForecastTrendChart, type ForecastDataPoint } from '@/components/predictive/ForecastTrendChart'
import { SignalExplanationDrawer, type FeatureContribution } from '@/components/predictive/SignalExplanationDrawer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Radar, ShieldAlert } from 'lucide-react'

type PrivilegeRisk = {
  id: string
  name: string
  category: 'procedural' | 'prescribing' | 'supervision' | 'consultation'
  risk7d: number
  risk14d: number
  risk30d: number
  risk60d: number
  x: number
  y: number
  features?: FeatureContribution[]
}

const HORIZON_COLORS: Record<'7d' | '14d' | '30d' | '60d', string> = {
  '7d': '#3b82f6', // blue
  '14d': '#10b981', // green
  '30d': '#f59e0b', // amber
  '60d': '#ef4444', // rose
}

const HORIZON_LABELS: Record<'7d' | '14d' | '30d' | '60d', string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '60d': '60 days',
}

const RADAR_SIZE = 500
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = RADAR_CENTER - 40

const PRIVILEGE_RISKS: PrivilegeRisk[] = [
  {
    id: 'sedation',
    name: 'Procedural sedation',
    category: 'procedural',
    risk7d: 45,
    risk14d: 58,
    risk30d: 72,
    risk60d: 85,
    features: [
      { feature: 'OPPE volume drop', contribution: 0.35, evidence: ['OPPE bot', 'Case volume tracking'] },
      { feature: 'FPPE variance', contribution: 0.28, evidence: ['Peer review notes'] },
      { feature: 'Simulation hours gap', contribution: 0.15, evidence: ['Credentialing DB'] },
    ],
  },
  {
    id: 'telehealth',
    name: 'Telehealth prescribing',
    category: 'prescribing',
    risk7d: 22,
    risk14d: 28,
    risk30d: 35,
    risk60d: 42,
    features: [
      { feature: 'DEA sync stable', contribution: -0.12, evidence: ['DEA registry'] },
      { feature: 'Compact compliance', contribution: -0.08, evidence: ['NPI registry'] },
    ],
  },
  {
    id: 'cardiac',
    name: 'Cardiac cath lab',
    category: 'procedural',
    risk7d: 52,
    risk14d: 65,
    risk30d: 78,
    risk60d: 88,
    features: [
      { feature: 'OPPE volume drop', contribution: 0.42, evidence: ['Cath lab registry'] },
      { feature: 'Case mix complexity', contribution: 0.25, evidence: ['EHR analytics'] },
    ],
  },
  {
    id: 'trauma',
    name: 'Trauma call team',
    category: 'supervision',
    risk7d: 68,
    risk14d: 75,
    risk30d: 82,
    risk60d: 92,
    features: [
      { feature: 'Critical FPPE variance', contribution: 0.48, evidence: ['Committee notes'] },
      { feature: 'Event under review', contribution: 0.32, evidence: ['Safety reports'] },
    ],
  },
  {
    id: 'icu',
    name: 'ICU coverage',
    category: 'supervision',
    risk7d: 38,
    risk14d: 44,
    risk30d: 52,
    risk60d: 58,
    features: [
      { feature: 'Night differential staffing', contribution: 0.18, evidence: ['Staffing DB'] },
      { feature: 'OPPE stable', contribution: -0.12, evidence: ['Quality metrics'] },
    ],
  },
  {
    id: 'surgery',
    name: 'Outpatient surgery',
    category: 'procedural',
    risk7d: 42,
    risk14d: 55,
    risk30d: 68,
    risk60d: 75,
    features: [
      { feature: 'EHR drift on implants', contribution: 0.28, evidence: ['EHR sync monitor'] },
      { feature: 'Packet addendum pending', contribution: 0.15, evidence: ['Credentialing workflow'] },
    ],
  },
]

const THRESHOLDS: RiskThreshold[] = [
  { horizon: '7d', critical: 75, high: 60, medium: 45 },
  { horizon: '14d', critical: 80, high: 65, medium: 50 },
  { horizon: '30d', critical: 85, high: 70, medium: 55 },
  { horizon: '60d', critical: 90, high: 75, medium: 60 },
]

export default function OrgPredictiveSafetyPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedHorizon, setSelectedHorizon] = useState<'7d' | '14d' | '30d' | '60d'>('30d')
  const [explanationOpen, setExplanationOpen] = useState(false)

  const positionedRisks = useMemo(() => {
    return PRIVILEGE_RISKS.map((risk, index) => {
      const angle = (index / PRIVILEGE_RISKS.length) * Math.PI * 2 - Math.PI / 2
      // Position based on risk for selected horizon
      const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
      const radius = RADAR_RADIUS * (0.3 + (riskValue / 100) * 0.7)
      const x = RADAR_CENTER + Math.cos(angle) * radius
      const y = RADAR_CENTER + Math.sin(angle) * radius
      return { ...risk, x, y }
    })
  }, [selectedHorizon])

  const selectedRisk = positionedRisks.find((r) => r.id === selectedId)

  const forecastData: ForecastDataPoint[] = useMemo(() => {
    const baseDate = new Date()
    return PRIVILEGE_RISKS.map((risk, idx) => ({
      date: new Date(baseDate.getTime() + idx * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      risk7d: risk.risk7d,
      risk14d: risk.risk14d,
      risk30d: risk.risk30d,
      risk60d: risk.risk60d,
      category: risk.category,
    }))
  }, [])

  const predictedRisks: PredictedRisk[] = useMemo(() => {
    return positionedRisks.flatMap((risk) => [
      {
        id: risk.id,
        privilegeId: risk.id,
        privilegeName: risk.name,
        horizon: '7d' as const,
        value: risk.risk7d,
        timestamp: new Date().toISOString(),
        category: risk.category,
      },
      {
        id: `${risk.id}-14d`,
        privilegeId: risk.id,
        privilegeName: risk.name,
        horizon: '14d' as const,
        value: risk.risk14d,
        timestamp: new Date().toISOString(),
        category: risk.category,
      },
      {
        id: `${risk.id}-30d`,
        privilegeId: risk.id,
        privilegeName: risk.name,
        horizon: '30d' as const,
        value: risk.risk30d,
        timestamp: new Date().toISOString(),
        category: risk.category,
      },
      {
        id: `${risk.id}-60d`,
        privilegeId: risk.id,
        privilegeName: risk.name,
        horizon: '60d' as const,
        value: risk.risk60d,
        timestamp: new Date().toISOString(),
        category: risk.category,
      },
    ])
  }, [positionedRisks])

  const handleAutoHoldTrigger = (alert: any) => {
    console.log('Auto-hold triggered for:', alert)
    // In production, this would trigger SafetyRadar auto-hold
  }

  const handleAlertClick = (alert: any) => {
    const risk = PRIVILEGE_RISKS.find((r) => r.id === alert.privilegeId)
    if (risk) {
      setSelectedId(risk.id)
      setSelectedHorizon(alert.horizon)
      setExplanationOpen(true)
    }
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Org • Predictive Safety</p>
        <h1 className="text-3xl font-bold tracking-tight">Predictive safety radar</h1>
        <p className="text-muted-foreground max-w-3xl">
          Radar visualization of predicted risk across forecast horizons (7/14/30/60 days). Each node represents a privilege,
          positioned by predicted risk level. Colors indicate forecast horizons, and the visualization is screen-reader friendly
          with text equivalents for all risk values.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Radar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                Risk forecast radar
              </CardTitle>
              <CardDescription>Predicted risk levels across forecast horizons.</CardDescription>
            </div>
            <div className="flex gap-2">
              {(['7d', '14d', '30d', '60d'] as const).map((horizon) => (
                <Button
                  key={horizon}
                  variant={selectedHorizon === horizon ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedHorizon(horizon)}
                  className="text-xs"
                >
                  {HORIZON_LABELS[horizon]}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {(['7d', '14d', '30d', '60d'] as const).map((horizon) => (
                <span key={horizon} className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: HORIZON_COLORS[horizon] }} aria-hidden="true" />
                  {HORIZON_LABELS[horizon]}
                </span>
              ))}
            </div>

            <div
              className="relative mx-auto max-w-[520px]"
              role="img"
              aria-label={`Predictive safety radar showing risk levels for ${selectedHorizon} horizon. Each privilege is positioned by predicted risk value.`}
            >
              <svg width={RADAR_SIZE} height={RADAR_SIZE} className="w-full" aria-hidden="true">
                {/* Concentric circles */}
                {[0.25, 0.5, 0.75, 1].map((ratio) => (
                  <circle
                    key={ratio}
                    cx={RADAR_CENTER}
                    cy={RADAR_CENTER}
                    r={RADAR_RADIUS * ratio}
                    fill="none"
                    stroke="#e5e7eb"
                    className="stroke-1"
                    aria-hidden="true"
                  />
                ))}

                {/* Risk level labels */}
                <text x={RADAR_CENTER + RADAR_RADIUS * 0.25} y={RADAR_CENTER - 8} textAnchor="middle" className="fill-slate-400 text-xs">
                  25%
                </text>
                <text x={RADAR_CENTER + RADAR_RADIUS * 0.5} y={RADAR_CENTER - 8} textAnchor="middle" className="fill-slate-400 text-xs">
                  50%
                </text>
                <text x={RADAR_CENTER + RADAR_RADIUS * 0.75} y={RADAR_CENTER - 8} textAnchor="middle" className="fill-slate-400 text-xs">
                  75%
                </text>
                <text x={RADAR_CENTER + RADAR_RADIUS} y={RADAR_CENTER - 8} textAnchor="middle" className="fill-slate-500 text-xs font-semibold">
                  100%
                </text>

                {/* Privilege nodes */}
                {positionedRisks.map((risk) => {
                  const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
                  const color = HORIZON_COLORS[selectedHorizon]
                  const isSelected = selectedId === risk.id

                  return (
                    <g
                      key={risk.id}
                      onClick={() => setSelectedId(risk.id)}
                      className="cursor-pointer transition hover:opacity-80 focus:outline-hidden"
                    >
                      <circle
                        cx={risk.x}
                        cy={risk.y}
                        r={isSelected ? 14 : 10}
                        fill={color}
                        stroke="#0f172a"
                        strokeWidth={isSelected ? 3 : 2}
                        opacity={0.9}
                      />
                      <text
                        x={risk.x}
                        y={risk.y - 20}
                        textAnchor="middle"
                        className="fill-slate-700 text-[11px] font-semibold"
                      >
                        {risk.name}
                      </text>
                      <text x={risk.x} y={risk.y + 18} textAnchor="middle" className="fill-slate-500 text-[10px]">
                        {Math.round(riskValue)}%
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Screen reader description */}
              <dl className="sr-only">
                <dt>Forecast horizon: {HORIZON_LABELS[selectedHorizon]}</dt>
                {positionedRisks.map((risk) => {
                  const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
                  return (
                    <dd key={risk.id}>
                      {risk.name}: Predicted risk {Math.round(riskValue)}% for {HORIZON_LABELS[selectedHorizon]}.
                    </dd>
                  )
                })}
              </dl>
            </div>

            {selectedRisk && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selectedRisk.name}</p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedRisk.category}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setExplanationOpen(true)}>
                    View explanation
                  </Button>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  {(['7d', '14d', '30d', '60d'] as const).map((horizon) => {
                    const value = selectedRisk[`risk${horizon}` as keyof PrivilegeRisk] as number
                    return (
                      <div key={horizon}>
                        <dt className="text-muted-foreground">{HORIZON_LABELS[horizon]}</dt>
                        <dd className="font-semibold">{Math.round(value)}%</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )}
          </CardContent>
        </Card>

        <SafetyAlerts risks={predictedRisks} thresholds={THRESHOLDS} onAutoHoldTrigger={handleAutoHoldTrigger} onAlertClick={handleAlertClick} />
      </section>

      <section>
        <ForecastTrendChart data={forecastData} title="Forecast trend across privileges" />
      </section>

      <SignalExplanationDrawer
        open={explanationOpen}
        onOpenChange={setExplanationOpen}
        signalId={selectedRisk?.id || ''}
        predictedRisk={(selectedRisk?.[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number) || 0}
        horizon={selectedHorizon}
        features={selectedRisk?.features || []}
        privilegeName={selectedRisk?.name}
      />
    </div>
  )
}

