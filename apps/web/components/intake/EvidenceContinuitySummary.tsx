import * as React from 'react';
import { cn } from '@/lib/utils';
import type { EvidenceContinuityExample } from '@/lib/demo/demoFixtures';

/**
 * Top-level summary of the cohort's evidence continuity. Renders
 * one row per lane with the user-facing status label. No
 * infrastructure jargon, no per-receipt detail.
 */
export interface EvidenceContinuitySummaryProps {
  lanes: readonly EvidenceContinuityExample[];
  className?: string;
}

const STATUS_LABEL: Record<EvidenceContinuityExample['status'], string> = {
  source_confirmed: 'Source-confirmed',
  evidence_pending: 'Evidence pending',
  continuity_restored: 'Continuity restored',
  continuity_interrupted: 'Continuity interrupted',
};

export function EvidenceContinuitySummary({
  lanes,
  className,
}: EvidenceContinuitySummaryProps) {
  const counts = lanes.reduce(
    (acc, lane) => {
      acc[lane.status] = (acc[lane.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<EvidenceContinuityExample['status'], number>,
  );
  const total = lanes.length;
  const confirmed = counts.source_confirmed ?? 0;
  const restored = counts.continuity_restored ?? 0;
  const pending = counts.evidence_pending ?? 0;
  const interrupted = counts.continuity_interrupted ?? 0;

  return (
    <section
      data-slot="evidence-continuity-summary"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Evidence continuity · {total} lane{total === 1 ? '' : 's'}
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Each lane is captured with its source, observation time, and
          operator note. Continuity is operational, not a regulatory
          guarantee.
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-4">
        <Stat label="Source-confirmed" value={confirmed} />
        <Stat label="Continuity restored" value={restored} />
        <Stat label="Evidence pending" value={pending} />
        <Stat label="Continuity interrupted" value={interrupted} />
      </dl>
      <ul className="divide-y divide-slate-200">
        {lanes.map((lane) => (
          <li
            key={lane.laneId}
            data-slot="evidence-continuity-row"
            data-lane-id={lane.laneId}
            data-status={lane.status}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Lane
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {lane.laneId}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Source
              </div>
              <div className="mt-1 text-xs text-slate-900">{lane.source}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Status
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {STATUS_LABEL[lane.status]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Operator note
              </div>
              <p className="mt-1 text-xs text-slate-700">{lane.operatorNote}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg text-slate-900">{value}</dd>
    </div>
  );
}
