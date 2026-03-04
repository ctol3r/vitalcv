'use client';

/**
 * Live Network Map — Wave 61: Global Trust Network
 *
 * Route: /network/live
 * Displays real-time network activity with animated event packets.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveNetworkMap } from '@/components/network/LiveNetworkMap';

// ── Types ─────────────────────────────────────────────────────────────────

interface NetworkEvent {
  id: string;
  type: 'verification' | 'attestation' | 'revocation';
  description: string;
  npi: string;
  timestamp: string;
}

interface ActivityResponse {
  events: NetworkEvent[];
  totalCount: number;
  generatedAt: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const POLL_MS = 15_000;
const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  verification: { icon: '✓', color: 'text-emerald-400' },
  attestation: { icon: '◆', color: 'text-blue-400' },
  revocation: { icon: '⚡', color: 'text-red-400' },
};

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export default function LiveNetworkPage() {
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [online, setOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/network/activity');
      if (!res.ok) { setOnline(false); return; }
      const data = (await res.json()) as ActivityResponse;
      setEvents(data.events);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    intervalRef.current = setInterval(fetchActivity, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchActivity]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <motion.header {...fadeUp} className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Live Trust Network</h1>
          <p className="text-xs text-zinc-500">Real-time credential activity</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[11px] text-zinc-500">{online ? 'Connected' : 'Offline'}</span>
        </div>
      </motion.header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Network Visualization */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="flex-1 relative">
          <LiveNetworkMap events={events} />
        </motion.div>

        {/* Activity Stream */}
        <motion.aside {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
          className="w-80 border-l border-zinc-800 overflow-y-auto p-4 flex-shrink-0">
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">
            Recent Activity ({events.length})
          </h3>
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {events.slice(0, 30).map((event) => {
                const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.verification;
                return (
                  <motion.div key={event.id}
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${cfg.color}`}>{cfg.icon}</span>
                      <p className="text-[11px] text-zinc-300 flex-1 truncate">{event.description}</p>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-mono text-zinc-600">{event.npi}</span>
                      <time className="text-[9px] text-zinc-600">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </time>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.aside>
      </div>
    </main>
  );
}
