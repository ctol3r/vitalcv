'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Radar, ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react'

export type PrivilegeRisk = {
  id: string
  name: string
  category: 'procedural' | 'prescribing' | 'supervision' | 'consultation'
  risk7d: number
  risk14d: number
  risk30d: number
  risk60d: number
  cci?: number // Clinical Competency Index
  predictiveSafety?: number // Predictive safety score
}

type RiskVisualizerProps = {
  risks: PrivilegeRisk[]
  className?: string
  title?: string
  description?: string
  selectedHorizon?: '7d' | '14d' | '30d' | '60d'
  onHorizonChange?: (horizon: '7d' | '14d' | '30d' | '60d') => void
}

const HORIZON_COLORS: Record<'7d' | '14d' | '30d' | '60d', string> = {
  '7d': 'hsl(221, 83%, 53%)', // blue
  '14d': 'hsl(142, 76%, 36%)', // green
  '30d': 'hsl(38, 92%, 50%)', // amber
  '60d': 'hsl(0, 84%, 60%)', // rose
}

const HORIZON_LABELS: Record<'7d' | '14d' | '30d' | '60d', string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '60d': '60 days',
}

const CATEGORY_COLORS: Record<PrivilegeRisk['category'], string> = {
  procedural: 'bg-blue-50 text-blue-900 border-blue-200',
  prescribing: 'bg-purple-50 text-purple-900 border-purple-200',
  supervision: 'bg-amber-50 text-amber-900 border-amber-200',
  consultation: 'bg-green-50 text-green-900 border-green-200',
}

const RADAR_SIZE = 400
const RADAR_CENTER = RADAR_SIZE / 2
const RADAR_RADIUS = RADAR_CENTER - 50

