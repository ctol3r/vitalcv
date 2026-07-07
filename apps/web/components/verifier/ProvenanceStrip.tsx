'use client';

/**
 * ProvenanceStrip.tsx
 *
 * Horizontal strip per lane: [Source] → [Checked At] → [Receipt ID (short)] → [Tier Badge]
 * Source: LaneSnapshot from trust-types.ts
 *
 * Design: Bloomberg column headers, hairline dividers, monospaced IDs, dense rows.
 */

import type { LaneSnapshot } from '@/components/proof/trust-types';
import { KNOWN_LANES } from '@/components/proof/trust-types';
import { cn } from '@/lib/utils';

interface ProvenanceStripProps {
  lanes: LaneSnapshot[];
}

function formatCheckedAt(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

// Spec: truncate to 12 chars + ellipsis
function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 12) return id;
  return id.slice(0, 12) + '…';
}

const TIER_BADGE: Record<string, { label: string; chip: string; dot: string }> = {
  verified:        { label: 'Source-backed', chip: 'mz-chip-ok',      dot: 'bg-[var(--ok)]' },
  in_progress:     { label: 'In Progress',   chip: 'mz-chip-watch',   dot: 'bg-[var(--watch)]' },
  not_checked:     { label: 'Not Checked',   chip: 'mz-chip-unknown', dot: 'bg-[var(--unknown)]' },
  stale:           { label: 'Stale',         chip: 'mz-chip-watch',   dot: 'bg-[var(--watch)]' },
  unavailable:     { label: 'Unavailable',   chip: 'mz-chip-unknown', dot: 'bg-[var(--unknown)]' },
  access_required: { label: 'Access Req.',   chip: 'mz-chip-watch',   dot: 'bg-[var(--watch)]' },
  review_required: { label: 'Review Req.',   chip: 'mz-chip-watch',   dot: 'bg-[var(--watch)]' },
  adverse:         { label: 'Adverse',       chip: 'mz-chip-p0',      dot: 'bg-[var(--p0)]' },
};

export function ProvenanceStrip({ lanes }: ProvenanceStripProps) {
  if (!lanes || lanes.length === 0) {
    return (
      <div className="mz bg-[var(--paper-2)] border border-dashed border-[var(--rule)] rounded-[3px] py-2 px-3 text-xs text-[var(--ink-500)]">
        No lane data available.
      </div>
    );
  }

  return (
    <div className="mz mz-card divide-y divide-[var(--rule-soft)] overflow-hidden">
      {/* Column headers — Bloomberg style */}
      <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-[var(--paper-2)]">
        {['Source', 'Checked At', 'Receipt ID', 'Tier'].map((col) => (
          <span
            key={col}
            className="mz-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-400)]"
          >
            {col}
          </span>
        ))}
      </div>

      {lanes.map((lane) => {
        const def = KNOWN_LANES.find((l) => l.laneId === lane.laneId);
        const sourceName = lane.source ?? def?.source ?? lane.laneId;
        const displayName = def?.displayName ?? lane.laneId;
        const tier =
          TIER_BADGE[lane.status] ?? {
            label: lane.status,
            chip: 'mz-chip-unknown',
            dot: 'bg-[var(--unknown)]',
          };

        return (
          <div
            key={lane.laneId}
            className="grid grid-cols-4 gap-2 items-center px-3 min-h-[36px] hover:bg-[var(--paper-2)] transition-colors"
          >
            {/* Source — left-align, max-w constrained */}
            <div className="flex flex-col min-w-0 max-w-[160px]">
              <span className="text-xs font-medium text-[var(--ink-900)] truncate">
                {displayName}
              </span>
              <span className="mz-mono text-[10px] text-[var(--ink-500)] truncate">{sourceName}</span>
            </div>

            {/* Checked At */}
            <div className="mz-mono text-xs text-[var(--ink-500)]">
              {formatCheckedAt(lane.checkedAt)}
            </div>

            {/* Receipt ID — 12 chars + status dot */}
            <div className="flex items-center gap-1.5">
              <span
                className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', tier.dot)}
              />
              <span className="mz-mono text-xs text-[var(--ink-900)] truncate">
                {shortId(lane.receiptId)}
              </span>
            </div>

            {/* Tier Badge — right-align */}
            <div className="flex justify-end">
              <span className={cn('mz-chip', tier.chip)}>
                <span className="mz-gl" aria-hidden="true" />
                {tier.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
