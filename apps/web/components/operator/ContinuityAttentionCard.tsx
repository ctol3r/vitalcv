import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  OPERATOR_VISIBLE_STATE_LABEL,
  type OperatorContinuityItem,
} from '@/lib/operator/operatorFixtures';

/**
 * Per-lane continuity card. Uses only the six normalized visible
 * states (Ready / Pending review / Attention needed / Interrupted /
 * Continuing / Complete). Substrate jargon (replay survivability,
 * dedupe key, run-id) is excluded; if the operator needs that detail,
 * the workspace's progressive disclosure exposes it.
 */
export interface ContinuityAttentionCardProps {
  lane: OperatorContinuityItem;
  className?: string;
}

const TONE_BY_STATE: Record<OperatorContinuityItem['state'], string> = {
  ready: 'border-slate-300 bg-white',
  pending_review: 'border-slate-300 bg-white',
  attention_needed: 'border-amber-600 bg-amber-50',
  interrupted: 'border-amber-700 bg-amber-50',
  continuing: 'border-slate-400 bg-slate-50',
  complete: 'border-slate-900 bg-white',
};

export function ContinuityAttentionCard({
  lane,
  className,
}: ContinuityAttentionCardProps) {
  return (
    <article
      data-slot="continuity-attention-card"
      data-lane-id={lane.id}
      data-state={lane.state}
      className={cn(
        'overflow-hidden rounded-xl border-2 px-3 py-3',
        TONE_BY_STATE[lane.state],
        className,
      )}
    >
      <header className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Lane
        </div>
        <div className="text-sm font-semibold text-slate-900">{lane.laneLabel}</div>
      </header>
      <div className="mt-2 inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          {OPERATOR_VISIBLE_STATE_LABEL[lane.state]}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-700">{lane.operatorNote}</p>
    </article>
  );
}
