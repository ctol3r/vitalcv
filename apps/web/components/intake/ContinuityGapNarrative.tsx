import * as React from 'react';
import { cn } from '@/lib/utils';
import type { InterruptionExample } from '@/lib/demo/demoFixtures';

/**
 * Renders what happens when continuity breaks. Each interruption
 * names the cause, the resolution path the pilot followed, and the
 * institution-owned next step.
 *
 * Continuity gaps are surfaced, never silently absorbed.
 */
export interface ContinuityGapNarrativeProps {
  interruptions: readonly InterruptionExample[];
  className?: string;
}

export function ContinuityGapNarrative({
  interruptions,
  className,
}: ContinuityGapNarrativeProps) {
  if (interruptions.length === 0) {
    return (
      <section
        data-slot="continuity-gap-narrative"
        data-empty="true"
        className={cn(
          'rounded-2xl border border-slate-900 bg-white px-4 py-3',
          className,
        )}
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Continuity gaps · what happened during the pilot window
        </div>
        <p className="mt-2 text-xs text-slate-600">
          No continuity gaps recorded for this cohort.
        </p>
      </section>
    );
  }
  return (
    <section
      data-slot="continuity-gap-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Continuity gaps · what happened during the pilot window
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Interruptions are recorded, not hidden. Each row carries the
          cause, the resolution path, and the institution-owned next
          step.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {interruptions.map((i) => (
          <li
            key={i.laneId}
            data-slot="continuity-gap-row"
            data-lane-id={i.laneId}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Lane
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {i.laneId}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Cause
              </div>
              <p className="mt-1 text-xs text-slate-700">{i.cause}</p>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Resolution path
              </div>
              <p className="mt-1 text-xs text-slate-700">{i.resolutionPath}</p>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Your next step
              </div>
              <p className="mt-1 text-xs text-slate-900">
                {i.institutionOwnedStep}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
