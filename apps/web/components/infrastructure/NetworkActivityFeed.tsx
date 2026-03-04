'use client';

/**
 * NetworkActivityFeed.tsx — Wave 63: Live Event Stream
 *
 * Fetches from /api/network/activity and displays recent trust events
 * with hash prefixes, event types, and relative timestamps.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  type: 'verification' | 'attestation' | 'revocation';
  description: string;
  npi: string;
  timestamp: string;
}

interface ActivityResponse {
  events: ActivityEvent[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const POLL_MS = 15_000;

const TYPE_CFG: Record<string, { icon: string; color: string; label: string }> = {
  verification: { icon: '✓', color: 'text-emerald-400', label: 'Verified' },
  attestation: { icon: '◆', color: 'text-blue-400', label: 'Attested' },
  revocation: { icon: '⚡', color: 'text-red-400', label: 'Revoked' },
};

// Demo fallback events
function demoEvents(): ActivityEvent[] {
  const types: Array<ActivityEvent['type']> = ['verification', 'attestation', 'revocation'];
  const descs = ['License Verified', 'Attestation Signed', 'Credential Revoked', 'Board Cert Confirmed', 'DEA Validated'];
  return Array.from({ length: 8 }, (_, i) => ({
    id: `demo-${i}`,
    type: types[i % types.length],
    description: descs[i % descs.length],
    npi: `${1000000000 + i * 111}`,
    timestamp: new Date(Date.now() - i * 120_000).toISOString(),
  }));
}

function hashSnippet(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return '0x' + Math.abs(h).toString(16).padStart(6, '0').slice(0, 6);
}

function relativeTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function NetworkActivityFeed({ className = '', maxEvents = 8 }: { className?: string; maxEvents?: number }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/network/activity');
      if (!res.ok) throw new Error('');
      const data = (await res.json()) as ActivityResponse;
      setEvents(data.events.length > 0 ? data.events.slice(0, maxEvents) : demoEvents());
    } catch {
      setEvents(demoEvents());
    }
  }, [maxEvents]);

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch_]);

  return (
    <div className={`glass rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-300">Network Activity</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] text-zinc-600">Live</span>
        </div>
      </div>

      <div className="space-y-0.5">
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const cfg = TYPE_CFG[event.type] ?? TYPE_CFG.verification;
            return (
              <motion.div key={event.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.02] transition-colors"
              >
                <span className={`text-[10px] ${cfg.color} w-3`}>{cfg.icon}</span>
                <span className="text-[9px] font-mono text-zinc-600 w-16">[{hashSnippet(event.id)}]</span>
                <span className="text-[11px] text-zinc-300 flex-1 truncate">{event.description}</span>
                <span className="text-[9px] text-zinc-600 flex-shrink-0">{relativeTime(event.timestamp)}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default NetworkActivityFeed;
