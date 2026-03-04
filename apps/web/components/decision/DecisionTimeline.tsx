'use client';

/**
 * DecisionTimeline.tsx — Wave 57: Decision Capsule Timeline
 *
 * Visual sequence showing: verification → decision → deployment
 * with connecting lines and animated state indicators.
 */

import { motion } from 'framer-motion';
import { CapsuleStatusBadge } from './DecisionCapsule';
import type { DecisionCapsuleData } from './DecisionCapsule';

// ── Types ─────────────────────────────────────────────────────────────────

interface DecisionTimelineProps {
  capsules: DecisionCapsuleData[];
  className?: string;
  maxItems?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, { icon: string; label: string }> = {
  HIRING: { icon: '◎', label: 'Hiring Decision' },
  PRIVILEGING: { icon: '◆', label: 'Privileging' },
  DEPLOYMENT: { icon: '▸', label: 'Deployment' },
  RENEWAL: { icon: '↻', label: 'Renewal' },
};

const STATUS_LINE_COLORS: Record<string, string> = {
  VALID: 'bg-emerald-500/40',
  AT_RISK: 'bg-amber-500/40',
  INVALID: 'bg-red-500/40',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  VALID: 'bg-emerald-400 shadow-emerald-400/30',
  AT_RISK: 'bg-amber-400 shadow-amber-400/30',
  INVALID: 'bg-red-400 shadow-red-400/30',
};

// ── Component ─────────────────────────────────────────────────────────────

export function DecisionTimeline({
  capsules,
  className = '',
  maxItems = 10,
}: DecisionTimelineProps) {
  const sorted = [...capsules]
    .sort((a, b) => new Date(a.decisionTimestamp).getTime() - new Date(b.decisionTimestamp).getTime())
    .slice(0, maxItems);

  if (sorted.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-xs text-zinc-600">No decision capsules recorded</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {sorted.map((capsule, i) => {
        const phase = PHASE_ICONS[capsule.decisionType] ?? { icon: '●', label: capsule.decisionType };
        const date = new Date(capsule.decisionTimestamp);
        const lineColor = STATUS_LINE_COLORS[capsule.status] ?? 'bg-zinc-700';
        const dotColor = STATUS_DOT_COLORS[capsule.status] ?? 'bg-zinc-500';
        const isLast = i === sorted.length - 1;

        return (
          <motion.div
            key={capsule.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex gap-3"
          >
            {/* Timeline spine */}
            <div className="flex flex-col items-center w-6 flex-shrink-0">
              <div className={`w-3 h-3 rounded-full ${dotColor} shadow-sm z-10`} />
              {!isLast && (
                <motion.div
                  className={`w-0.5 flex-1 ${lineColor}`}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.08 + 0.1 }}
                  style={{ transformOrigin: 'top' }}
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs opacity-40">{phase.icon}</span>
                    <p className="text-xs font-semibold text-zinc-200">{phase.label}</p>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                  </p>
                </div>
                <CapsuleStatusBadge status={capsule.status} />
              </div>

              {/* Credential count + hash */}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] text-zinc-500">
                  {capsule.credentialIds.length} credential{capsule.credentialIds.length !== 1 ? 's' : ''}
                </span>
                <span className="text-[9px] font-mono text-zinc-700">
                  {capsule.artifactHash.slice(0, 16)}…
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default DecisionTimeline;
