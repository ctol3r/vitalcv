'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useId } from 'react'

type Horizon = '7d' | '14d' | '30d' | '60d'
type PrivilegeCategory = 'all' | 'procedural' | 'prescribing' | 'supervision' | 'consultation'

export type ForecastDataPoint = {
  date: string
  risk7d: number
  risk14d: number
  risk30d: number
  risk60d: number
  category?: PrivilegeCategory
}

type ForecastTrendChartProps = {
  data: ForecastDataPoint[]
  className?: string
  title?: string
  description?: string
  selectedCategory?: PrivilegeCategory
  onCategoryChange?: (category: PrivilegeCategory) => void
}

const HORIZON_COLORS: Record<Horizon, string> = {
  '7d': 'hsl(221, 83%, 53%)', // blue
  '14d': 'hsl(142, 76%, 36%)', // green
  '30d': 'hsl(38, 92%, 50%)', // amber
  '60d': 'hsl(0, 84%, 60%)', // rose
}

const HORIZON_LABELS: Record<Horizon, string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '60d': '60 days',
}

const CATEGORY_LABELS: Record<PrivilegeCategory, string> = {
  all: 'All privileges',
  procedural: 'Procedural',
  prescribing: 'Prescribing',
  supervision: 'Supervision',
  consultation: 'Consultation',
}

const SVG_HEIGHT = 200
const SVG_WIDTH = 480
const SVG_PADDING = 32

