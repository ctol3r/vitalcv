import * as React from 'react';
import { CheckedAtStamp } from '@/components/trust/primitives';
import { cn } from '@/lib/utils';

/**
 * Pane-local replay-run stamp: `run_id` + canonical `checked_at`.
 *
 * Reuses `CheckedAtStamp` (binding ISO + relative formatting) so the
 * receipt, audit, and lineage panes all show the same chronology
 * format for the same source data. Stale receipts get the dashed
 * left-border treatment from `CheckedAtStamp`.
 */
export interface ReplayRunStampProps {
  runId: string;
  checkedAtIso: string | null;
  checkedAtRelative: string;
  degraded?: boolean;
  className?: string;
}

export function ReplayRunStamp({
  runId,
  checkedAtIso,
  checkedAtRelative,
  degraded,
  className,
}: ReplayRunStampProps) {
  return (
    <div
      data-slot="replay-run-stamp"
      className={cn(
        'flex items-baseline gap-3 border-b border-slate-200 px-4 py-2 font-mono text-xs',
        className,
      )}
    >
      <div className="shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          run ·{' '}
        </span>
        <span className="text-slate-900">{runId}</span>
      </div>
      <div className="flex-1 min-w-0">
        <CheckedAtStamp
          iso={checkedAtIso}
          relative={checkedAtRelative}
          degraded={degraded}
        />
      </div>
    </div>
  );
}
