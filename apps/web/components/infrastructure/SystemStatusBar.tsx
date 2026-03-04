'use client';

/**
 * SystemStatusBar.tsx — Wave 63: Live System Status Strip
 *
 * Polls /metrics/public every 15s. Shows operational state,
 * bundles generated, verifications completed, network nodes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface Metrics {
  status: string;
  uptime: string;
  bundlesGenerated: number;
  verificationsPerformed: number;
  generated_at: string;
}

type SystemState = 'operational' | 'degraded' | 'loading';

// ── Constants ─────────────────────────────────────────────────────────────

const POLL_MS = 15_000;

const STATE_CFG: Record<SystemState, { label: string; dot: string; text: string }> = {
  operational: { label: 'Operational', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  degraded: { label: 'Degraded', dot: 'bg-amber-400', text: 'text-amber-400' },
  loading: { label: 'Connecting...', dot: 'bg-zinc-500', text: 'text-zinc-500' },
};

// ── Component ─────────────────────────────────────────────────────────────

export function SystemStatusBar({ className = '' }: { className?: string }) {
  const [state, setState] = useState<SystemState>('loading');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/metrics/public');
      if (!res.ok) { setState('degraded'); return; }
      const data = (await res.json()) as Metrics;
      setMetrics(data);
      setState('operational');
    } catch {
      setState('degraded');
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  const cfg = STATE_CFG[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className={`border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm ${className}`}
    >
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between">
        {/* Status */}
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${state === 'operational' ? 'animate-pulse' : ''}`} />
          <span className={`text-[11px] font-medium ${cfg.text}`}>System Status: {cfg.label}</span>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-6">
          <Stat label="Bundles" value={metrics?.bundlesGenerated} />
          <Stat label="Verifications" value={metrics?.verificationsPerformed} />
          <Stat label="Uptime" value={metrics?.uptime} isString />
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, isString }: { label: string; value?: number | string | null; isString?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-zinc-600">{label}:</span>
      <span className="text-[11px] font-mono text-zinc-400">
        {value == null ? '—' : isString ? String(value) : Number(value).toLocaleString()}
      </span>
    </div>
  );
}

export default SystemStatusBar;
