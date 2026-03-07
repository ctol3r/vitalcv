'use client';

/**
 * MetricCard.tsx — Wave 131
 *
 * Compact metric tile with value, trend indicator, and optional mini sparkline.
 */

import TimeSeriesChart, { type TimeSeriesPoint } from './TimeSeriesChart';

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  trendPositive?: boolean; // true = up is good (default), false = up is bad
  series?: TimeSeriesPoint[];
  color?: string;
  className?: string;
}

const TREND_ARROW = { up: '↑', down: '↓', flat: '→' } as const;

export default function MetricCard({
  title,
  value,
  unit,
  delta,
  trend = 'flat',
  trendPositive = true,
  series,
  color = '#8b5cf6',
  className = '',
}: MetricCardProps) {
  const trendGood = (trend === 'up' && trendPositive) || (trend === 'down' && !trendPositive);
  const trendBad = (trend === 'up' && !trendPositive) || (trend === 'down' && trendPositive);

  const trendColor = trendGood
    ? 'text-emerald-400'
    : trendBad
      ? 'text-red-400'
      : 'text-zinc-500';

  return (
    <div
      className={`rounded-xl border border-white/5 bg-white/2 p-4 space-y-3 hover:border-white/10 transition-colors ${className}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{title}</p>
        {delta && (
          <span className={`text-xs font-mono ${trendColor} flex items-center gap-0.5`}>
            {TREND_ARROW[trend]} {delta}
          </span>
        )}
      </div>

      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold font-mono text-white leading-none">{value}</span>
        {unit && <span className="text-xs text-zinc-500 mb-0.5">{unit}</span>}
      </div>

      {series && series.length > 1 && (
        <TimeSeriesChart
          data={series}
          color={color}
          height={36}
          className="opacity-80"
        />
      )}
    </div>
  );
}
