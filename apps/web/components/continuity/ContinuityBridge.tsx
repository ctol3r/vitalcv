import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Generic continuity bridge between two routes. Names the "from"
 * surface, the "to" surface, the handoff state (ready /
 * preparing / interrupted), and the explicit boundary that the
 * institution still owns. Used by /holder -> /verify, by
 * /pilot -> /demo/pilot, and by the institutional review flow
 * when handing back to readiness.
 */
export type ContinuityHandoffState =
  | 'ready'
  | 'preparing'
  | 'interrupted';

export interface ContinuityBridgeProps {
  fromLabel: string;
  toLabel: string;
  toHref: string;
  state: ContinuityHandoffState;
  whatTravels: string;
  whatStaysBehind: string;
  className?: string;
}

const STATE_LABEL: Record<ContinuityHandoffState, string> = {
  ready: 'Ready to hand off',
  preparing: 'Preparing handoff',
  interrupted: 'Handoff interrupted',
};

const STATE_TONE: Record<ContinuityHandoffState, string> = {
  ready: 'border-slate-900 bg-white',
  preparing: 'border-slate-500 bg-slate-50',
  interrupted: 'border-amber-700 bg-amber-50',
};

export function ContinuityBridge({
  fromLabel,
  toLabel,
  toHref,
  state,
  whatTravels,
  whatStaysBehind,
  className,
}: ContinuityBridgeProps) {
  return (
    <section
      data-slot="continuity-bridge"
      data-state={state}
      className={cn(
        'overflow-hidden rounded-2xl border-2',
        STATE_TONE[state],
        className,
      )}
    >
      <header className="border-b border-slate-200 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Continuity bridge · {STATE_LABEL[state]}
        </div>
        <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="font-mono text-xs text-slate-900">{fromLabel}</div>
          <div aria-hidden className="font-mono text-sm text-slate-500">
            →
          </div>
          <div className="font-mono text-xs text-slate-900">{toLabel}</div>
        </div>
      </header>
      <div className="space-y-3 px-4 py-3">
        <section
          data-slot="continuity-bridge-what-travels"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What travels
          </div>
          <p className="mt-1 text-xs text-slate-700">{whatTravels}</p>
        </section>
        <section
          data-slot="continuity-bridge-what-stays"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What stays behind (institution-owned)
          </div>
          <p className="mt-1 text-xs text-slate-700">{whatStaysBehind}</p>
        </section>
        {state === 'ready' ? (
          <Link
            href={toHref}
            data-slot="continuity-bridge-link"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            Continue to {toLabel}
            <span aria-hidden className="font-mono">
              →
            </span>
          </Link>
        ) : (
          <div
            data-slot="continuity-bridge-no-link"
            className="font-mono text-[11px] uppercase tracking-wider text-slate-500"
          >
            No handoff link while handoff is {STATE_LABEL[state].toLowerCase()}
          </div>
        )}
      </div>
    </section>
  );
}
