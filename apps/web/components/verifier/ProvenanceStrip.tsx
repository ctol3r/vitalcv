'use client';

/**
 * ProvenanceStrip.tsx
 *
 * Horizontal strip per lane: [Source] → [Checked At] → [Receipt ID (short)] → [Tier Badge]
 * Source: LaneSnapshot from trust-types.ts
 */

import type { LaneSnapshot } from '@/components/proof/trust-types';
import { STATUS_COLORS, KNOWN_LANES } from '@/components/proof/trust-types';
import { cn } from '@/lib/utils';

interface ProvenanceStripProps {
  lanes: LaneSnapshot[];
}

function formatCheckedAt(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.slice(0, 8) + '…';
}

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  verified:        { label: 'Verified',    cls: 'bg-green-100 text-green-800 border border-green-300' },
  in_progress:     { label: 'In Progress', cls: 'bg-blue-100 text-blue-800 border border-blue-300' },
  not_checked:     { label: 'Not Checked', cls: 'bg-gray-100 text-gray-600 border border-gray-300' },
  stale:           { label: 'Stale',       cls: 'bg-amber-100 text-amber-800 border border-amber-300' },
  unavailable:     { label: 'Unavailable', cls: 'bg-gray-100 text-gray-600 border border-gray-300' },
  access_required: { label: 'Access Req.', cls: 'bg-amber-100 text-amber-800 border border-amber-300' },
  review_required: { label: 'Review Req.', cls: 'bg-amber-100 text-amber-800 border border-amber-300' },
  adverse:         { label: 'Adverse',     cls: 'bg-red-100 text-red-800 border border-red-300' },
};

export function ProvenanceStrip({ lanes }: ProvenanceStripProps) {
  if (!lanes || lanes.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2 px-3 border border-dashed border-gray-200 rounded">
        No lane data available.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 border border-gray-200 rounded overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span>Source</span>
        <span>Checked At</span>
        <span>Receipt ID</span>
        <span>Tier</span>
      </div>

      {lanes.map((lane) => {
        const def = KNOWN_LANES.find((l) => l.laneId === lane.laneId);
        const sourceName = lane.source ?? def?.source ?? lane.laneId;
        const displayName = def?.displayName ?? lane.laneId;
        const colors = STATUS_COLORS[lane.status] ?? STATUS_COLORS.not_checked;
        const tier = TIER_BADGE[lane.status] ?? { label: lane.status, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };

        return (
          <div
            key={lane.laneId}
            className="grid grid-cols-4 gap-2 items-center px-3 py-2 hover:bg-gray-50 transition-colors"
          >
            {/* Source */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-gray-900 truncate">{displayName}</span>
              <span className="text-[10px] text-gray-500 truncate">{sourceName}</span>
            </div>

            {/* Checked At */}
            <div className="text-xs text-gray-700 font-mono tabular-nums">
              {formatCheckedAt(lane.checkedAt)}
            </div>

            {/* Receipt ID */}
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  colors.dot,
                )}
              />
              <span className="text-xs font-mono text-gray-600 truncate">
                {shortId(lane.receiptId)}
              </span>
            </div>

            {/* Tier Badge */}
            <div>
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
                  tier.cls,
                )}
              >
                {tier.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
