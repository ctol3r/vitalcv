'use client'

import { CheckCircle2, CircleDot, TriangleAlert } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type FusionScoreBreakdown = {
  label: string
  value: number
  helper?: string
}

export type FusionScoreSignal = {
  label: string
  severity: 'positive' | 'warning' | 'critical'
  helper?: string
}

type FusionScoreBadgeProps = {
  score: number
  label?: string
  percentile?: number
  size?: 'default' | 'lg'
  breakdown?: FusionScoreBreakdown[]
  signals?: FusionScoreSignal[]
  className?: string
}

const SIGNAL_ICONS = {
  positive: CheckCircle2,
  warning: CircleDot,
  critical: TriangleAlert,
} as const

const SIGNAL_COLORS = {
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-rose-600',
} satisfies Record<FusionScoreSignal['severity'], string>

export function FusionScoreBadge({
  score,
  label = 'Fusion score',
  percentile,
  breakdown = [],
  signals = [],
  size = 'default',
  className,
}: FusionScoreBadgeProps) {
  const gradient = getGradientForScore(score)
  const percentileLabel = percentile ? `${percentile}th percentile` : 'Composite percentile'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-label={`${label} ${score}`}
          className={cn(
            'inline-flex cursor-pointer items-center gap-4 rounded-full border border-white/30 bg-gradient-to-r px-5 py-2 text-white shadow-lg ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            gradient,
            size === 'lg' ? 'px-6 py-3 text-lg' : 'text-base',
            className,
          )}
        >
          <div className="text-left">
            <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
            <p className="text-3xl font-semibold leading-none">{Math.round(score)}</p>
          </div>
          <div className="text-left text-sm">
            <p className="font-semibold">{percentileLabel}</p>
            <p className="text-white/80">
              {breakdown[0]?.label ?? 'Quality + credential stack'}
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm space-y-3 text-left" sideOffset={10}>
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-foreground/80">{label}</p>
          <p className="text-2xl font-semibold leading-none">{Math.round(score)}</p>
        </div>
        {breakdown.length > 0 && (
          <div className="rounded-lg bg-primary-foreground/5 p-3 text-sm text-primary-foreground/90">
            <p className="text-xs font-semibold uppercase tracking-wide">Breakdown</p>
            <dl className="mt-2 space-y-1.5">
              {breakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-2">
                  <dt>{item.label}</dt>
                  <dd className="font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {signals.length > 0 && (
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide">Signals</p>
            <ul className="space-y-1.5">
              {signals.map((signal) => {
                const Icon = SIGNAL_ICONS[signal.severity]
                return (
                  <li key={signal.label} className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', SIGNAL_COLORS[signal.severity])} aria-hidden="true" />
                    <span className="font-medium">{signal.label}</span>
                    {signal.helper && (
                      <span className="text-xs text-primary-foreground/80">• {signal.helper}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function getGradientForScore(score: number) {
  if (score >= 85) {
    return 'from-emerald-500 via-emerald-400 to-emerald-600'
  }
  if (score >= 70) {
    return 'from-amber-400 via-amber-300 to-amber-500'
  }
  return 'from-rose-500 via-rose-400 to-rose-600'
}


