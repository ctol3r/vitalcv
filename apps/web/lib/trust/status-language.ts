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
export type TrustStatusTone =
  | 'positive'
  | 'informational'
  | 'warning'
  | 'critical'
  | 'neutral'
  | 'demo';

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

const SAFE_DISPLAY_LABELS: Record<TrustUiStatus, readonly string[]> = {
  verified: ['Verified'],
  clear: ['Clear', 'No sanctions found'],
  checked: ['Checked'],
  pending: ['Pending'],
  stale: ['Stale'],
  unavailable: ['Unavailable'],
  access_required: ['Access required'],
  review_required: ['Review required'],
  demo: ['Demo', 'Preview only'],
};

const VDS_TRUST_STATUS_LABELS = {
  verified: 'Verified',
  clear: 'Clear',
  enrolled: 'Enrolled',
  pending: 'Pending',
  stale: 'Stale',
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

function normalizeDisplayLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getStatusTone(status: TrustUiStatus): TrustStatusTone {
  switch (status) {
    case 'verified':
    case 'clear':
      return 'positive';
    case 'checked':
      return 'informational';
    case 'stale':
    case 'access_required':
      return 'warning';
    case 'review_required':
      return 'critical';
    case 'demo':
      return 'demo';
    case 'pending':
    case 'unavailable':
    default:
      return 'neutral';
  }
}

export function isPositiveStatus(status: TrustUiStatus): boolean {
  return status === 'verified' || status === 'clear' || status === 'checked';
}

export function isBlockingStatus(status: TrustUiStatus): boolean {
  return (
    status === 'pending'
    || status === 'stale'
    || status === 'unavailable'
    || status === 'access_required'
    || status === 'review_required'
  );
}

export function isInspectableStatus(status: TrustUiStatus): boolean {
  return (
    status === 'verified'
    || status === 'clear'
    || status === 'checked'
    || status === 'stale'
    || status === 'review_required'
    || status === 'demo'
  );
}

export function getStatusDisplayLabel(
  status: TrustUiStatus,
  preferredLabel?: string | null,
): string {
  if (!preferredLabel) {
    return TRUST_STATUS_META[status].label;
  }

  const normalizedPreferred = normalizeDisplayLabel(preferredLabel);
  const safeLabel = SAFE_DISPLAY_LABELS[status].find((label) => (
    normalizeDisplayLabel(label) === normalizedPreferred
  ));

  return safeLabel ?? TRUST_STATUS_META[status].label;
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
    case 'L2': return 'Source-backed — ready to proceed';
    case 'L3': return 'Trust-Native — decision grade';
    default: return level ?? 'Unknown';
  }
}

/** Maps a raw API credential status string to a canonical display label. */
export function canonicalCredStatus(raw: string): string {
  const map: Record<string, string> = {
    VERIFIED: 'Verified',
    verified: 'Verified',
    ACTIVE: 'Active',
    active: 'Active',
    PENDING: 'Pending',
    pending: 'Pending',
    UNVERIFIED: 'Pending',
    unverified: 'Pending',
    EXPIRED: 'Unavailable',
    expired: 'Unavailable',
    STALE: 'Stale',
    stale: 'Stale',
    GATED: 'Access required',
    gated: 'Access required',
    REVIEW_REQUIRED: 'Review required',
    review_required: 'Review required',
    REVOKED: 'Unavailable',
    revoked: 'Unavailable',
    NOT_DECISION_GRADE: 'Not decision-grade',
    not_decision_grade: 'Not decision-grade',
  };

  return map[raw] ?? raw.toLowerCase().replace(/_/g, ' ');
}
