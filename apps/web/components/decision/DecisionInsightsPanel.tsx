'use client';

/**
 * DecisionInsightsPanel.tsx — Wave 83: Decision Intelligence Display
 *
 * Shows readiness status, risk indicators, and recommended actions.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

interface RiskFactor {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
}

interface RecommendedAction {
  id: string;
  priority: 'IMMEDIATE' | 'SOON' | 'ROUTINE';
  target: string;
  action: string;
  reason: string;
}

interface BlockingCredential {
  id: string;
  source: string;
  status: string;
  reason: string;
}

export interface DecisionInsightsData {
  readiness: 'READY' | 'AT_RISK' | 'BLOCKED';
  insights: RiskFactor[];
  actions: RecommendedAction[];
  blockingCredentials: BlockingCredential[];
}

interface DecisionInsightsPanelProps {
  data: DecisionInsightsData | null;
  loading?: boolean;
  className?: string;
}

// ── Status Styling ────────────────────────────────────────────────────

const READINESS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  READY: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Ready to Proceed' },
  AT_RISK: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'At Risk' },
  BLOCKED: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Blocked' },
};

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'border-red-500/30 bg-red-500/[0.06] text-red-300',
  HIGH: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-300',
  MEDIUM: 'border-yellow-500/20 bg-yellow-500/[0.04] text-yellow-300',
  LOW: 'border-zinc-700 bg-white/[0.02] text-zinc-400',
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  IMMEDIATE: { bg: 'bg-red-500/20', text: 'text-red-300' },
  SOON: { bg: 'bg-amber-500/20', text: 'text-amber-300' },
  ROUTINE: { bg: 'bg-zinc-700', text: 'text-zinc-400' },
};

// ── Component ─────────────────────────────────────────────────────────

export function DecisionInsightsPanel({ data, loading, className = '' }: DecisionInsightsPanelProps) {
  if (loading) {
    return (
      <div className={`p-4 space-y-3 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`p-4 flex items-center justify-center ${className}`}>
        <p className="text-xs text-zinc-600">No insights available</p>
      </div>
    );
  }

  const style = READINESS_STYLE[data.readiness] ?? READINESS_STYLE.BLOCKED;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`p-4 space-y-4 ${className}`}
    >
      {/* Readiness Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-xl p-4 border ${style.bg} border-current/20`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot} ${data.readiness !== 'READY' ? 'animate-pulse' : ''}`} />
          <h3 className={`text-sm font-bold ${style.text}`}>{style.label}</h3>
        </div>
      </motion.div>

      {/* Blocking Credentials */}
      {data.blockingCredentials.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Blocking ({data.blockingCredentials.length})
          </h4>
          <div className="space-y-1">
            {data.blockingCredentials.map((cred) => (
              <div key={cred.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/10">
                <span className="text-red-400 text-[10px]">✕</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-red-300 truncate">{cred.source}</p>
                  <p className="text-[9px] text-red-400/60">{cred.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Risk Factors */}
      {data.insights.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Risk Factors ({data.insights.length})
          </h4>
          <div className="space-y-1">
            {data.insights.slice(0, 5).map((risk) => (
              <div key={risk.id} className={`px-2.5 py-2 rounded-lg border ${SEVERITY_STYLE[risk.severity] ?? SEVERITY_STYLE.LOW}`}>
                <p className="text-[11px] font-medium">{risk.title}</p>
                <p className="text-[9px] opacity-60 mt-0.5">{risk.description}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Recommended Actions */}
      {data.actions.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Recommended Actions ({data.actions.length})
          </h4>
          <div className="space-y-1">
            {data.actions.slice(0, 6).map((act) => {
              const badge = PRIORITY_BADGE[act.priority] ?? PRIORITY_BADGE.ROUTINE;
              return (
                <div key={act.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03]">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold mt-0.5 ${badge.bg} ${badge.text}`}>
                    {act.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-zinc-300">{act.action}</p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">{act.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

export default DecisionInsightsPanel;
