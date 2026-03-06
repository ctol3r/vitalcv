'use client';

/**
 * EventFeed.tsx — Wave 93: Live Event Feed (SWR-polled)
 *
 * Uses useAlertStream hook for consistent SWR polling with
 * loading states, error handling, and abort-on-unmount.
 */

import { motion } from 'framer-motion';
import { AlertStream } from '@/components/monitoring/AlertStream';
import { useAlertStream } from '@/hooks/useAlertStream';

interface EventFeedProps {
  refreshInterval?: number; // ms
  className?: string;
}

export function EventFeed({ refreshInterval = 30_000, className = '' }: EventFeedProps) {
  const { data: alerts, loading, error } = useAlertStream(refreshInterval);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Live Events</h3>
        <motion.span
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`h-1.5 w-1.5 rounded-full ${error ? 'bg-red-400' : 'bg-emerald-400'}`}
        />
      </div>
      {error && (
        <p className="text-[10px] text-red-400 mb-2">Connection error</p>
      )}
      <AlertStream alerts={alerts} loading={loading && alerts.length === 0} />
    </div>
  );
}

export default EventFeed;
