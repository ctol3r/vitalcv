import * as React from 'react';
import { cn } from '@/lib/utils';
import type { InterruptionExample } from '@/lib/demo/demoFixtures';

/**
 * Narrative 2 · Continuity interruption as waste.
 *
 * Today, when an upstream registry is slow or returns a stale answer,
 * the receiving operator either re-queries (duplicate work) or paginates
 * back through phone calls (lost time). The narrative names the
 * interruption and the operator-owned recovery step. It does NOT
 * claim continuity is "magical" or "instant"; the institution still
 * dispositions the stale-but-signed posture on its own credential.
 */
export interface ContinuityInterruptionNarrativeProps {
  interruptions: readonly InterruptionExample[];
  className?: string;
}

export function ContinuityInterruptionNarrative({
  interruptions,
  className,
}: ContinuityInterruptionNarrativeProps) {
  return (
    <section
      data-slot="continuity-interruption-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 02 · continuity interruption
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          Upstream registries blip. Today, that becomes a phone tree.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          When PECOS lags, the conventional response is a phone call and
          a re-query. The receiving operator carries the loss as dead
          time. With a replay envelope, the operator note travels with
          the lane; the receiving institution dispositions the
          stale-but-signed posture on its own credential.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {interruptions.map((interruption) => (
          <li
            key={interruption.laneId}
            data-slot="continuity-interruption-row"
            data-lane-id={interruption.laneId}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Lane
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {interruption.laneId}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Where continuity broke
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {interruption.cause}
              </div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institution-owned recovery step
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {interruption.institutionOwnedStep}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Interruption is visible · resolution remains operator-led
      </footer>
    </section>
  );
}
