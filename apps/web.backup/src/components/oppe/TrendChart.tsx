import { useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type TrendChartDatum = {
  label: string
  value: number
  date?: string
}

type TrendChartProps = {
  title: string
  description?: string
  data: TrendChartDatum[]
  valueFormatter?: (value: number) => string
  unitLabel?: string
  className?: string
  srHint?: string
  targetValue?: number
  action?: ReactNode
}

const SVG_HEIGHT = 160
const SVG_WIDTH = 360
const SVG_PADDING = 24

export function TrendChart({
  title,
  description,
  data,
  valueFormatter = (value) => value.toString(),
  unitLabel,
  className,
  srHint,
  targetValue,
  action,
}: TrendChartProps) {
  const descriptionId = useId()
  const srId = useId()
  const computed = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        min: 0,
        max: 0,
        path: '',
        points: [] as Array<{ x: number; y: number; datum: TrendChartDatum }>,
      }
    }
    const values = data.map((d) => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const width = SVG_WIDTH - SVG_PADDING * 2
    const height = SVG_HEIGHT - SVG_PADDING * 2
    const points = data.map((datum, index) => {
      const x = SVG_PADDING + (width * index) / (Math.max(data.length - 1, 1))
      const y = SVG_PADDING + height * (1 - (datum.value - min) / range)
      return { x, y, datum }
    })

    const path = points.map((point) => `${point.x},${point.y}`).join(' ')
    return { min, max, path, points }
  }, [data])

  const latestValue = data.at(-1)?.value ?? 0
  const previousValue = data.at(-2)?.value ?? latestValue
  const delta = latestValue - previousValue
  const trendLabel =
    delta === 0 ? 'No change' : delta > 0 ? `Up ${valueFormatter(Math.abs(delta))}` : `Down ${valueFormatter(Math.abs(delta))}`

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {unitLabel && <span className="text-sm font-normal text-muted-foreground">{unitLabel}</span>}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
        {description && <CardDescription id={descriptionId}>{description}</CardDescription>}
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold">{valueFormatter(latestValue)}</p>
          <span className={cn('text-sm', delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{trendLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
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
                <linearGradient id="trendChartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              {targetValue !== undefined && (
                <line
                  x1={SVG_PADDING}
                  x2={SVG_WIDTH - SVG_PADDING}
                  y1={calculateYPosition(targetValue, computed.min, computed.max)}
                  y2={calculateYPosition(targetValue, computed.min, computed.max)}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  aria-hidden="true"
                />
              )}
              {computed.path && (
                <>
                  <polyline
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    points={computed.path}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    role="presentation"
                  />
                  <polygon
                    points={`${computed.path} ${SVG_WIDTH - SVG_PADDING},${SVG_HEIGHT - SVG_PADDING} ${SVG_PADDING},${SVG_HEIGHT - SVG_PADDING}`}
                    fill="url(#trendChartGradient)"
                    opacity={0.12}
                    role="presentation"
                  />
                </>
              )}
              {computed.points.map(({ x, y, datum }) => (
                <circle key={datum.label} cx={x} cy={y} r={4} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" role="presentation">
                  <title>
                    {datum.label}: {valueFormatter(datum.value)}
                  </title>
                </circle>
              ))}
            </svg>
            <div id={srId} className="sr-only">
              {srHint || 'Trend chart values.'} Latest value {valueFormatter(latestValue)}. Range {valueFormatter(computed.min)} to{' '}
              {valueFormatter(computed.max)}.
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Best</dt>
                <dd className="font-medium">{valueFormatter(computed.max)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lowest</dt>
                <dd className="font-medium">{valueFormatter(computed.min)}</dd>
              </div>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function calculateYPosition(value: number, min: number, max: number) {
  if (max - min === 0) return SVG_HEIGHT / 2
  const normalized = clamp((value - min) / (max - min), 0, 1)
  const height = SVG_HEIGHT - SVG_PADDING * 2
  return SVG_PADDING + height * (1 - normalized)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export type { TrendChartDatum, TrendChartProps }

