'use client';

/**
 * ReplayChronologyPanel.tsx
 *
 * Connected ledger of check events. Each lane becomes a run block.
 * Adjacent blocks share borders for a ledger / audit packet look.
 *
 * Design: Bloomberg column headers, connected border ledger, no rounded corners.
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

const STATUS_LABEL: Record<string, string> = {
  verified: 'VERIFIED',
  in_progress: 'IN PROGRESS',
  not_checked: 'NOT CHECKED',
  stale: 'STALE',
  unavailable: 'UNAVAILABLE',
  access_required: 'ACCESS REQ.',
  review_required: 'REVIEW REQ.',
  adverse: 'ADVERSE',
};

const STATUS_TEXT: Record<string, string> = {
  verified: 'text-green-700 font-semibold',
  adverse: 'text-red-700 font-semibold',
  stale: 'text-amber-700 font-semibold',
  in_progress: 'text-blue-700 font-semibold',
  not_checked: 'text-gray-500',
  unavailable: 'text-gray-500',
  access_required: 'text-amber-700 font-semibold',
  review_required: 'text-amber-700 font-semibold',
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
      return {
        isoTs: toIsoFull(l.checkedAt),
        tsMs: l.checkedAt ?? 0,
        lane: def?.displayName ?? l.laneId,
        source: l.source ?? def?.source ?? l.laneId,
        status: l.status,
        receiptId: l.receiptId,
        tier: l.status === 'verified' ? 'T3' : 'T1',
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
    <div className="border border-gray-200 rounded-none overflow-hidden">
      {/* Header — Bloomberg style */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Replay Chronology
        </span>
        <span className="text-[10px] text-gray-400 font-mono">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-400 font-mono text-center border-t border-dashed border-gray-200">
          No prior runs
        </div>
      ) : (
        <div>
          {events.map((ev, idx) => {
            const isLast = idx === events.length - 1;
            const nextEv = events[idx + 1];
            const showGap = !isLast && nextEv && hasGap(ev, nextEv);
            const statusCls = STATUS_TEXT[ev.status] ?? 'text-gray-600 font-semibold';

            return (
              <div key={`${ev.isoTs}-${ev.lane}-${idx}`}>
                {/* Run block */}
                <div
                  className={cn(
                    'py-1.5 px-3',
                    isLast ? 'border-b-0' : 'border-b border-gray-100',
                  )}
                >
                  {/* Line 1: run_id + tier */}
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div>
                      <span className="text-[10px] text-gray-400">run_id: </span>
                      <span className="font-mono text-xs text-gray-900">
                        {shortId(ev.receiptId, 8)}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-gray-500 border border-gray-200 px-1.5 py-0.5 font-mono">
                      {ev.tier} · {STATUS_LABEL[ev.status] ?? ev.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Line 2: timestamp */}
                  <div className="font-mono text-xs text-gray-500 mb-0.5">
                    {ev.isoTs}
                  </div>

                  {/* Line 3: source + status */}
                  <div className="text-xs text-gray-600">
                    Source:{' '}
                    <span className="font-medium">{ev.source}</span>
                    {' · '}
                    Status:{' '}
                    <span className={statusCls}>
                      {STATUS_LABEL[ev.status] ?? ev.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Line 4: chain link — run: prefix disambiguates from receipt IDs */}
                  {isLast ? (
                    <div className="font-mono text-xs text-gray-300 mt-0.5 ml-2">
                      ↳ genesis
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-gray-400 mt-0.5 ml-2">
                      ↳ prior: run:{shortId(nextEv?.receiptId, 8)}
                    </div>
                  )}
                </div>

                {/* Gap banner */}
                {showGap && (
                  <div className="border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 font-mono">
                    ⚠ Gap detected — {Math.round(Math.abs(ev.tsMs - nextEv.tsMs) / (24 * 60 * 60 * 1000))}d between runs
                  </div>
                )}
              </div>
            );
          })}

          {events.length === 1 && (
            <div className="px-3 py-2 text-[10px] text-gray-400 border-t border-dashed border-gray-200 font-mono">
              No prior runs — this is the first recorded check.
            </div>
          )}

          {/* Survivability footer */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              Chain integrity
            </span>
            <span className="font-mono text-[10px] text-gray-500">
              {events.length} event{events.length !== 1 ? 's' : ''}
              {events.length > 1 && events.every((e, i) => i === 0 || !hasGap(events[i - 1], e)) ? ' · no gaps' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