export function ForecastTrendChart({
  data,
  className,
  title = 'Predicted risk forecast',
  description = 'Risk trajectory across forecast horizons',
  selectedCategory = 'all',
  onCategoryChange,
}: ForecastTrendChartProps) {
  const chartId = useId()
  const [visibleHorizons, setVisibleHorizons] = useState<Set<Horizon>>(new Set(['7d', '14d', '30d', '60d']))

  const filteredData = useMemo(() => {
    if (selectedCategory === 'all') return data
    return data.filter((point) => point.category === selectedCategory || !point.category)
  }, [data, selectedCategory])

  const horizons: Horizon[] = ['7d', '14d', '30d', '60d']

  const computed = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        min: 0,
        max: 100,
        paths: {} as Record<Horizon, string>,
        points: {} as Record<Horizon, Array<{ x: number; y: number; datum: ForecastDataPoint }>>,
      }
    }

    const allValues = filteredData.flatMap((d) => [d.risk7d, d.risk14d, d.risk30d, d.risk60d])
    const min = Math.max(0, Math.min(...allValues) - 5)
    const max = Math.min(100, Math.max(...allValues) + 5)
    const range = max - min || 1

    const width = SVG_WIDTH - SVG_PADDING * 2
    const height = SVG_HEIGHT - SVG_PADDING * 2

    const paths: Record<Horizon, string> = {} as Record<Horizon, string>
    const points: Record<Horizon, Array<{ x: number; y: number; datum: ForecastDataPoint }>> = {} as Record<Horizon, Array<{ x: number; y: number; datum: ForecastDataPoint }>>

    horizons.forEach((horizon) => {
      const key = `risk${horizon}` as keyof ForecastDataPoint
      const pointArray = filteredData.map((datum, index) => {
        const x = SVG_PADDING + (width * index) / Math.max(filteredData.length - 1, 1)
        const value = datum[key] as number
        const y = SVG_PADDING + height * (1 - (value - min) / range)
        return { x, y, datum }
      })
      points[horizon] = pointArray
      paths[horizon] = pointArray.map((p) => `${p.x},${p.y}`).join(' ')
    })

    return { min, max, paths, points }
  }, [filteredData])

  const toggleHorizon = (horizon: Horizon) => {
    setVisibleHorizons((prev) => {
      const next = new Set(prev)
      if (next.has(horizon)) {
        if (next.size > 1) next.delete(horizon)
      } else {
        next.add(horizon)
      }
      return next
    })
  }

  const descriptionId = useId()
  const srId = useId()

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription id={descriptionId}>{description}</CardDescription>
        {onCategoryChange && (
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as PrivilegeCategory[]).map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => onCategoryChange(cat)}
                className="h-7 text-xs"
              >
                {CATEGORY_LABELS[cat]}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {horizons.map((horizon) => (
              <button
                key={horizon}
                type="button"
                onClick={() => toggleHorizon(horizon)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors',
                  visibleHorizons.has(horizon)
                    ? 'bg-background border-foreground/20'
                    : 'bg-muted/50 border-transparent opacity-50',
                )}
                aria-pressed={visibleHorizons.has(horizon)}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: visibleHorizons.has(horizon) ? HORIZON_COLORS[horizon] : 'transparent' }}
                  aria-hidden="true"
                />
                <span>{HORIZON_LABELS[horizon]}</span>
              </button>
            ))}
          </div>

          {filteredData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data to display.</p>
          ) : (
            <div className="space-y-3">
              <svg
                role="img"
                aria-labelledby={`${descriptionId} ${srId}`}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="w-full overflow-visible"
              >
                <defs>
                  {horizons.map((horizon) => (
                    <linearGradient key={horizon} id={`forecastGradient-${horizon}-${chartId}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={HORIZON_COLORS[horizon]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={HORIZON_COLORS[horizon]} stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((value) => {
                  const y = calculateYPosition(value, computed.min, computed.max)
                  if (y < SVG_PADDING || y > SVG_HEIGHT - SVG_PADDING) return null
                  return (
                    <line
                      key={value}
                      x1={SVG_PADDING}
                      x2={SVG_WIDTH - SVG_PADDING}
                      y1={y}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeDasharray="2 4"
                      strokeWidth="1"
                      opacity={0.3}
                      aria-hidden="true"
                    />
                  )
                })}

                {/* Risk threshold line at 70 */}
                <line
                  x1={SVG_PADDING}
                  x2={SVG_WIDTH - SVG_PADDING}
                  y1={calculateYPosition(70, computed.min, computed.max)}
                  y2={calculateYPosition(70, computed.min, computed.max)}
                  stroke="hsl(0, 84%, 60%)"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                  opacity={0.6}
                  aria-hidden="true"
                />

                {/* Plot lines for each horizon */}
                {horizons.map((horizon) => {
                  if (!visibleHorizons.has(horizon) || !computed.paths[horizon]) return null

                  const path = computed.paths[horizon]
                  const points = computed.points[horizon] || []

                  return (
                    <g key={horizon}>
                      <polygon
                        points={`${path} ${SVG_WIDTH - SVG_PADDING},${SVG_HEIGHT - SVG_PADDING} ${SVG_PADDING},${SVG_HEIGHT - SVG_PADDING}`}
                        fill={`url(#forecastGradient-${horizon}-${chartId})`}
                        opacity={0.15}
                        role="presentation"
                      />
                      <polyline
                        fill="none"
                        stroke={HORIZON_COLORS[horizon]}
                        strokeWidth="2.5"
                        points={path}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="presentation"
                      />
                      {points.map(({ x, y, datum }, idx) => (
                        <circle
                          key={`${horizon}-${idx}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill={HORIZON_COLORS[horizon]}
                          stroke="hsl(var(--background))"
                          strokeWidth="1.5"
                          role="presentation"
                        >
                          <title>
                            {datum.date || `${idx + 1}`}: {HORIZON_LABELS[horizon]} risk = {Math.round(datum[`risk${horizon}` as keyof ForecastDataPoint] as number)}%
                          </title>
                        </circle>
                      ))}
                    </g>
                  )
                })}
              </svg>

              <div id={srId} className="sr-only">
                Forecast trend chart showing predicted risk across {horizons.filter((h) => visibleHorizons.has(h)).map((h) => HORIZON_LABELS[h]).join(', ')} horizons.
                Risk values range from {Math.round(computed.min)}% to {Math.round(computed.max)}%.
                {filteredData.length > 0 && (
                  <>
                    {' '}
                    Latest values: {horizons
                      .filter((h) => visibleHorizons.has(h))
                      .map((h) => `${HORIZON_LABELS[h]}: ${Math.round(filteredData[filteredData.length - 1][`risk${h}` as keyof ForecastDataPoint] as number)}%`)
                      .join(', ')}
                    .
                  </>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                {horizons
                  .filter((h) => visibleHorizons.has(h))
                  .map((horizon) => {
                    const latest = filteredData[filteredData.length - 1]
                    const value = latest?.[`risk${horizon}` as keyof ForecastDataPoint] as number
                    return (
                      <div key={horizon}>
                        <dt className="text-xs text-muted-foreground">{HORIZON_LABELS[horizon]}</dt>
                        <dd className="flex items-baseline gap-1.5">
                          <span className="text-lg font-semibold">{Math.round(value ?? 0)}</span>
                          <span className="text-xs text-muted-foreground">%</span>
                        </dd>
                      </div>
                    )
                  })}
              </dl>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function calculateYPosition(value: number, min: number, max: number) {
  if (max - min === 0) return SVG_HEIGHT / 2
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const height = SVG_HEIGHT - SVG_PADDING * 2
  return SVG_PADDING + height * (1 - normalized)
}

