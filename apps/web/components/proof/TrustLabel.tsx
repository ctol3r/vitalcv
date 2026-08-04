'use client';
/**
 * TrustLabel — wave-133
 * Every label explainable, mapped to trust-contract.
 * No hover state hides the explanation — it's always accessible.
 */

import { STATUS_COLORS, STATUS_EXPLANATIONS, POSTURE_COLORS, type SourceStatus, type ReadinessPosture } from './trust-types';

// ─── Status Badge ─────────────────────────────────────────────────

export function StatusBadge({
  status,
  showExplanation = false,
}: {
  status: SourceStatus;
  showExplanation?: boolean;
}) {
  const colors = STATUS_COLORS[status];
  const label = formatStatus(status);

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest border ${colors.bg} ${colors.text} ${colors.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {label}
      </div>
      {showExplanation && (
        <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
          {STATUS_EXPLANATIONS[status]}
        </p>
      )}
    </div>
  );
}

// ─── Posture Badge ────────────────────────────────────────────────

export function PostureBadge({
  posture,
  size = 'md',
}: {
  posture: ReadinessPosture;
  size?: 'sm' | 'md' | 'lg';
}) {
  const colors = POSTURE_COLORS[posture];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }[size];

  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-widest rounded-full ${sizeClasses} ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

// ─── Metric Badge ─────────────────────────────────────────────────

export function MetricBadge({
  label,
  type,
}: {
  label: string;
  type: 'measured' | 'estimated' | 'unverified';
}) {
  const styles = {
    measured:   'bg-green-50 text-green-700 border-green-200',
    estimated:  'bg-amber-50 text-amber-700 border-amber-200',
    unverified: 'bg-gray-50 text-gray-500 border-gray-200',
  }[type];

  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${styles}`}>
      [{type}] {label}
    </span>
  );
}

// ─── Proof Tier Badge ─────────────────────────────────────────────

export function ProofTierBadge({ tier }: { tier: 'none' | 'partial' | 'decision_grade' }) {
  const map = {
    none:           { label: 'No Proof Available', className: 'bg-gray-50 text-gray-500 border-gray-200' },
    partial:        { label: 'Partial Proof Pack', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    decision_grade: { label: 'Decision-Grade Packet', className: 'bg-green-50 text-green-700 border-green-200' },
  };
  const { label, className } = map[tier];
  return (
    <span className={`inline-flex text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${className}`}>
      {label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatStatus(status: SourceStatus): string {
  return {
    verified:        'Source-confirmed',
    in_progress:     'Checking…',
    not_checked:     'Not Checked',
    stale:           'Stale',
    unavailable:     'Unavailable',
    access_required: 'Access Required',
    review_required: 'Review Required',
    not_found:       'No Active Record',
    adverse:         'Adverse Finding',
  }[status];
}
