import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';
import {
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
    label: 'Source-backed',
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  clear: {
    label: 'Source-backed',
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  checked: {
    label: 'Checked',
    badgeClassName: 'border-white/12 bg-white/6 text-white/65',
  },
  pending: {
    label: 'Pending',
    badgeClassName: 'border-white/8 bg-white/4 text-white/45',
  },
  stale: {
    label: 'Stale',
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  unavailable: {
    label: 'Missing data',
    badgeClassName: 'border-white/8 bg-white/4 text-white/35',
  },
  access_required: {
    label: 'Access required',
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  review_required: {
    label: 'Needs review',
    badgeClassName: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
  },
  demo: {
    label: 'Preview only',
    badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  },
};

const SAFE_DISPLAY_LABELS: Record<TrustUiStatus, readonly string[]> = {
  verified: ['Source-backed'],
  clear: ['Source-backed', 'No sanctions found'],
  checked: ['Checked', 'Source-backed'],
  pending: ['Pending', 'Needs review'],
  stale: ['Stale'],
  unavailable: ['Missing data', 'Unavailable'],
  access_required: ['Access required'],
  review_required: ['Needs review', 'Review required'],
  demo: ['Demo', 'Preview only'],
};

const VDS_TRUST_STATUS_LABELS = {
  verified: 'Source-backed',
  clear: 'Source-backed',
  enrolled: 'Enrolled',
  pending: 'Pending',
  stale: 'Stale',
  'review required': 'Needs review',
  unavailable: 'Missing data',
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

export function getTrustStatusLabel(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status].label;
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
  mapSourceCoverageStateToTrustStatus,
  resolveTrustUiStatus,
};

export function isDecisionGradePositiveStatus(status: TrustUiStatus): boolean {
  return isDecisionGradePositiveTrustStatus(status);
}

/** Maps a raw readiness level code to a human-readable label. */
export function readinessLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case 'L0': return 'Missing data';
    case 'L1': return 'Needs review';
    case 'L2': return 'Source-backed';
    case 'L3': return 'Source-backed';
    default: return level ?? 'Unknown';
  }
}

/** Maps a raw API credential status string to a canonical display label. */
export function canonicalCredStatus(raw: string): string {
  const map: Record<string, string> = {
    VERIFIED: 'Source-backed',
    verified: 'Source-backed',
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
    REVIEW_REQUIRED: 'Needs review',
    review_required: 'Needs review',
    REVOKED: 'Missing data',
    revoked: 'Missing data',
    NOT_DECISION_GRADE: 'Not decision-grade',
    not_decision_grade: 'Not decision-grade',
  };

  return map[raw] ?? raw.toLowerCase().replace(/_/g, ' ');
}
