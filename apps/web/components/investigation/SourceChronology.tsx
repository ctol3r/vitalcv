'use client';

/**
 * SourceChronology.tsx
 *
 * Events grouped by lane. Each lane: collapsible via <details>.
 * Header: lane name + event count + latest status + tier.
 */

import type { EvidenceEvent } from './EvidenceTimeline';

export interface SourceChronologyProps {
  eventsByLane: Record<string, EvidenceEvent[]>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function statusCls(s: string): string {
  switch (s) {
    case 'verified':     return 'text-green-700';
    case 'unavailable':  return 'text-gray-400';
    case 'stale':        return 'text-amber-600';
    case 'not_checked':  return 'text-gray-400';
    case 'adverse':      return 'text-red-600';
    default:             return 'text-gray-600';
  }
}

function latestStatus(events: EvidenceEvent[]): string {
  if (events.length === 0) return 'not_checked';
  const sorted = [...events].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
  return sorted[0].status;
}

function latestTier(events: EvidenceEvent[]): string {
  if (events.length === 0) return 'T1';
  const sorted = [...events].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
  return sorted[0].tier;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SourceChronology({ eventsByLane }: SourceChronologyProps) {
  const lanes = Object.keys(eventsByLane);

  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Source Chronology</span>
      </div>

      {lanes.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">No lane data available.</div>
      ) : (
        <div>
          {lanes.map((laneId) => {
            const events = eventsByLane[laneId];
            const count = events.length;
            const status = latestStatus(events);
            const tier = latestTier(events);
            const sorted = [...events].sort(
              (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
            );

            return (
              <details key={laneId} className="border-b border-gray-100 last:border-b-0 group">
                {/* Summary / header row */}
                <summary className="flex items-center gap-3 px-4 min-h-[32px] cursor-pointer list-none select-none hover:bg-gray-50">
                  <span className="font-mono text-[10px] text-gray-400 w-3 shrink-0 group-open:hidden">▸</span>
                  <span className="font-mono text-[10px] text-gray-400 w-3 shrink-0 hidden group-open:inline">▾</span>
                  <span className="font-mono text-xs text-gray-900 uppercase">{laneId.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[10px] text-gray-400">{count} check{count !== 1 ? 's' : ''}</span>
                  <span className={`font-mono text-[10px] font-semibold ${statusCls(status)}`}>
                    {statusLabel(status)}
                  </span>
                  <span className="font-mono text-[10px] border border-gray-300 px-1 text-gray-500">
                    {tier}
                  </span>
                </summary>

                {/* Expanded rows */}
                <div className="border-l border-gray-200 ml-8 pl-3 pb-1">
                  {sorted.length === 0 ? (
                    <div className="py-1 text-[10px] text-gray-400 italic">No checks recorded.</div>
                  ) : (
                    sorted.map((evt) => (
                      <div
                        key={evt.eventId}
                        className="flex items-baseline gap-2 flex-wrap py-1 border-b border-gray-50 last:border-b-0"
                      >
                        <span className="font-mono text-xs text-gray-500 shrink-0">
                          {evt.ts.slice(0, 10)}
                        </span>
                        <span className={`font-mono text-xs font-semibold ${statusCls(evt.status)}`}>
                          {statusLabel(evt.status)}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400">
                          {evt.receiptId ? evt.receiptId.slice(0, 12) + '…' : '—'}
                        </span>
                        <span className="font-mono text-[10px] text-gray-400">
                          actor: {evt.actor ?? '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