export function RiskVisualizer({
  risks,
  className,
  title = 'Lifecycle risk visualizer',
  description = 'Predicted risk across privilege categories',
  selectedHorizon = '30d',
  onHorizonChange,
}: RiskVisualizerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const positionedRisks = useMemo(() => {
    return risks.map((risk, index) => {
      const angle = (index / risks.length) * Math.PI * 2 - Math.PI / 2
      const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
      const radius = RADAR_RADIUS * (0.3 + (riskValue / 100) * 0.7)
      const x = RADAR_CENTER + Math.cos(angle) * radius
      const y = RADAR_CENTER + Math.sin(angle) * radius
      return { ...risk, x, y }
    })
  }, [risks, selectedHorizon])

  const selectedRisk = positionedRisks.find((r) => r.id === selectedId)

  // Group risks by category for summary
  const categorySummary = useMemo(() => {
    const summary: Record<PrivilegeRisk['category'], { count: number; avgRisk: number }> = {
      procedural: { count: 0, avgRisk: 0 },
      prescribing: { count: 0, avgRisk: 0 },
      supervision: { count: 0, avgRisk: 0 },
      consultation: { count: 0, avgRisk: 0 },
    }

    risks.forEach((risk) => {
      const category = risk.category
      const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
      summary[category].count++
      summary[category].avgRisk += riskValue
    })

    Object.keys(summary).forEach((cat) => {
      const key = cat as PrivilegeRisk['category']
      if (summary[key].count > 0) {
        summary[key].avgRisk = summary[key].avgRisk / summary[key].count
      }
    })

    return summary
  }, [risks, selectedHorizon])

  const getRiskLevel = (value: number): 'low' | 'medium' | 'high' | 'critical' => {
    if (value >= 75) return 'critical'
    if (value >= 60) return 'high'
    if (value >= 45) return 'medium'
    return 'low'
  }

  const getRiskColor = (level: ReturnType<typeof getRiskLevel>) => {
    switch (level) {
      case 'critical':
        return 'text-rose-600'
      case 'high':
        return 'text-amber-600'
      case 'medium':
        return 'text-sky-600'
      case 'low':
        return 'text-emerald-600'
    }
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex gap-2">
            {(['7d', '14d', '30d', '60d'] as const).map((horizon) => (
              <Button
                key={horizon}
                variant={selectedHorizon === horizon ? 'default' : 'outline'}
                size="sm"
                onClick={() => onHorizonChange?.(horizon)}
                className="text-xs"
              >
                {HORIZON_LABELS[horizon]}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Radar visualization */}
        <div
          className="relative mx-auto max-w-[420px]"
          role="img"
          aria-label={`Risk radar showing ${risks.length} privileges positioned by predicted risk for ${selectedHorizon} horizon.`}
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
                stroke="hsl(var(--border))"
                className="stroke-1"
                aria-hidden="true"
              />
            ))}

            {/* Risk level labels */}
            <text
              x={RADAR_CENTER + RADAR_RADIUS * 0.25}
              y={RADAR_CENTER - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              25%
            </text>
            <text
              x={RADAR_CENTER + RADAR_RADIUS * 0.5}
              y={RADAR_CENTER - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              50%
            </text>
            <text
              x={RADAR_CENTER + RADAR_RADIUS * 0.75}
              y={RADAR_CENTER - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              75%
            </text>
            <text
              x={RADAR_CENTER + RADAR_RADIUS}
              y={RADAR_CENTER - 8}
              textAnchor="middle"
              className="fill-foreground text-xs font-semibold"
            >
              100%
            </text>

            {/* Privilege nodes */}
            {positionedRisks.map((risk) => {
              const riskValue = risk[`risk${selectedHorizon}` as keyof PrivilegeRisk] as number
              const color = HORIZON_COLORS[selectedHorizon]
              const isSelected = selectedId === risk.id
              const riskLevel = getRiskLevel(riskValue)

              return (
                <g
                  key={risk.id}
                  onClick={() => setSelectedId(risk.id)}
                  className="cursor-pointer transition hover:opacity-80"
                >
                  <circle
                    cx={risk.x}
                    cy={risk.y}
                    r={isSelected ? 14 : 10}
                    fill={color}
                    stroke="hsl(var(--background))"
                    strokeWidth={isSelected ? 3 : 2}
                    opacity={0.9}
                  />
                  <text
                    x={risk.x}
                    y={risk.y - 20}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-semibold"
                  >
                    {risk.name}
                  </text>
                  <text x={risk.x} y={risk.y + 18} textAnchor="middle" className={cn('text-[10px] font-semibold', getRiskColor(riskLevel))}>
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
                  {risk.name}: Predicted risk {Math.round(riskValue)}% for {HORIZON_LABELS[selectedHorizon]}, category: {risk.category}.
                </dd>
              )
            })}
          </dl>
        </div>

        {/* Category summary */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 text-sm font-semibold">Risk by category</h4>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(categorySummary) as PrivilegeRisk['category'][]).map((category) => {
              const summary = categorySummary[category]
              if (summary.count === 0) return null

              const avgRisk = summary.avgRisk
              const riskLevel = getRiskLevel(avgRisk)

              return (
                <div key={category}>
                  <dt className="text-xs text-muted-foreground capitalize">{category}</dt>
                  <dd className="flex items-baseline gap-1.5">
                    <span className={cn('text-lg font-semibold', getRiskColor(riskLevel))}>
                      {Math.round(avgRisk)}
                    </span>
                    <span className="text-xs text-muted-foreground">%</span>
                  </dd>
                  <p className="text-xs text-muted-foreground">{summary.count} privilege{summary.count !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </dl>
        </div>

        {/* Selected risk details */}
        {selectedRisk && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">{selectedRisk.name}</h4>
                <Badge variant="outline" className={cn('text-xs mt-1', CATEGORY_COLORS[selectedRisk.category])}>
                  {selectedRisk.category}
                </Badge>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              {(['7d', '14d', '30d', '60d'] as const).map((horizon) => {
                const value = selectedRisk[`risk${horizon}` as keyof PrivilegeRisk] as number
                const riskLevel = getRiskLevel(value)
                return (
                  <div key={horizon}>
                    <dt className="text-xs text-muted-foreground">{HORIZON_LABELS[horizon]}</dt>
                    <dd className={cn('font-semibold', getRiskColor(riskLevel))}>{Math.round(value)}%</dd>
                  </div>
                )
              })}
            </dl>
            {(selectedRisk.cci !== undefined || selectedRisk.predictiveSafety !== undefined) && (
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-sm">
                {selectedRisk.cci !== undefined && (
                  <div>
                    <dt className="text-xs text-muted-foreground">CCI</dt>
                    <dd className="font-semibold">{Math.round(selectedRisk.cci)}</dd>
                  </div>
                )}
                {selectedRisk.predictiveSafety !== undefined && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Predictive safety</dt>
                    <dd className="font-semibold">{Math.round(selectedRisk.predictiveSafety)}</dd>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {risks.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No risk data available.</div>
        )}
      </CardContent>
    </Card>
  )
}

