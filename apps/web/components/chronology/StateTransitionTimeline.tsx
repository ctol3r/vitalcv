'use client';

/**
 * StateTransitionTimeline.tsx
 *
 * Tabular state-change history for a credential lane.
 * Each row: timestamp · from→to · trigger badge · ownership label.
 * Bloomberg terminal aesthetic: dense, monochrome base, no decoration.
 */

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StateTransition {
  ts: string;
  fromStatus: string;
  toStatus: string;
  laneId: string;
  trigger: 'check' | 'expiry' | 'restart' | 'manual';
  ownership: 'infrastructure' | 'issuer' | 'system';
}

export interface StateTransitionTimelineProps {
  transitions: StateTransition[];
  laneId?: string; // filter to one lane
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function toStatusCls(s: string): string {
  switch (s) {
    case 'verified':    return 'text-green-700';
    case 'stale':       return 'text-amber-600';
    case 'unavailable': return 'text-gray-400';
    case 'adverse':     return 'text-red-600';
    default:            return 'text-gray-500';
  }
}

function ownershipCls(o: StateTransition['ownership']): string {
  switch (o) {
    case 'infrastructure': return 'text-gray-500';
    case 'issuer':         return 'text-amber-600';
    case 'system':         return 'text-blue-600';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StateTransitionTimeline({
  transitions,
  laneId,
}: StateTransitionTimelineProps) {
  const label = laneId
    ? laneId.toUpperCase().replace(/_/g, ' ')
    : 'ALL LANES';

  const filtered = laneId
    ? transitions.filter((t) => t.laneId === laneId)
    : transitions;

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-2 mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          State Transitions
        </div>
        <div className="text-[10px] font-mono text-gray-400">{label}</div>
      </div>

      <div className="border-t border-gray-200 mb-0" />

      {filtered.length === 0 ? (
        <div className="py-2 text-xs font-mono text-gray-400">No transitions recorded.</div>
      ) : (
        <div>
          {filtered.map((t, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-h-[32px] border-b border-gray-100 py-1"
            >
              {/* Timestamp */}
              <span className="font-mono text-[10px] text-gray-400 w-20 flex-shrink-0">
                {t.ts.slice(0, 10)}
              </span>

              {/* Transition */}
              <span className="font-mono text-xs flex items-baseline gap-1">
                <span className="text-gray-500">{statusLabel(t.fromStatus)}</span>
                <span className="text-gray-300 mx-0.5">→</span>
                <span className={toStatusCls(t.toStatus)}>{statusLabel(t.toStatus)}</span>
              </span>

              {/* Trigger badge */}
              <span className="text-[9px] font-mono uppercase border border-gray-200 px-1.5 py-0.5 text-gray-500">
                {t.trigger}
              </span>

              {/* Ownership */}
              <span className={cn('text-[9px] font-mono uppercase', ownershipCls(t.ownership))}>
                {t.ownership}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-200 mt-0" />
    </div>
  );
}
