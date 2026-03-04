'use client';

/**
 * NetworkActivity.tsx — Wave 55: Network Activity Feed
 *
 * Displays recent trust network events: verifications, attestations,
 * revocation broadcasts. For use on the homepage or dashboard.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  timestamp: string;
  icon: string;
  color: string;
}

interface NetworkActivityProps {
  className?: string;
  maxEvents?: number;
  apiBaseUrl?: string;
}

// ── Event Generation (demo data until real API) ───────────────────────────

const EVENT_TYPES = [
  { type: 'verification', label: 'Credential Verified', icon: '✓', color: 'text-emerald-400' },
  { type: 'attestation', label: 'Bundle Attested', icon: '◆', color: 'text-blue-400' },
  { type: 'revocation', label: 'Revocation Broadcast', icon: '⚡', color: 'text-red-400' },
  { type: 'issuance', label: 'Credential Issued', icon: '◎', color: 'text-amber-400' },
  { type: 'monitoring', label: 'Monitoring Sweep', icon: '↻', color: 'text-purple-400' },
];

function generateDemoEvent(index: number): ActivityEvent {
  const template = EVENT_TYPES[index % EVENT_TYPES.length];
  const now = new Date();
  now.setMinutes(now.getMinutes() - index * 3);
  return {
    id: `event-${Date.now()}-${index}`,
    type: template.type,
    label: template.label,
    timestamp: now.toISOString(),
    icon: template.icon,
    color: template.color,
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export function NetworkActivity({
  className = '',
  maxEvents = 8,
  apiBaseUrl = '',
}: NetworkActivityProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchEvents = useCallback(async () => {
    try {
      // Try real API first
      const res = await fetch(`${apiBaseUrl}/metrics/public`);
      if (res.ok) {
        // Real API available — generate events from metrics
        // TODO: Replace with dedicated /api/activity endpoint when available
        const demoEvents = Array.from({ length: maxEvents }, (_, i) => generateDemoEvent(i));
        setEvents(demoEvents);
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      // Fallback to demo events
      const demoEvents = Array.from({ length: maxEvents }, (_, i) => generateDemoEvent(i));
      setEvents(demoEvents);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, maxEvents]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchEvents();
    }
  }, [fetchEvents]);

  return (
    <section className={`${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">Network Activity</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-zinc-500">Live</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white/[0.03] rounded-lg h-12 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
            >
              <span className={`text-sm ${event.color}`}>{event.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300">{event.label}</p>
              </div>
              <time className="text-[10px] text-zinc-600 flex-shrink-0">
                {formatRelativeTime(event.timestamp)}
              </time>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default NetworkActivity;
