'use client'

import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Filter } from 'lucide-react'

type ReputationMetric = 'overall' | 'quality' | 'credential' | 'enrollment' | 'peer'

type ReputationTrendDatum = {
  date: string
  overall: number
  quality: number
  credential: number
  enrollment: number
  peer: number
  events?: Array<{
    id: string
    type: string
    description: string
    impact: number
    timestamp: string
  }>
}

type ReputationTrendChartProps = {
  title: string
  description?: string
  data: ReputationTrendDatum[]
  className?: string
  srHint?: string
}

const SVG_HEIGHT = 200
const SVG_WIDTH = 600
const SVG_PADDING = 32

const METRIC_COLORS: Record<ReputationMetric, string> = {
  overall: 'hsl(var(--primary))',
  quality: 'hsl(142, 71%, 45%)',
  credential: 'hsl(217, 91%, 60%)',
  enrollment: 'hsl(38, 92%, 50%)',
  peer: 'hsl(280, 78%, 60%)',
}

const METRIC_LABELS: Record<ReputationMetric, string> = {
  overall: 'Overall',
  quality: 'Quality',
  credential: 'Credential',
  enrollment: 'Enrollment',
  peer: 'Peer',
}

export function ReputationTrendChart({ title, description, data, className, srHint }: ReputationTrendChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<ReputationMetric>>(new Set(['overall']))
  const descriptionId = useId()
  const srId = useId()

  const toggleMetric = (metric: ReputationMetric) => {
    const newSet = new Set(visibleMetrics)
    if (newSet.has(metric)) {
      newSet.delete(metric)
    } else {
      newSet.add(metric)
    }
    setVisibleMetrics(newSet)
  }

  const computed = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        min: 0,
        max: 100,
        paths: {} as Record<ReputationMetric, string>,
        points: {} as Record<ReputationMetric, Array<{ x: number; y: number; datum: ReputationTrendDatum }>>,
      }
    }

    const allValues = data.flatMap((d) => Array.from(visibleMetrics).map((m) => d[m]))
    const min = Math.max(0, Math.min(...allValues) - 5)
    const max = Math.min(100, Math.max(...allValues) + 5)
    const range = max - min || 1

    const width = SVG_WIDTH - SVG_PADDING * 2
    const height = SVG_HEIGHT - SVG_PADDING * 2

    const paths: Record<ReputationMetric, string> = {} as any
    const points: Record<ReputationMetric, Array<{ x: number; y: number; datum: ReputationTrendDatum }>> = {} as any

    ;(['overall', 'quality', 'credential', 'enrollment', 'peer'] as ReputationMetric[]).forEach((metric) => {
      const metricPoints = data.map((datum, index) => {
        const x = SVG_PADDING + (width * index) / Math.max(data.length - 1, 1)
        const y = SVG_PADDING + height * (1 - (datum[metric] - min) / range)
        return { x, y, datum }
      })
      points[metric] = metricPoints
      paths[metric] = metricPoints.map((p) => `${p.x},${p.y}`).join(' ')
    })

    return { min, max, paths, points }
  }, [data, visibleMetrics])

  const latestData = data.at(-1)
  const previousData = data.at(-2) || latestData
  const latestOverall = latestData?.overall ?? 0
  const previousOverall = previousData?.overall ?? latestOverall
  const delta = latestOverall - previousOverall
  const trendLabel = delta === 0 ? 'No change' : delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{title}</span>
        </CardTitle>
        {description && <CardDescription id={descriptionId}>{description}</CardDescription>}
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold">{latestOverall.toFixed(1)}</p>
          <Badge variant={delta >= 0 ? 'default' : 'destructive'} className="text-sm">
            {trendLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Toggle metric visibility">
            {(['overall', 'quality', 'credential', 'enrollment', 'peer'] as ReputationMetric[]).map((metric) => (
              <Button
                key={metric}
                size="sm"
                variant={visibleMetrics.has(metric) ? 'default' : 'outline'}
                onClick={() => toggleMetric(metric)}
                className="capitalize"
                style={visibleMetrics.has(metric) ? { backgroundColor: METRIC_COLORS[metric] } : undefined}
              >
                {METRIC_LABELS[metric]}
              </Button>
            ))}
          </div>

          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data to display.</p>
          ) : (
            <div className="space-y-3">
              <svg
                role="img"
                aria-labelledby={description ? `${descriptionId} ${srId}` : srId}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="w-full overflow-visible"
              >
                <defs>
                  {(['overall', 'quality', 'credential', 'enrollment', 'peer'] as ReputationMetric[]).map((metric) => (
                    <linearGradient key={metric} id={`gradient-${metric}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={METRIC_COLORS[metric]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((value) => {
                  const y = SVG_PADDING + ((SVG_HEIGHT - SVG_PADDING * 2) * (100 - value)) / 100
                  return (
                    <line
                      key={value}
                      x1={SVG_PADDING}
                      x2={SVG_WIDTH - SVG_PADDING}
                      y1={y}
                      y2={y}
                      stroke="hsl(var(--muted))"
                      strokeDasharray="2 2"
                      strokeWidth="1"
                      opacity={0.3}
                      aria-hidden="true"
                    />
                  )
                })}

                {/* Metric lines */}
                {Array.from(visibleMetrics).map((metric) => {
                  const path = computed.paths[metric]
                  if (!path) return null
                  return (
                    <g key={metric}>
                      <polyline
                        fill="none"
                        stroke={METRIC_COLORS[metric]}
                        strokeWidth="2.5"
                        points={path}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="presentation"
                      />
                      <polygon
                        points={`${path} ${SVG_WIDTH - SVG_PADDING},${SVG_HEIGHT - SVG_PADDING} ${SVG_PADDING},${SVG_HEIGHT - SVG_PADDING}`}
                        fill={`url(#gradient-${metric})`}
                        opacity={0.15}
                        role="presentation"
                      />
                    </g>
                  )
                })}

                {/* Data points */}
                {Array.from(visibleMetrics).map((metric) =>
                  computed.points[metric]?.map(({ x, y, datum }) => (
                    <circle
                      key={`${metric}-${datum.date}`}
                      cx={x}
                      cy={y}
                      r={4}
                      fill={METRIC_COLORS[metric]}
                      stroke="hsl(var(--background))"
                      strokeWidth="2"
                      role="presentation"
                    >
                      <title>
                        {METRIC_LABELS[metric]}: {datum[metric].toFixed(1)} ({datum.date})
                      </title>
                    </circle>
                  )),
                )}

                {/* Event markers */}
                {data.map((datum, index) => {
                  if (!datum.events || datum.events.length === 0) return null
                  const x = SVG_PADDING + ((SVG_WIDTH - SVG_PADDING * 2) * index) / Math.max(data.length - 1, 1)
                  return (
                    <g key={`events-${datum.date}`}>
                      {datum.events.map((event, eventIndex) => {
                        const y = SVG_PADDING + ((SVG_HEIGHT - SVG_PADDING * 2) * (100 - latestOverall)) / 100
                        return (
                          <circle
                            key={event.id}
                            cx={x}
                            cy={y - eventIndex * 8}
                            r={3}
                            fill="hsl(var(--destructive))"
                            stroke="hsl(var(--background))"
                            strokeWidth="1.5"
                            role="presentation"
                          >
                            <title>
                              {event.description} ({event.impact > 0 ? '+' : ''}
                              {event.impact})
                            </title>
                          </circle>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>

              <div id={srId} className="sr-only">
                {srHint || 'Reputation trend chart.'} Latest overall score {latestOverall.toFixed(1)}. Range {computed.min.toFixed(1)} to{' '}
                {computed.max.toFixed(1)}.
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Peak</dt>
                  <dd className="font-medium">{computed.max.toFixed(1)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Low</dt>
                  <dd className="font-medium">{computed.min.toFixed(1)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export type { ReputationTrendDatum, ReputationTrendChartProps }

