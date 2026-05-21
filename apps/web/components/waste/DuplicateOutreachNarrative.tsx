import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CrossCheckExample } from '@/lib/demo/demoFixtures';

/**
 * Narrative 1 · Duplicate outreach as waste.
 *
 * The same primary source (NPPES, OIG/LEIE, PECOS) is queried by the
 * sending operator, by the receiving CVO, and sometimes by the
 * receiving committee. The narrative names the duplication, names
 * the lanes where the duplication shows up, and names what does
 * NOT change (institution-owned review).
 */
export interface DuplicateOutreachNarrativeProps {
  lanes: readonly CrossCheckExample[];
  className?: string;
}

export function DuplicateOutreachNarrative({
  lanes,
  className,
}: DuplicateOutreachNarrativeProps) {
  return (
    <section
      data-slot="duplicate-outreach-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 01 · duplicate outreach
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          The same primary source gets queried three times.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Sending operator queries NPPES. Receiving CVO queries NPPES
          again. Receiving committee sometimes queries NPPES a third
          time. The query is the same; the work is duplicated. VitalCV
          replaces the duplicate query with a portable replay envelope
          while the receiving institution retains its own review.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {lanes.map((lane) => (
          <li
            key={lane.laneId}
            data-slot="duplicate-outreach-row"
            data-lane-id={lane.laneId}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Source
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {lane.source}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Where the duplicate query happens
              </div>
              <div className="mt-1 text-xs text-slate-700">
                Sending operator → receiving CVO → sometimes committee
              </div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                What the institution still owns
              </div>
              <div className="mt-1 text-xs text-slate-700">{lane.note}</div>
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Visibility, not elimination · receiving institution still reviews each lane
      </footer>
    </section>
  );
}
