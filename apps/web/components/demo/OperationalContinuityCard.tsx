import * as React from 'react';
import { cn } from '@/lib/utils';
import type { EvidenceContinuityExample } from '@/lib/demo/demoFixtures';

/**
 * Renders one lane of evidence continuity in institutional language.
 * Maps the underlying replay/degradation state onto reader-friendly
 * status labels:
 *   source_confirmed       -> "source-confirmed"
 *   evidence_pending       -> "evidence pending"
 *   continuity_restored    -> "continuity restored"
 *   continuity_interrupted -> "continuity interrupted"
 */
export interface OperationalContinuityCardProps {
  lane: EvidenceContinuityExample;
  className?: string;
}

const STATUS_LABEL: Record<EvidenceContinuityExample['status'], string> = {
  source_confirmed: 'Source-confirmed',
  evidence_pending: 'Evidence pending',
  continuity_restored: 'Continuity restored',
  continuity_interrupted: 'Continuity interrupted',
};

const STATUS_BORDER: Record<EvidenceContinuityExample['status'], string> = {
  source_confirmed: 'border-slate-900',
  evidence_pending: 'border-dashed border-slate-500',
  continuity_restored: 'border-slate-900',
  continuity_interrupted: 'border-2 border-rose-900',
};

export function OperationalContinuityCard({
  lane,
  className,
}: OperationalContinuityCardProps) {
  return (
    <article
      data-slot="operational-continuity-card"
      data-lane-id={lane.laneId}
      data-status={lane.status}
      className={cn(
        'rounded-2xl border bg-white p-4 text-sm',
        STATUS_BORDER[lane.status],
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Lane · {lane.laneId}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-900">
          {STATUS_LABEL[lane.status]}
        </div>
      </header>
      <div className="mt-1 text-base font-semibold text-slate-900">
        {lane.source}
      </div>
      <p className="mt-2 text-sm text-slate-700">{lane.operatorNote}</p>
      <div className="mt-3 font-mono text-[11px] text-slate-500">
        observed · {lane.observedAt}
      </div>
    </article>
  );
}
