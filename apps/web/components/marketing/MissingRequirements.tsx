'use client';

/**
 * MissingRequirements — shows gaps in a provider's readiness for a specific role.
 * Lists what credentials/verifications are missing, pending, or expired.
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowRight, Clock, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export type GapSeverity = 'blocking' | 'expiring' | 'recommended';

export interface RequirementGap {
  label: string;
  detail: string;
  severity: GapSeverity;
  /** What the provider needs to do */
  action: string;
  /** Source that would resolve it */
  source: string;
  icon?: ReactNode;
}

interface MissingRequirementsProps {
  gaps: RequirementGap[];
  className?: string;
}

const SEVERITY_CONFIG: Record<
  GapSeverity,
  { label: string; color: string; bg: string; border: string; icon: typeof XCircle }
> = {
  blocking: {
    label: 'Blocking',
    color: 'text-[var(--vt-severity-critical)]',
    bg: 'bg-[var(--vt-severity-critical)]/10',
    border: 'border-[var(--vt-severity-critical)]/30',
    icon: XCircle,
  },
  expiring: {
    label: 'Expiring',
    color: 'text-[var(--vt-severity-high)]',
    bg: 'bg-[var(--vt-severity-high)]/10',
    border: 'border-[var(--vt-severity-high)]/30',
    icon: Clock,
  },
  recommended: {
    label: 'Recommended',
    color: 'text-[var(--vt-text-muted)]',
    bg: 'bg-[var(--vt-text-muted)]/10',
    border: 'border-[var(--vt-text-muted)]/30',
    icon: AlertTriangle,
  },
};

export function MissingRequirements({
  gaps,
  className,
}: MissingRequirementsProps) {
  const blocking = gaps.filter((g) => g.severity === 'blocking');
  const expiring = gaps.filter((g) => g.severity === 'expiring');
  const recommended = gaps.filter((g) => g.severity === 'recommended');
  const sortedGaps = [...blocking, ...expiring, ...recommended];

  return (
    <div
      className={cn(
        'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-5 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--vt-severity-high)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--vt-text-primary)]">
              Missing Requirements
            </h3>
            <p className="text-[10px] text-[var(--vt-text-muted)]">
              {gaps.length} gap{gaps.length !== 1 ? 's' : ''} detected for this
              role
            </p>
          </div>
        </div>
        {/* Severity summary */}
        <div className="flex items-center gap-3">
          {blocking.length > 0 && (
            <SeverityCount severity="blocking" count={blocking.length} />
          )}
          {expiring.length > 0 && (
            <SeverityCount severity="expiring" count={expiring.length} />
          )}
          {recommended.length > 0 && (
            <SeverityCount severity="recommended" count={recommended.length} />
          )}
        </div>
      </div>

      {/* Gap list */}
      <div className="divide-y divide-[var(--vt-border)]">
        {sortedGaps.map((gap) => (
          <GapRow key={gap.label} gap={gap} />
        ))}
      </div>

      {/* Empty state */}
      {gaps.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[var(--vt-status-resolved)] font-medium">
            All requirements met
          </p>
          <p className="text-xs text-[var(--vt-text-muted)] mt-1">
            This provider meets every requirement for the role.
          </p>
        </div>
      )}
    </div>
  );
}

function GapRow({ gap }: { gap: RequirementGap }) {
  const config = SEVERITY_CONFIG[gap.severity];
  const SeverityIcon = config.icon;

  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      {/* Severity icon */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm',
          config.bg,
        )}
      >
        <SeverityIcon className={cn('h-3.5 w-3.5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--vt-text-primary)]">
            {gap.label}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm',
              config.bg,
              config.color,
              config.border,
              'border',
            )}
          >
            {config.label}
          </span>
        </div>
        <p className="text-[10px] text-[var(--vt-text-muted)] mt-0.5">
          {gap.detail}
        </p>

        {/* Action */}
        <div className="mt-2 flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3 text-[var(--vt-text-muted)]" />
          <span className="text-[10px] font-medium text-[var(--vt-text-secondary)]">
            {gap.action}
          </span>
        </div>
      </div>

      {/* Source */}
      <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--vt-text-muted)]/60 mt-0.5">
        {gap.source}
      </span>
    </div>
  );
}

function SeverityCount({
  severity,
  count,
}: {
  severity: GapSeverity;
  count: number;
}) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold tabular-nums',
        config.color,
      )}
    >
      {count}
    </span>
  );
}

/** Pre-built demo gaps for marketing pages */
export const DEMO_REQUIREMENT_GAPS: RequirementGap[] = [
  {
    label: 'DEA Registration',
    detail: 'DEA controlled substance registration not found or expired',
    severity: 'blocking',
    action: 'Verify DEA registration number via NTIS lookup',
    source: 'DEA',
  },
  {
    label: 'State License — TX',
    detail: 'Texas medical license expires in 28 days',
    severity: 'expiring',
    action: 'Initiate renewal before expiration date',
    source: 'TMB',
  },
  {
    label: 'ECFMG Certificate',
    detail: 'ECFMG certification not on file for IMG candidates',
    severity: 'recommended',
    action: 'Upload ECFMG certificate or mark as N/A for US graduates',
    source: 'ECFMG',
  },
];
