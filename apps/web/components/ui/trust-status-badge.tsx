import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getTrustStatusLabel,
  getVdsTrustStatusLabel,
  type TrustUiStatus,
  type VdsTrustStatus,
} from '@/lib/trust/status-language';

void React;

export type TrustBadgeStatus = TrustUiStatus | VdsTrustStatus;

const TRUST_STATUS_META: Record<TrustBadgeStatus, { className: string; label: string }> = {
  verified: {
    className:
      'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
    label: getVdsTrustStatusLabel('verified'),
  },
  clear: {
    className:
      'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
    label: getVdsTrustStatusLabel('clear'),
  },
  enrolled: {
    className:
      'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
    label: getVdsTrustStatusLabel('enrolled'),
  },
  checked: {
    className: 'border-white/12 bg-white/6 text-white/72',
    label: getTrustStatusLabel('checked'),
  },
  pending: {
    className:
      'border-[var(--vt-badge-info-border)] bg-[var(--vt-badge-info-bg)] text-[var(--vt-badge-info-text)]',
    label: getVdsTrustStatusLabel('pending'),
  },
  stale: {
    className:
      'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
    label: getVdsTrustStatusLabel('stale'),
  },
  unavailable: {
    className:
      'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
    label: getVdsTrustStatusLabel('unavailable'),
  },
  access_required: {
    className:
      'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
    label: getTrustStatusLabel('access_required'),
  },
  review_required: {
    className:
      'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
    label: getTrustStatusLabel('review_required'),
  },
  demo: {
    className:
      'border-[var(--vt-badge-info-border)] bg-[var(--vt-badge-info-bg)] text-[var(--vt-badge-info-text)]',
    label: getTrustStatusLabel('demo'),
  },
  'review required': {
    className:
      'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
    label: getVdsTrustStatusLabel('review required'),
  },
  'access required': {
    className:
      'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
    label: getVdsTrustStatusLabel('access required'),
  },
  'not decision-grade': {
    className:
      'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
    label: getVdsTrustStatusLabel('not decision-grade'),
  },
  blocked: {
    className:
      'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
    label: getVdsTrustStatusLabel('blocked'),
  },
};

interface TrustStatusBadgeProps {
  status: TrustBadgeStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function TrustStatusBadge({
  status,
  label,
  size = 'md',
  className,
}: TrustStatusBadgeProps) {
  const meta = TRUST_STATUS_META[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.16em] shadow-none',
        size === 'sm' ? 'text-[10px]' : 'text-[11px]',
        meta.className,
        className,
      )}
    >
      {label ?? meta.label}
    </Badge>
  );
}

export { TrustStatusBadge };
