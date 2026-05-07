import * as React from 'react';
import { cn } from '@/lib/utils';

export interface HeadlineMetricProps {
  label: string;
  value: string;
  unit?: string;
  qualifier?: string;
  sub?: string;
  accent?: boolean;
  className?: string;
}

/**
 * Single metric card used in the ROI Console v2 headline strip.
 *
 * The `qualifier` prop is mandatory in practice — every projected number on
 * this surface MUST render with a qualifier from `LABEL_QUALIFIER_V2`. The
 * prop is optional in the type only because some callers split the qualifier
 * into a footer instead of inlining it on the card.
 */
export function HeadlineMetric({
  label,
  value,
  unit,
  qualifier,
  sub,
  accent,
  className,
}: HeadlineMetricProps) {
  return (
    <div
      className={cn(
        'border rounded-[3px] bg-white px-5 py-4',
        accent ? 'border-slate-900' : 'border-slate-200',
        className,
      )}
    >
      <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-semibold tracking-[-0.018em] text-slate-900 leading-none tabular-nums">
          {value}
        </span>
        {unit && <span className="text-[13px] text-slate-600">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-slate-700">{sub}</div>}
      {qualifier && (
        <div className="mt-1 font-mono text-[10.5px] text-slate-500">
          {qualifier}
        </div>
      )}
    </div>
  );
}
