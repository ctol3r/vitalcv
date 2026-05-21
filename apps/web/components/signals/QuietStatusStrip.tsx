import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OperationalSignalState } from './PrimaryOperationalSignal';
import { PRIMARY_SIGNAL_LABEL } from './PrimaryOperationalSignal';

/**
 * Horizontal strip of 3..6 small lozenges, each carrying ONE axis +
 * ONE user-facing label. Quiet, monochrome, no decoration. Uses only
 * the normalized status vocabulary (Confirmed, Pending, Attention
 * needed, Recently reviewed, Requires follow-up).
 *
 * Renders nothing if items is empty.
 */
export interface QuietStatusEntry {
  id: string;
  axis: string;
  state: OperationalSignalState;
}

export interface QuietStatusStripProps {
  entries: readonly QuietStatusEntry[];
  className?: string;
}

const DOT_TONE: Record<OperationalSignalState, string> = {
  confirmed: 'bg-slate-900',
  pending: 'bg-slate-500',
  attention_needed: 'bg-amber-600',
  recently_reviewed: 'bg-slate-700',
  requires_followup: 'bg-amber-600',
};

export function QuietStatusStrip({
  entries,
  className,
}: QuietStatusStripProps) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section
      data-slot="quiet-status-strip"
      data-entry-count={entries.length}
      className={cn(
        'overflow-hidden rounded-xl border border-slate-300 bg-white',
        className,
      )}
    >
      <ul
        role="list"
        className="grid grid-cols-2 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-y-0 sm:divide-x lg:grid-cols-6"
      >
        {entries.map((entry) => (
          <li
            key={entry.id}
            data-slot="quiet-status-entry"
            data-axis-id={entry.id}
            data-state={entry.state}
            className="px-3 py-2"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {entry.axis}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'inline-block h-2 w-2 rounded-full',
                  DOT_TONE[entry.state],
                )}
              />
              <span className="text-xs font-semibold text-slate-900">
                {PRIMARY_SIGNAL_LABEL[entry.state]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
