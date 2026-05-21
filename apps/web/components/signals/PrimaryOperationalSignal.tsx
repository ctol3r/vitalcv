import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * One operational signal per surface. Quiet, dense, monochrome. The
 * single dominant block on /ops or /holder. Does NOT carry technical
 * jargon; uses only the normalized status vocabulary.
 *
 * State -> label mapping (binding):
 *   confirmed        -> "Confirmed"
 *   pending          -> "Pending"
 *   attention_needed -> "Attention needed"
 *   recently_reviewed-> "Recently reviewed"
 *   requires_followup-> "Requires follow-up"
 */
export type OperationalSignalState =
  | 'confirmed'
  | 'pending'
  | 'attention_needed'
  | 'recently_reviewed'
  | 'requires_followup';

export interface PrimaryOperationalSignalProps {
  state: OperationalSignalState;
  headline: string;
  summary: string;
  asOf?: string;
  className?: string;
}

export const PRIMARY_SIGNAL_LABEL: Record<OperationalSignalState, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  attention_needed: 'Attention needed',
  recently_reviewed: 'Recently reviewed',
  requires_followup: 'Requires follow-up',
};

const TONE: Record<OperationalSignalState, string> = {
  confirmed: 'bg-slate-50 text-slate-900 border-slate-900',
  pending: 'bg-slate-50 text-slate-900 border-slate-700',
  attention_needed: 'bg-amber-50 text-slate-900 border-amber-700',
  recently_reviewed: 'bg-slate-50 text-slate-900 border-slate-700',
  requires_followup: 'bg-amber-50 text-slate-900 border-amber-700',
};

export function PrimaryOperationalSignal({
  state,
  headline,
  summary,
  asOf,
  className,
}: PrimaryOperationalSignalProps) {
  const label = PRIMARY_SIGNAL_LABEL[state];
  return (
    <section
      data-slot="primary-operational-signal"
      data-state={state}
      className={cn(
        'overflow-hidden rounded-2xl border-2',
        TONE[state],
        className,
      )}
    >
      <div className="px-5 py-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Operational state
        </div>
        <div className="mt-1 text-2xl font-semibold">{label}</div>
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          {headline}
        </h2>
        <p className="mt-1 max-w-[68ch] text-sm text-slate-700">{summary}</p>
        {asOf ? (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            As of {asOf}
          </div>
        ) : null}
      </div>
    </section>
  );
}
