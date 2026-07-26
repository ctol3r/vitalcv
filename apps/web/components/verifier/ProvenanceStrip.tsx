'use client';

/**
 * ProvenanceStrip.tsx
 *
 * Horizontal strip per lane: [Source] → [Checked At] → [Receipt ID (short)] → [Tier Badge]
 * Source: LaneSnapshot from trust-types.ts
 *
 * The Checked At column carries the absolute stamp *and* the age measured
 * against that source's own refresh window, so a periodic read is never
 * presented as a fresh one (see describeLaneFreshness).
 *
 * Design: Bloomberg column headers, hairline dividers, monospaced IDs, dense rows.
 */

import type { LaneSnapshot } from '@/components/proof/trust-types';
import { findLaneDefinition } from '@/components/proof/trust-types';
import { cn } from '@/lib/utils';

interface ProvenanceStripProps {
  lanes: LaneSnapshot[];
  /** Injectable clock — keeps age rendering deterministic under test. */
  now?: number;
}

function formatCheckedAt(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Whole-unit age, coarse on purpose — this is a freshness cue, not a duration. */
function formatAge(ageMs: number): string {
  if (ageMs < HOUR_MS) return '<1h ago';
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)}h ago`;
  return `${Math.floor(ageMs / DAY_MS)}d ago`;
}

export type LaneFreshness = {
  state: 'unknown' | 'current' | 'overdue';
  label: string | null;
};

/**
 * Contextualize a lane's check age by its own refresh window.
 *
 * A periodic source is not "stale" merely because it was read weeks ago — a
 * quarterly release read 17 days ago is the current release. But a bare
 * timestamp next to a green tier reads as "just checked", which is the
 * over-claim this repairs: the age is always shown, and it is shown *against*
 * the window so the reviewer can see 17 of 90 rather than do the arithmetic.
 *
 * The window is the source's own refresh SLA (sourceCatalog.refreshSlaHours),
 * carried on the passport as `freshnessWindowHours`. Nothing is derived from a
 * threshold invented here.
 */
export function describeLaneFreshness(
  checkedAt: number | null | undefined,
  freshnessWindowMs: number | undefined,
  now: number,
): LaneFreshness {
  if (!checkedAt || !Number.isFinite(checkedAt)) {
    return { state: 'unknown', label: null };
  }

  const ageMs = Math.max(0, now - checkedAt);
  const age = formatAge(ageMs);

  if (!freshnessWindowMs || !Number.isFinite(freshnessWindowMs) || freshnessWindowMs <= 0) {
    // No published window — report the age plainly rather than imply a cadence.
    return { state: 'unknown', label: age };
  }

  const windowDays = Math.max(1, Math.round(freshnessWindowMs / DAY_MS));

  return ageMs > freshnessWindowMs
    ? { state: 'overdue', label: `${age} · past ${windowDays}d window` }
    : { state: 'current', label: `${age} · ${windowDays}d window` };
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

export function ProvenanceStrip({ lanes, now = Date.now() }: ProvenanceStripProps) {
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
        const def = findLaneDefinition(lane.laneId);
        const sourceName = lane.source ?? def?.source ?? lane.laneId;
        const displayName = def?.displayName ?? lane.laneId;
        const tier =
          TIER_BADGE[lane.status] ?? {
            label: lane.status,
            chip: 'mz-chip-unknown',
            dot: 'bg-[var(--unknown)]',
          };
        const freshness = describeLaneFreshness(
          lane.checkedAt,
          lane.freshnessWindowMs,
          now,
        );

        return (
          <div
            key={lane.laneId}
            data-lane-freshness={freshness.state}
            className="grid grid-cols-4 gap-2 items-center px-3 min-h-[36px] hover:bg-[var(--paper-2)] transition-colors"
          >
            {/* Source — left-align, max-w constrained */}
            <div className="flex flex-col min-w-0 max-w-[160px]">
              <span className="text-xs font-medium text-[var(--ink-900)] truncate">
                {displayName}
              </span>
              <span className="mz-mono text-[10px] text-[var(--ink-500)] truncate">{sourceName}</span>
            </div>

            {/* Checked At — absolute stamp, then age against the source's own
                refresh window so a periodic read is never read as a fresh one. */}
            <div className="flex flex-col min-w-0">
              <span className="mz-mono text-xs text-[var(--ink-500)]">
                {formatCheckedAt(lane.checkedAt)}
              </span>
              {freshness.label && (
                <span
                  className={cn(
                    'mz-mono text-[10px] truncate',
                    freshness.state === 'overdue'
                      ? 'text-[var(--watch)]'
                      : 'text-[var(--ink-500)]',
                  )}
                >
                  {freshness.label}
                </span>
              )}
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
