import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';
import {
  getTrustStatusLabel,
  isDecisionGradePositiveTrustStatus,
  mapSourceCoverageStateToTrustStatus,
  resolveTrustUiStatus,
  type TrustEvidenceKind,
  type TrustUiStatus,
} from '../../../../packages/trust-state';

/**
 * Shared trust/status language for public VitalCV surfaces.
 *
 * Copy guardrails:
 * - Never show VERIFIED or CLEAR without real, decision-grade evidence.
 * - Unsupported or not-yet-run sources render as pending, stale, unavailable,
 *   access required, or review required.
 * - Demo and preview payloads must render as demo.
 * - Honest partial truth beats fake certainty.
 */

export type { TrustEvidenceKind, TrustUiStatus };

export type SourceCoverageState = PassportSourceCoverageState;

const TRUST_STATUS_META: Record<TrustUiStatus, { label: string; badgeClassName: string }> = {
  verified: {
    label: getTrustStatusLabel('verified'),
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  clear: {
    label: getTrustStatusLabel('clear'),
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  checked: {
    label: getTrustStatusLabel('checked'),
    badgeClassName: 'border-white/12 bg-white/6 text-white/65',
  },
  pending: {
    label: getTrustStatusLabel('pending'),
    badgeClassName: 'border-white/8 bg-white/4 text-white/45',
  },
  stale: {
    label: getTrustStatusLabel('stale'),
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  unavailable: {
    label: getTrustStatusLabel('unavailable'),
    badgeClassName: 'border-white/8 bg-white/4 text-white/35',
  },
  access_required: {
    label: getTrustStatusLabel('access_required'),
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  review_required: {
    label: getTrustStatusLabel('review_required'),
    badgeClassName: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
  },
  demo: {
    label: getTrustStatusLabel('demo'),
    badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  },
};

const VDS_TRUST_STATUS_LABELS = {
  verified: 'Verified',
  clear: 'Clear',
  enrolled: 'Enrolled',
  pending: 'Pending',
  'review required': 'Review required',
  unavailable: 'Unavailable',
  'access required': 'Access required',
  'not decision-grade': 'Not decision-grade',
  blocked: 'Blocked',
} as const;

export type VdsTrustStatus = keyof typeof VDS_TRUST_STATUS_LABELS;

export function getVdsTrustStatusLabel(
  status: VdsTrustStatus,
): string {
  return VDS_TRUST_STATUS_LABELS[status];
}

export function getTrustStatusBadgeClassName(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status].badgeClassName;
}

export {
  getTrustStatusLabel,
  mapSourceCoverageStateToTrustStatus,
  resolveTrustUiStatus,
};

export function isDecisionGradePositiveStatus(status: TrustUiStatus): boolean {
  return isDecisionGradePositiveTrustStatus(status);
}

/** Maps a raw readiness level code to a human-readable label. */
export function readinessLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case 'L0': return 'Foundation — not ready';
    case 'L1': return 'Provisional — review required';
    case 'L2': return 'Verified — ready to proceed';
    case 'L3': return 'Trust-Native — decision grade';
    default: return level ?? 'Unknown';
  }
}

/** Maps a raw API credential status string to a canonical display label. */
export function canonicalCredStatus(raw: string): string {
  const map: Record<string, string> = {
    VERIFIED: 'Verified',
    verified: 'Verified',
    ACTIVE: 'Verified',
    active: 'Verified',
    PENDING: 'Pending',
    pending: 'Pending',
    UNVERIFIED: 'Pending',
    unverified: 'Pending',
    EXPIRED: 'Unavailable',
    expired: 'Unavailable',
  };

  return map[raw] ?? raw.toLowerCase().replace(/_/g, ' ');
}
