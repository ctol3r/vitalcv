import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  READING_ORDER_CAPTION,
  type LineageSlots,
  type LineageTrustState,
} from '@/lib/trust/replay-grammar';
import { READING_ORDER_LABELS } from '@/lib/trust/institutional-language';

/**
 * Canonical six-cell trust header.
 *
 * Source: Lineage Header.html · Trust Primitives.html §01.
 * Renders the mandatory reading order:
 *   OBJECT → OWNERSHIP → checked_at → CHANNEL → REPLAY → run_id
 *
 * The caption rail is institutional, not decorative — it names the
 * contract the cells satisfy.
 */
export interface LineageHeaderProps {
  slots: LineageSlots;
  state: LineageTrustState;
  className?: string;
}

const STATE_FRAME: Record<LineageTrustState, string> = {
  preview: 'border-dashed border-slate-400 bg-amber-50/40',
  snapshot: 'border-solid border-slate-700 bg-white',
  signed: 'border-solid border-slate-950 bg-slate-950 text-slate-100',
};

const STATE_CAP: Record<LineageTrustState, string> = {
  preview: 'bg-amber-50 text-slate-700 border-slate-300',
  snapshot: 'bg-slate-50 text-slate-800 border-slate-700',
  signed: 'bg-slate-900 text-slate-100 border-slate-700',
};

export function LineageHeader({ slots, state, className }: LineageHeaderProps) {
  return (
    <section
      data-slot="lineage-header"
      data-state={state}
      className={cn(
        'rounded-2xl border text-sm',
        STATE_FRAME[state],
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b px-4 py-2 font-mono text-xs uppercase tracking-wider',
          STATE_CAP[state],
        )}
      >
        <span>Lineage · {READING_ORDER_CAPTION}</span>
        <span>state · {state}</span>
      </div>
      <ol
        className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6"
      >
        {slots.map((slot) => (
          <li
            key={slot.key}
            data-degraded={slot.degraded ? 'true' : undefined}
            className={cn(
              'px-4 py-3',
              slot.degraded && 'border-l-2 border-dashed border-amber-400',
            )}
          >
            <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">
              {READING_ORDER_LABELS[slot.key]}
            </div>
            <div className="mt-1 font-mono text-sm break-words">
              {slot.value}
            </div>
            {slot.subLabel ? (
              <div className="mt-0.5 text-[11px] opacity-70">
                {slot.subLabel}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
