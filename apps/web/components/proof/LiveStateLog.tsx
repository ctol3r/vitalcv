'use client';
/**
 * LiveStateLog — wave-133
 * Replaces spinners. User sees system working.
 * Monospace timestamps. No decoration.
 */

import { useEffect, useRef } from 'react';
import type { StateLogEntry } from './trust-types';

export function LiveStateLog({
  entries,
  maxHeight = 200,
  autoScroll = true,
}: {
  entries: StateLogEntry[];
  maxHeight?: number;
  autoScroll?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  if (entries.length === 0) return null;

  return (
    <div
      className="bg-slate-950 rounded-lg border border-slate-800 overflow-auto font-mono text-xs"
      style={{ maxHeight }}
    >
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-slate-400 uppercase tracking-widest text-[9px] font-bold">System Log</span>
      </div>
      <div className="p-3 space-y-0.5">
        {entries.map((entry, i) => (
          <LogLine key={i} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: StateLogEntry }) {
  const ts = new Date(entry.ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const colors = {
    info:  'text-slate-300',
    warn:  'text-amber-400',
    error: 'text-red-400',
  }[entry.level];

  return (
    <div className={`flex items-start gap-3 ${colors}`}>
      <span className="text-slate-600 flex-shrink-0 select-none">[{ts}]</span>
      <span className="leading-relaxed">{entry.message}</span>
    </div>
  );
}

// ─── Hook to build log entries from lane states ───────────────────

export function buildStateLog(lanes: Array<{ laneId: string; status: string; checkedAt: number | null }>): StateLogEntry[] {
  const now = Date.now();
  const entries: StateLogEntry[] = [];

  for (const lane of lanes) {
    const displayName = lane.laneId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const ts = lane.checkedAt ?? now;

    if (lane.status === 'verified') {
      entries.push({ ts, message: `${displayName} — verified`, level: 'info' });
    } else if (lane.status === 'in_progress') {
      entries.push({ ts: now, message: `${displayName} — check in progress…`, level: 'info' });
    } else if (lane.status === 'unavailable') {
      entries.push({ ts, message: `${displayName} — source temporarily unreachable`, level: 'warn' });
    } else if (lane.status === 'access_required') {
      entries.push({ ts, message: `${displayName} — institutional access required`, level: 'warn' });
    } else if (lane.status === 'stale') {
      entries.push({ ts, message: `${displayName} — previously verified, refresh needed`, level: 'warn' });
    } else if (lane.status === 'adverse') {
      entries.push({ ts, message: `${displayName} — ADVERSE FINDING DETECTED`, level: 'error' });
    } else {
      entries.push({ ts, message: `${displayName} — not yet checked this session`, level: 'info' });
    }
  }

  return entries.sort((a, b) => a.ts - b.ts);
}
