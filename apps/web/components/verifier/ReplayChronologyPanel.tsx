'use client';

/**
 * ReplayChronologyPanel.tsx
 *
 * Ordered list of check events with timestamps.
 * Each row: [ISO timestamp] [lane] [status] [receipt_id short]
 * Source: ReadinessSnapshot.lanes from trust-types.ts
 */

import type { LaneSnapshot } from '@/components/proof/trust-types';
import { STATUS_COLORS, KNOWN_LANES } from '@/components/proof/trust-types';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface ReplayChronologyPanelProps {
  lanes: LaneSnapshot[];
  /** Additional historical snapshots for replay; if > 1 event, shows full chronology */
  priorLanes?: LaneSnapshot[];
}

function toIso(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toISOString();
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.slice(0, 8);
}

interface CheckEvent {
  isoTs: string;
  tsMs: number;
  lane: string;
  status: string;
  receiptId: string | null | undefined;
}

function buildEvents(lanes: LaneSnapshot[], prior: LaneSnapshot[]): CheckEvent[] {
  const all = [...lanes, ...prior];
  return all
    .filter((l) => l.checkedAt !== null)
    .map((l) => {
      const def = KNOWN_LANES.find((d) => d.laneId === l.laneId);
      return {
        isoTs: toIso(l.checkedAt),
        tsMs: l.checkedAt ?? 0,
        lane: def?.displayName ?? l.laneId,
        status: l.status,
        receiptId: l.receiptId,
      };
    })
    .sort((a, b) => b.tsMs - a.tsMs);
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

export function ReplayChronologyPanel({
  lanes,
  priorLanes = [],
}: ReplayChronologyPanelProps) {
  const events = buildEvents(lanes, priorLanes);

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Replay Chronology
        </span>
        <span className="ml-auto text-[10px] text-gray-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
      </div>

      {events.length === 0 ? (
        <div className="px-3 py-4 text-xs text-gray-400 text-center">No prior runs</div>
      ) : events.length === 1 ? (
        <>
          <ChronologyRow event={events[0]} />
          <div className="px-3 py-2 text-[10px] text-gray-400 border-t border-dashed border-gray-200">
            No prior runs — this is the first recorded check.
          </div>
        </>
      ) : (
        <div className="divide-y divide-gray-100">
          {events.map((ev, idx) => (
            <ChronologyRow key={`${ev.isoTs}-${ev.lane}-${idx}`} event={ev} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChronologyRow({ event }: { event: CheckEvent }) {
  const colors = STATUS_COLORS[event.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.not_checked;

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors">
      {/* Timestamp */}
      <span className="text-[10px] font-mono text-gray-500 tabular-nums whitespace-nowrap">
        {event.isoTs}
      </span>

      {/* Lane */}
      <span className="text-xs text-gray-800 font-medium truncate">{event.lane}</span>

      {/* Status */}
      <span
        className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded',
          colors.bg,
          colors.text,
        )}
      >
        {STATUS_LABEL[event.status] ?? event.status.toUpperCase()}
      </span>

      {/* Receipt short ID */}
      <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
        {event.receiptId ? shortId(event.receiptId) : '—'}
      </span>
    </div>
  );
}
