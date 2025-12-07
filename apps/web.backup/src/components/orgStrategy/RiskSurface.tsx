'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AlertTriangle, TrendingUp } from 'lucide-react'

export type RiskDataPoint = {
  department: string
  specialty: string
  timePeriod: string // e.g., '2024-Q1', 'Week 48', etc.
  riskScore: number // 0-100
  riskTrend?: 'increasing' | 'stable' | 'decreasing'
  contributingFactors?: string[]
}

type RiskSurfaceProps = {
  data: RiskDataPoint[]
  className?: string
  title?: string
  description?: string
  selectedDepartment?: string
  selectedSpecialty?: string
  onDataPointClick?: (dataPoint: RiskDataPoint) => void
}

const RISK_COLORS = {
  critical: 'bg-rose-600',
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-emerald-400',
  minimal: 'bg-emerald-200',
}

const RISK_THRESHOLDS = {
  critical: 80,
  high: 60,
  medium: 40,
  low: 20,
  minimal: 0,
}

function getRiskLevel(score: number): keyof typeof RISK_COLORS {
  if (score >= RISK_THRESHOLDS.critical) return 'critical'
  if (score >= RISK_THRESHOLDS.high) return 'high'
  if (score >= RISK_THRESHOLDS.medium) return 'medium'
  if (score >= RISK_THRESHOLDS.low) return 'low'
  return 'minimal'
}

function getRiskColor(score: number): string {
  const level = getRiskLevel(score)
  return RISK_COLORS[level]
}

function getRiskOpacity(score: number): string {
  // Scale opacity based on score within its range
  const level = getRiskLevel(score)
  const baseThreshold = RISK_THRESHOLDS[level]
  const nextThreshold =
    level === 'critical'
      ? 100
      : level === 'high'
        ? RISK_THRESHOLDS.critical
        : level === 'medium'
          ? RISK_THRESHOLDS.high
          : level === 'low'
            ? RISK_THRESHOLDS.medium
            : RISK_THRESHOLDS.low

  const range = nextThreshold - baseThreshold || 1
  const position = (score - baseThreshold) / range
  const opacity = 0.3 + position * 0.7 // 0.3 to 1.0 opacity
  return `opacity-${Math.round(opacity * 100) / 10}`
}

