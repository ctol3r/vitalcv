import * as React from 'react';
import { cn } from '@/lib/utils';
import type { InterruptionExample } from '@/lib/demo/demoFixtures';

/**
 * Renders the institutional impact of an evidence interruption.
 * Each card names the cause, the resolution path, and the
 * institution-owned next step. The component never editorializes;
 * it surfaces the operational record.
 */
export interface ReplayImpactNarrativeProps {
  interruptions: readonly InterruptionExample[];
  className?: string;
}

export function ReplayImpactNarrative({
  interruptions,
  className,
}: ReplayImpactNarrativeProps) {
  return (
    <section
      data-slot="replay-impact-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          When evidence is interrupted · what happens next
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Interruptions happen. The envelope records the cause, the
          resolution path, and which step the institution owns. No
          interruption is silently masked.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {interruptions.map((i) => (
          <li
            key={i.laneId}
            data-slot="replay-impact-row"
            data-lane-id={i.laneId}
            className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
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
              <div className="mt-1 text-xs text-slate-700">{i.cause}</div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Resolution path
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {i.resolutionPath}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institution-owned step
              </div>
              <div className="mt-1 text-xs text-slate-900">
                {i.institutionOwnedStep}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
