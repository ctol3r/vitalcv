import * as React from 'react';
import { cn } from '@/lib/utils';
import type { EvidenceContinuityExample } from '@/lib/demo/demoFixtures';

/**
 * Narrative 3 · Evidence fragmentation as waste.
 *
 * Today, evidence about a single clinician scatters: NPPES lives in
 * one system, state board screenshots live in a folder, OIG/LEIE
 * confirmations live in email, committee minutes live in the
 * institution's records system. The narrative names each fragment,
 * names where the fragment lives today, and names what the replay
 * envelope reorganizes (NOT replaces).
 */
export interface EvidenceFragmentationNarrativeProps {
  evidenceLanes: readonly EvidenceContinuityExample[];
  className?: string;
}

const STATUS_LABEL: Record<EvidenceContinuityExample['status'], string> = {
  source_confirmed: 'Source-confirmed',
  evidence_pending: 'Evidence pending',
  continuity_restored: 'Continuity restored',
  continuity_interrupted: 'Continuity interrupted',
};

export function EvidenceFragmentationNarrative({
  evidenceLanes,
  className,
}: EvidenceFragmentationNarrativeProps) {
  return (
    <section
      data-slot="evidence-fragmentation-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 03 · evidence fragmentation
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          One clinician, six places. The receiving operator chases each.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          NPPES lives in one system. OIG/LEIE confirmations live in
          email. PECOS lookups live in a printout. State board
          screenshots live in a folder. Committee minutes live in the
          institution's records system. A replay envelope reorganizes
          the federal-source fragments into one portable artifact; the
          institution's own records, notes, and committee minutes stay
          where they are.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {evidenceLanes.map((lane) => (
          <li
            key={lane.laneId}
            data-slot="evidence-fragmentation-row"
            data-lane-id={lane.laneId}
            data-status={lane.status}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Fragment
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {lane.source}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Status
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {STATUS_LABEL[lane.status]}
              </div>
            </div>
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Operator note
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {lane.operatorNote}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Federal-source fragments only · institution records stay institution-owned
      </footer>
    </section>
  );
}
