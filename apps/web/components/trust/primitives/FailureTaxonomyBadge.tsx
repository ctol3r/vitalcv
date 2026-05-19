import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  describeFailureMode,
  type FailureMode,
} from '@/lib/trust/degradation';

/**
 * Five-letter failure-mode chip.
 *
 * Source: Trust Primitives.html §05 · Failure Taxonomy.html. Five
 * non-confusable modes; never yellow/orange/red; never collapsed to
 * "error". Mode D is success, not failure.
 */
export interface FailureTaxonomyBadgeProps {
  mode: FailureMode;
  className?: string;
}

const MODE_FILL: Record<FailureMode, string> = {
  A: 'border-dashed border-slate-400 bg-amber-50 text-slate-800',
  B: 'border-solid border-slate-400 bg-slate-50 text-slate-700',
  C: 'border-solid border-slate-900 bg-slate-900 text-slate-50',
  D: 'border-solid border-slate-900 bg-white text-slate-900',
  E: 'border-solid border-slate-950 bg-slate-950 text-slate-50',
};

export function FailureTaxonomyBadge({
  mode,
  className,
}: FailureTaxonomyBadgeProps) {
  const descriptor = describeFailureMode(mode);
  return (
    <span
      data-slot="failure-mode-badge"
      data-mode={mode}
      data-plane={descriptor.plane}
      title={`${descriptor.title} · ${descriptor.plane}`}
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        MODE_FILL[mode],
        className,
      )}
    >
      <span>Mode {mode}</span>
      <span className="opacity-70">· {descriptor.plane}</span>
    </span>
  );
}
