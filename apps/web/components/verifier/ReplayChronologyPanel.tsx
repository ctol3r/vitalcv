'use client';

/**
 * ReplayChronologyPanel.tsx
 *
 * Connected ledger of check events. Each lane becomes a run block.
 * Adjacent blocks share borders for a ledger / audit packet look.
 *
 * Design: calm-glass chronology — paper card, mono timestamps, hairline
 * dividers, truth chips for event state. No rounded-none Bloomberg dark look.
 * wave-receipt-elevation: connected run blocks, gap banners, chain links.
 */

import type { LaneSnapshot } from '@/components/proof/trust-types';
import { STATUS_COLORS, KNOWN_LANES } from '@/components/proof/trust-types';
import { cn } from '@/lib/utils';

interface ReplayChronologyPanelProps {
  lanes: LaneSnapshot[];
  /** Additional historical snapshots for replay */
  priorLanes?: LaneSnapshot[];
}

function toIsoFull(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return '—';
  return id.slice(0, len);
}

// Truth contract: never the bare word "Verified" as a status label —
// 'SOURCE-BACKED' matches the ProvenanceStrip vocabulary for this state.
const STATUS_LABEL: Record<string, string> = {
  verified: 'SOURCE-BACKED',
  in_progress: 'IN PROGRESS',
  not_checked: 'NOT CHECKED',
  stale: 'STALE',
  unavailable: 'UNAVAILABLE',
  access_required: 'ACCESS REQ.',
  review_required: 'REVIEW REQ.',
  // The chronology records that a read HAPPENED, which is why a not-found lane
  // legitimately appears here at all — but the event must state what came back,
  // or the timeline reads as a run of successful confirmations.
  not_found: 'NO ACTIVE RECORD',
  adverse: 'ADVERSE',
};

// Inline status-value color (calm tokens, not raw Tailwind palette).
const STATUS_TEXT: Record<string, string> = {
  verified: 'text-[var(--ok)] font-semibold',
  adverse: 'text-[var(--p0)] font-semibold',
  stale: 'text-[var(--watch)] font-semibold',
  in_progress: 'text-[var(--watch)] font-semibold',
  not_checked: 'text-[var(--ink-500)]',
  unavailable: 'text-[var(--ink-500)]',
  access_required: 'text-[var(--watch)] font-semibold',
  review_required: 'text-[var(--watch)] font-semibold',
  not_found: 'text-[var(--ink-500)]',
};

// Event-state truth chip variant per lane status.
const STATUS_CHIP: Record<string, string> = {
  verified: 'mz-chip-ok',
  adverse: 'mz-chip-p0',
  stale: 'mz-chip-watch',
  in_progress: 'mz-chip-watch',
  not_checked: 'mz-chip-unknown',
  unavailable: 'mz-chip-unknown',
  access_required: 'mz-chip-watch',
  review_required: 'mz-chip-watch',
  not_found: 'mz-chip-unknown',
};

interface RunEvent {
  isoTs: string;
  tsMs: number;
  lane: string;
  source: string;
  status: string;
  receiptId: string | null | undefined;
  tier: string;
}

function buildEvents(lanes: LaneSnapshot[], prior: LaneSnapshot[]): RunEvent[] {
  const all = [...lanes, ...prior];
  return all
    .filter((l) => l.checkedAt !== null)
    .map((l) => {
      const def = KNOWN_LANES.find((d) => d.laneId === l.laneId);
      // Normalize before label/color lookups so a runtime status like
      // 'VERIFIED' resolves through STATUS_LABEL instead of falling back
      // to the banned bare label via toUpperCase().
      const status = String(l.status).trim().toLowerCase();
      return {
        isoTs: toIsoFull(l.checkedAt),
        tsMs: l.checkedAt ?? 0,
        lane: def?.displayName ?? l.laneId,
        source: l.source ?? def?.source ?? l.laneId,
        status,
        receiptId: l.receiptId,
        tier: status === 'verified' ? 'T3' : 'T1',
      };
    })
    .sort((a, b) => b.tsMs - a.tsMs);
}

