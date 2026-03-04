'use client';

/**
 * SystemStatusPanel.tsx — Wave 55: System Status Display
 *
 * Compact operational status panel showing system health metrics.
 * Polls /metrics/public every 15 seconds with graceful degradation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface PublicMetrics {
  status: string;
  uptime: string;
  bundlesGenerated: number;
  verificationsPerformed: number;
  generated_at: string;
}

type SystemState = 'operational' | 'degraded' | 'loading';

interface SystemStatusPanelProps {
  className?: string;
  compact?: boolean;
  apiBaseUrl?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;

const STATE_CONFIG: Record<SystemState, { label: string; color: string; dot: string }> = {
  operational: { label: 'Operational', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  degraded: { label: 'Degraded', color: 'text-amber-400', dot: 'bg-amber-400' },
  loading: { label: 'Connecting...', color: 'text-zinc-500', dot: 'bg-zinc-500' },
};

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] as const },
};

// ── Component ─────────────────────────────────────────────────────────────

export function SystemStatusPanel({
  className = '',
  compact = false,
  apiBaseUrl = '',
}: SystemStatusPanelProps) {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [state, setState] = useState<SystemState>('loading');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/metrics/public`);
      if (!res.ok) {
        setState('degraded');
        return;
      }
      const data = (await res.json()) as PublicMetrics;
      setMetrics(data);
      setState('operational');
    } catch {
      setState('degraded');
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchMetrics]);

  const cfg = STATE_CONFIG[state];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full ${cfg.dot} ${state === 'operational' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
        {metrics && (
          <span className="text-xs text-zinc-600 ml-2">
            {metrics.verificationsPerformed.toLocaleString()} verifications
          </span>
        )}
      </div>
    );
  }

  return (
    <motion.div {...fadeIn} className={`glass rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">System Status</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${cfg.dot} ${state === 'operational' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <AnimatePresence mode="wait">
        {metrics ? (
          <motion.div
            key="metrics"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3"
          >
            <MetricCard label="Uptime" value={metrics.uptime} />
            <MetricCard
              label="Verifications"
              value={metrics.verificationsPerformed.toLocaleString()}
            />
            <MetricCard
              label="Bundles"
              value={metrics.bundlesGenerated.toLocaleString()}
            />
            <MetricCard
              label="Last Updated"
              value={new Date(metrics.generated_at).toLocaleTimeString()}
            />
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3"
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white/[0.03] rounded-lg p-3 animate-pulse h-16" />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-zinc-200 mt-1">{value}</p>
    </div>
  );
}

export default SystemStatusPanel;
