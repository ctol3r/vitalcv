import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getStatusDisplayLabel,
  getTrustStatusBadgeClassName,
  getVdsTrustStatusLabel,
  type TrustUiStatus,
  type VdsTrustStatus,
} from '@/lib/trust/status-language';

void React;

export type TrustBadgeStatus = TrustUiStatus | VdsTrustStatus;
type SupplementalVdsTrustStatus = Exclude<VdsTrustStatus, TrustUiStatus>;

const VDS_STATUS_META: Record<SupplementalVdsTrustStatus, { className: string; label: string }> = {
  enrolled: {
    className:
      'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
    label: getVdsTrustStatusLabel('enrolled'),
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

const CANONICAL_TRUST_BADGE_STATUSES = new Set<TrustUiStatus>([
  'verified',
  'clear',
  'checked',
  'pending',
  'stale',
  'unavailable',
  'access_required',
  'review_required',
  'preview_only',
  'demo',
]);

const TRUST_STATUS_DESCRIPTORS: Record<string, string> = {
  checked: 'Confirmed in this run from the source',
  'access required': 'This source requires institutional access',
  pending: 'Not yet checked in this session',
  'preview only': 'Example data - not from a live source run',
  demo: 'Example data - not from a live source run',
};

interface TrustStatusBadgeProps {
  status: TrustBadgeStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

function normalizeDescriptorKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function resolveTrustBadgeMeta(
  status: TrustBadgeStatus,
  label?: string,
): { className: string; label: string } {
  return CANONICAL_TRUST_BADGE_STATUSES.has(status as TrustUiStatus)
    ? {
        className: getTrustStatusBadgeClassName(status as TrustUiStatus),
        label: getStatusDisplayLabel(status as TrustUiStatus, label),
      }
    : {
        className: VDS_STATUS_META[status as SupplementalVdsTrustStatus].className,
        label: label ?? VDS_STATUS_META[status as SupplementalVdsTrustStatus].label,
      };
}

export function getTrustStatusDescriptor(
  status: TrustBadgeStatus,
  label?: string,
): string | null {
  const descriptor = TRUST_STATUS_DESCRIPTORS[normalizeDescriptorKey(resolveTrustBadgeMeta(status, label).label)];

  return descriptor ?? null;
}

function TrustStatusBadge({
  status,
  label,
  size = 'md',
  className,
}: TrustStatusBadgeProps) {
  const meta = resolveTrustBadgeMeta(status, label);

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
      {meta.label}
    </Badge>
  );
}

export { TrustStatusBadge };