/** Detect a gap between two sorted events (> 7 days = notable gap) */
function hasGap(a: RunEvent, b: RunEvent): boolean {
  return Math.abs(a.tsMs - b.tsMs) > 7 * 24 * 60 * 60 * 1000;
}

export function ReplayChronologyPanel({
  lanes,
  priorLanes = [],
}: ReplayChronologyPanelProps) {
  const events = buildEvents(lanes, priorLanes);

  return (
    <div className="mz mz-card overflow-hidden">
      {/* Header — calm ledger eyebrow */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--rule)] bg-[var(--paper-2)]">
        <span className="mz-eyebrow">Replay Chronology</span>
        <span className="mz-mono text-[10px] text-[var(--ink-400)]">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="mz-mono px-3 py-4 text-xs text-[var(--ink-400)] text-center border-t border-dashed border-[var(--rule-soft)]">
          No prior runs
        </div>
      ) : (
        <div>
          {events.map((ev, idx) => {
            const isLast = idx === events.length - 1;
            const nextEv = events[idx + 1];
            const showGap = !isLast && nextEv && hasGap(ev, nextEv);
            const statusCls = STATUS_TEXT[ev.status] ?? 'text-[var(--ink-600)] font-semibold';

            return (
              <div key={`${ev.isoTs}-${ev.lane}-${idx}`}>
                {/* Run block */}
                <div
                  className={cn(
                    'py-1.5 px-3',
                    isLast ? 'border-b-0' : 'border-b border-[var(--rule-soft)]',
                  )}
                >
                  {/* Line 1: run_id + tier */}
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div>
                      <span className="text-[10px] text-[var(--ink-400)]">run_id: </span>
                      <span className="mz-mono text-xs text-[var(--ink-900)]">
                        {shortId(ev.receiptId, 8)}
                      </span>
                    </div>
                    <span className={cn('mz-chip', STATUS_CHIP[ev.status] ?? 'mz-chip-unknown')}>
                      <span className="mz-gl" aria-hidden="true" />
                      {ev.tier} · {STATUS_LABEL[ev.status] ?? ev.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Line 2: timestamp */}
                  <div className="mz-mono text-xs text-[var(--ink-500)] mb-0.5">
                    {ev.isoTs}
                  </div>

                  {/* Line 3: source + status */}
                  <div className="text-xs text-[var(--ink-600)]">
                    Source:{' '}
                    <span className="font-medium text-[var(--ink-800)]">{ev.source}</span>
                    {' · '}
                    Status:{' '}
                    <span className={statusCls}>
                      {STATUS_LABEL[ev.status] ?? ev.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Line 4: chain link — run: prefix disambiguates from receipt IDs */}
                  {isLast ? (
                    <div className="mz-mono text-xs text-[var(--ink-300)] mt-0.5 ml-2">
                      ↳ genesis
                    </div>
                  ) : (
                    <div className="mz-mono text-xs text-[var(--ink-400)] mt-0.5 ml-2">
                      ↳ prior: run:{shortId(nextEv?.receiptId, 8)}
                    </div>
                  )}
                </div>

                {/* Gap banner */}
                {showGap && (
                  <div className="mz-mono border border-dashed border-[var(--watch-rule)] bg-[var(--watch-bg)] px-3 py-2 text-xs text-[var(--watch)]">
                    ⚠ Gap detected — {Math.round(Math.abs(ev.tsMs - nextEv.tsMs) / (24 * 60 * 60 * 1000))}d between runs
                  </div>
                )}
              </div>
            );
          })}

          {events.length === 1 && (
            <div className="mz-mono px-3 py-2 text-[10px] text-[var(--ink-400)] border-t border-dashed border-[var(--rule-soft)]">
              No prior runs — this is the first recorded check.
            </div>
          )}

          {/* Survivability footer */}
          <div className="px-3 py-2 bg-[var(--paper-2)] border-t border-[var(--rule)] flex items-center justify-between gap-2">
            <span className="mz-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ink-400)]">
              Chain integrity
            </span>
            <span className="mz-mono text-[10px] text-[var(--ink-500)]">
              {events.length} event{events.length !== 1 ? 's' : ''}
              {events.length > 1 && events.every((e, i) => i === 0 || !hasGap(events[i - 1], e)) ? ' · no gaps' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