export function RiskSurface({
  data,
  className,
  title = 'Strategic risk surface',
  description = 'Heatmap of predicted risk across departments, specialties, and time periods',
  selectedDepartment,
  selectedSpecialty,
  onDataPointClick,
}: RiskSurfaceProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | string>('all')

  // Extract unique values
  const departments = useMemo(() => [...new Set(data.map((d) => d.department))], [data])
  const specialties = useMemo(() => [...new Set(data.map((d) => d.specialty))], [data])
  const timePeriods = useMemo(() => [...new Set(data.map((d) => d.timePeriod))].sort(), [data])

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((d) => {
      if (selectedDepartment && d.department !== selectedDepartment) return false
      if (selectedSpecialty && d.specialty !== selectedSpecialty) return false
      if (selectedTimeframe !== 'all' && d.timePeriod !== selectedTimeframe) return false
      return true
    })
  }, [data, selectedDepartment, selectedSpecialty, selectedTimeframe])

  // Build heatmap matrix: rows = departments/specialties, cols = time periods
  const heatmapMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, RiskDataPoint>> = {}

    filteredData.forEach((point) => {
      const key = `${point.department} • ${point.specialty}`
      if (!matrix[key]) {
        matrix[key] = {}
      }
      matrix[key][point.timePeriod] = point
    })

    return matrix
  }, [filteredData])

  const rowKeys = Object.keys(heatmapMatrix).sort()

  // Calculate summary stats
  const stats = useMemo(() => {
    const scores = filteredData.map((d) => d.riskScore)
    const avgRisk = scores.reduce((sum, s) => sum + s, 0) / scores.length || 0
    const maxRisk = Math.max(...scores, 0)
    const criticalCount = filteredData.filter((d) => d.riskScore >= RISK_THRESHOLDS.critical).length
    return { avgRisk, maxRisk, criticalCount, total: filteredData.length }
  }, [filteredData])

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {selectedTimeframe && timePeriods.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant={selectedTimeframe === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedTimeframe('all')}
                className="text-xs"
              >
                All Time
              </Button>
              {timePeriods.slice(-6).map((period) => (
                <Button
                  key={period}
                  variant={selectedTimeframe === period ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTimeframe(period)}
                  className="text-xs"
                >
                  {period}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Avg Risk</span>
            <p className="font-semibold text-lg">{Math.round(stats.avgRisk)}%</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Max Risk</span>
            <p className="font-semibold text-lg text-rose-600">{Math.round(stats.maxRisk)}%</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Critical Areas</span>
            <p className="font-semibold text-lg text-rose-600">{stats.criticalCount}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No risk data available for selected filters.</div>
        ) : (
          <div className="space-y-4">
            {/* Heatmap */}
            <div className="overflow-x-auto">
              <div className="min-w-full inline-block">
                <table className="w-full border-collapse" role="table">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-background border-b border-r p-2 text-left text-xs font-semibold text-muted-foreground">
                        Dept • Specialty
                      </th>
                      {timePeriods.map((period) => (
                        <th
                          key={period}
                          className="border-b border-r p-2 text-center text-xs font-semibold text-muted-foreground min-w-[80px]"
                        >
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowKeys.map((rowKey) => {
                      const row = heatmapMatrix[rowKey]
                      return (
                        <tr key={rowKey} className="hover:bg-muted/30 transition-colors">
                          <td className="sticky left-0 z-10 bg-background border-r p-2 text-xs font-medium">
                            {rowKey}
                          </td>
                          {timePeriods.map((period) => {
                            const point = row[period]
                            if (!point) {
                              return (
                                <td key={period} className="border-r p-1 text-center">
                                  <div className="h-8 w-full bg-muted/20 rounded" />
                                </td>
                              )
                            }

                            const riskLevel = getRiskLevel(point.riskScore)
                            const riskColor = getRiskColor(point.riskScore)

                            return (
                              <td
                                key={period}
                                className={cn(
                                  'border-r p-1 text-center cursor-pointer transition-all',
                                  'hover:scale-105 hover:shadow-md',
                                )}
                                onClick={() => onDataPointClick?.(point)}
                              >
                                <div
                                  className={cn(
                                    'h-8 w-full rounded border flex items-center justify-center relative group',
                                    riskColor,
                                    'hover:ring-2 hover:ring-foreground/20',
                                  )}
                                  title={`Risk: ${point.riskScore.toFixed(1)}%`}
                                >
                                  <span className="text-xs font-semibold text-white drop-shadow-sm">
                                    {Math.round(point.riskScore)}
                                  </span>
                                  {point.riskTrend === 'increasing' && (
                                    <TrendingUp className="absolute -top-1 -right-1 h-3 w-3 text-white opacity-80" />
                                  )}
                                  {/* Tooltip on hover */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                                    <div className="bg-popover border rounded-lg p-2 shadow-lg text-xs min-w-[200px]">
                                      <p className="font-semibold">{rowKey}</p>
                                      <p className="text-muted-foreground">{period}</p>
                                      <p className="mt-1">
                                        Risk: <span className="font-semibold">{point.riskScore.toFixed(1)}%</span>
                                      </p>
                                      {point.riskTrend && (
                                        <p className="text-muted-foreground capitalize">Trend: {point.riskTrend}</p>
                                      )}
                                      {point.contributingFactors && point.contributingFactors.length > 0 && (
                                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                                          {point.contributingFactors.slice(0, 3).map((factor, idx) => (
                                            <li key={idx}>• {factor}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-semibold text-muted-foreground">Risk Levels:</span>
              {Object.entries(RISK_THRESHOLDS).map(([level, threshold], idx, arr) => {
                const nextThreshold = idx < arr.length - 1 ? arr[idx + 1][1] : 100
                return (
                  <div key={level} className="flex items-center gap-2">
                    <div className={cn('h-4 w-4 rounded', RISK_COLORS[level as keyof typeof RISK_COLORS])} />
                    <span className="text-muted-foreground capitalize">
                      {level} ({threshold}-{nextThreshold}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

