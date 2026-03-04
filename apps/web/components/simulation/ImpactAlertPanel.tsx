'use client';

/**
 * ImpactAlertPanel.tsx — Wave 59: Revocation Impact Alert Display
 *
 * Shows affected organizations, invalidated decisions, and estimated
 * financial impact from a simulated credential revocation.
 */

import { motion } from 'framer-motion';
import type { ImpactResult } from '@/app/simulation/revocation/page';

// ── Props ─────────────────────────────────────────────────────────────────

interface ImpactAlertPanelProps {
  impact: ImpactResult;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ImpactAlertPanel({ impact, className = '' }: ImpactAlertPanelProps) {
  const totalAffected = impact.affectedNodes.filter((n) => n.affected).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`p-4 space-y-4 ${className}`}
    >
      {/* Alert Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-400">⚡</span>
          <h3 className="text-sm font-bold text-red-300">Revocation Simulated</h3>
        </div>
        <p className="text-[11px] text-red-300/70">
          Credential <span className="font-mono font-bold">{impact.revokedCredentialLabel}</span> revoked
        </p>
      </motion.div>

      {/* Impact Summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="grid grid-cols-2 gap-2"
      >
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{totalAffected}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Nodes Affected</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{impact.cascadeDepth}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Cascade Depth</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-violet-400">{impact.impactedDecisions.length}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Decisions</p>
        </div>
        <div className="bg-white/[0.03] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">{formatCurrency(impact.estimatedFinancialImpact)}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">Est. Impact</p>
        </div>
      </motion.div>

      {/* Affected Organizations */}
      {impact.impactedEmployers.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Affected Organizations ({impact.impactedEmployers.length})
          </h4>
          <div className="space-y-1">
            {impact.impactedEmployers.map((name, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[11px] text-red-300 truncate">{name}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Invalidated Decisions */}
      {impact.impactedDecisions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Decisions Invalidated ({impact.impactedDecisions.length})
          </h4>
          <div className="space-y-1">
            {impact.impactedDecisions.map((dec, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
                <span className="text-amber-400 text-[10px]">◆</span>
                <span className="text-[11px] text-amber-300">{dec}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Impacted Deployments */}
      {impact.impactedDeployments.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Deployment Policies ({impact.impactedDeployments.length})
          </h4>
          <div className="space-y-1">
            {impact.impactedDeployments.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.03]">
                <span className="text-pink-400 text-[10px]">▸</span>
                <span className="text-[11px] text-zinc-400">{dep}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Financial Estimate Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="pt-2 border-t border-white/[0.04]"
      >
        <p className="text-[9px] text-zinc-700 leading-relaxed">
          Financial estimates are based on average per-employer ($15K) and per-decision ($5K) impact multipliers.
          Actual costs may vary significantly based on contract terms, insurance, and remediation timelines.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default ImpactAlertPanel;
