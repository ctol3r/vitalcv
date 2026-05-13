'use client';

/**
 * ReplayIntegrityBadge.tsx
 *
 * Compact integrity indicator for replay chain verification status.
 * Full mode: "● REPLAY CONFIRMED  (RC-1, RC-2)"
 * Compact mode: "●"
 *
 * Five levels: confirmed / partial / degraded / anonymous / unverified
 */

export type ReplayIntegrityLevel =
  | 'confirmed'
  | 'partial'
  | 'degraded'
  | 'anonymous'
  | 'unverified';

export interface ReplayIntegrityBadgeProps {
  level: ReplayIntegrityLevel;
  /** Show full label or compact dot-only */
  compact?: boolean;
  /** Optional clause reference e.g. "RC-1,RC-2" */
  clauses?: string;
}

interface LevelConfig {
  dot: React.ReactNode;
  label: string;
  labelCls: string;
}

function DegradedDot() {
  return (
    <span
      className="inline-flex items-center justify-center border-2 border-dashed border-amber-400 rounded-full"
      style={{ width: 8, height: 8 }}
    />
  );
}

const LEVEL_CONFIG: Record<ReplayIntegrityLevel, LevelConfig> = {
  confirmed: {
    dot: <span className="inline-block w-2 h-2 rounded-full bg-green-500" />,
    label: 'REPLAY CONFIRMED',
    labelCls: 'text-[10px] font-mono uppercase text-green-700',
  },
  partial: {
    dot: <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />,
    label: 'REPLAY PARTIAL',
    labelCls: 'text-[10px] font-mono uppercase text-amber-700',
  },
  degraded: {
    dot: <DegradedDot />,
    label: 'REPLAY DEGRADED',
    labelCls: 'text-[10px] font-mono uppercase text-amber-800',
  },
  anonymous: {
    dot: (
      <span className="inline-block w-2 h-2 rounded-full border border-gray-300 bg-transparent" />
    ),
    label: 'ANONYMOUS',
    labelCls: 'text-[10px] font-mono uppercase text-gray-400',
  },
  unverified: {
    dot: <span className="inline-block font-mono text-[10px] text-gray-300 leading-none">?</span>,
    label: 'UNVERIFIED',
    labelCls: 'text-[10px] font-mono uppercase text-gray-400',
  },
};

export function ReplayIntegrityBadge({
  level,
  compact = false,
  clauses,
}: ReplayIntegrityBadgeProps) {
  const cfg = LEVEL_CONFIG[level];

  if (compact) {
    return (
      <span className="inline-flex items-center" title={cfg.label}>
        {cfg.dot}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {cfg.dot}
      <span className={cfg.labelCls}>{cfg.label}</span>
      {clauses && (
        <span className="font-mono text-[9px] text-gray-400">({clauses})</span>
      )}
    </span>
  );
}
