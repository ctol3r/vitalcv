import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Clock3, Eye, Lock, Minus } from 'lucide-react';
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
      'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
    label: getVdsTrustStatusLabel('enrolled'),
  },
  'review required': {
    className:
      'border-transparent bg-[var(--vt-badge-unavailable-bg)] text-[var(--vt-badge-unavailable-text)]',
    label: getVdsTrustStatusLabel('review required'),
  },
  'access required': {
    className:
      'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
    label: getVdsTrustStatusLabel('access required'),
  },
  'not decision-grade': {
    className:
      'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
    label: getVdsTrustStatusLabel('not decision-grade'),
  },
  blocked: {
    className:
      'border-transparent bg-[var(--vt-badge-unavailable-bg)] text-[var(--vt-badge-unavailable-text)]',
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
  'access_required': 'This source requires institutional access',
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

function resolveTrustBadgeIcon(status: TrustBadgeStatus) {
  switch (status) {
    case 'verified':
    case 'clear':
    case 'checked':
    case 'enrolled':
      return Check;
    case 'pending':
    case 'stale':
      return Clock3;
    case 'access_required':
    case 'access required':
    case 'not decision-grade':
      return Lock;
    case 'demo':
    case 'preview_only':
      return Eye;
    case 'review_required':
    case 'review required':
    case 'blocked':
    case 'unavailable':
    default:
      return Minus;
  }
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
  const Icon = resolveTrustBadgeIcon(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium tracking-normal shadow-[var(--vt-shadow-pill)]',
        size === 'sm' ? 'text-[11px]' : 'text-xs',
        meta.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export { TrustStatusBadge };
