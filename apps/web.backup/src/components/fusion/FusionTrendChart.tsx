'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { TrendChart, type TrendChartDatum } from '@/components/oppe/TrendChart'
import { cn } from '@/lib/utils'

export type FusionTrendDatum = {
  label: string
  combined: number
  credential: number
  quality: number
  date?: string
}

type TrendView = 'combined' | 'credential' | 'quality'

type FusionTrendChartProps = {
  data: FusionTrendDatum[]
  className?: string
  initialView?: TrendView
  title?: string
  description?: string
  srHint?: string
  targetValue?: number
}

const VIEW_CONFIG: Record<
  TrendView,
  {
    label: string
    helper: string
  }
> = {
  combined: { label: 'Combined', helper: 'Composite fusion stack' },
  credential: { label: 'Credential', helper: 'PSV + enrollment stack' },
  quality: { label: 'Quality', helper: 'OPPE + safety signals' },
}

export function FusionTrendChart({
  data,
  className,
  initialView = 'combined',
  title = 'Fusion trend',
  description,
  srHint,
  targetValue = 85,
}: FusionTrendChartProps) {
  const [view, setView] = useState<TrendView>(initialView)

  const chartData: TrendChartDatum[] = useMemo(
    () =>
      data.map((point) => ({
        label: point.label,
        value: point[view],
        date: point.date,
      })),
    [data, view],
  )

  const action = (
    <div className="inline-flex rounded-full border bg-background/80 p-0.5 text-xs shadow-inner">
      {(Object.keys(VIEW_CONFIG) as TrendView[]).map((option) => (
        <Button
          key={option}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setView(option)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold',
            view === option
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {VIEW_CONFIG[option].label}
        </Button>
      ))}
    </div>
  )

  return (
    <TrendChart
      className={className}
      title={title}
      description={description ?? VIEW_CONFIG[view].helper}
      data={chartData}
      unitLabel="Score"
      valueFormatter={(value) => `${Math.round(value)}`}
      srHint={srHint ?? `Fusion ${VIEW_CONFIG[view].label} time-series in score units.`}
      targetValue={targetValue}
      action={action}
    />
  )
}


