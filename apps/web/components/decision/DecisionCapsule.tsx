'use client';

/**
 * DecisionCapsule.tsx — Wave 57: Decision Capsule Panel
 *
 * Displays a single decision capsule with its type, timestamp,
 * credential inputs, issuer sources, status badge, and hash snippet.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

export interface DecisionCapsuleData {
  id: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: string;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  status: 'VALID' | 'AT_RISK' | 'INVALID';
}

interface DecisionCapsuleProps {
  capsule: DecisionCapsuleData;
  index?: number;
  compact?: boolean;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  VALID: {
    label: 'Valid',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  AT_RISK: {
    label: 'At Risk',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  INVALID: {
    label: 'Invalid',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-400',
  },
};

const TYPE_ICONS: Record<string, string> = {
  HIRING: '◎',
  PRIVILEGING: '◆',
  DEPLOYMENT: '▸',
  RENEWAL: '↻',
};

// ── Status Badge ──────────────────────────────────────────────────────────

export function CapsuleStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.INVALID;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span className={cfg.color}>{cfg.label}</span>
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function DecisionCapsule({
  capsule,
  index = 0,
  compact = false,
  className = '',
}: DecisionCapsuleProps) {
  const cfg = STATUS_CONFIG[capsule.status] ?? STATUS_CONFIG.INVALID;
  const icon = TYPE_ICONS[capsule.decisionType] ?? '●';
  const date = new Date(capsule.decisionTimestamp);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: index * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors ${className}`}
      >
        <span className="text-sm opacity-50">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-300">{capsule.decisionType}</p>
          <p className="text-[9px] text-zinc-600">{date.toLocaleDateString()}</p>
        </div>
        <CapsuleStatusBadge status={capsule.status} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
      className={`rounded-xl border p-4 ${cfg.bg} ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg opacity-40">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-zinc-200">{capsule.decisionType}</p>
            <p className="text-[10px] text-zinc-500">
              {date.toLocaleDateString()} at {date.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <CapsuleStatusBadge status={capsule.status} />
      </div>

      {/* Credential Inputs */}
      <div className="mb-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
          Credential Inputs ({capsule.credentialIds.length})
        </p>
        <div className="flex flex-wrap gap-1">
          {capsule.credentialIds.slice(0, 4).map((id) => (
            <span
              key={id}
              className="text-[9px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded"
            >
              {id.slice(0, 8)}…
            </span>
          ))}
          {capsule.credentialIds.length > 4 && (
            <span className="text-[9px] text-zinc-600">
              +{capsule.credentialIds.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Issuer Sources */}
      {capsule.issuerIds.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
            Issuer Sources ({capsule.issuerIds.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {capsule.issuerIds.slice(0, 3).map((id) => (
              <span
                key={id}
                className="text-[9px] font-mono text-zinc-400 bg-white/[0.04] px-1.5 py-0.5 rounded"
              >
                {id.slice(0, 8)}…
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hash & Methodology */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <span className="text-[9px] font-mono text-zinc-600 truncate max-w-[60%]">
          {capsule.artifactHash.slice(0, 24)}…
        </span>
        <span className="text-[9px] text-zinc-600">{capsule.methodology}</span>
      </div>
    </motion.div>
  );
}

export default DecisionCapsule;
