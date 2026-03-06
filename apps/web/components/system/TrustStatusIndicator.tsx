'use client';

/**
 * TrustStatusIndicator.tsx — Wave 87: Aggregated Trust Status
 *
 * Shows READY / AT_RISK / BLOCKED based on system state.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

export type TrustStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

interface TrustStatusIndicatorProps {
  status: TrustStatus;
  summary?: {
    totalNodes: number;
    criticalAlerts: number;
    activeRisks: number;
    readiness: string;
  };
  className?: string;
}

// ── Styling ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<TrustStatus, { bg: string; border: string; text: string; dot: string; label: string; desc: string }> = {
  HEALTHY: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'System Healthy',
    desc: 'All credentials verified, no active risks',
  },
  DEGRADED: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    label: 'System Degraded',
    desc: 'Some credentials need attention',
  },
  CRITICAL: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
    label: 'System Critical',
    desc: 'Immediate action required',
  },
};

// ── Component ─────────────────────────────────────────────────────────

export function TrustStatusIndicator({ status, summary, className = '' }: TrustStatusIndicatorProps) {
  const style = STATUS_STYLE[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl p-4 border ${style.bg} ${style.border} ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${style.dot} ${status !== 'HEALTHY' ? 'animate-pulse' : ''}`} />
        <div>
          <h3 className={`text-sm font-bold ${style.text}`}>{style.label}</h3>
          <p className="text-[10px] text-zinc-500">{style.desc}</p>
        </div>
      </div>
      {summary && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.05]">
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-300">{summary.totalNodes}</p>
            <p className="text-[8px] text-zinc-600">Nodes</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-400">{summary.criticalAlerts}</p>
            <p className="text-[8px] text-zinc-600">Critical</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-amber-400">{summary.activeRisks}</p>
            <p className="text-[8px] text-zinc-600">Risks</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-300">{summary.readiness}</p>
            <p className="text-[8px] text-zinc-600">Readiness</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default TrustStatusIndicator;
