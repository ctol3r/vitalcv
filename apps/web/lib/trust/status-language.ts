import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';
import {
  getTrustStatusLabel as getCanonicalTrustStatusLabel,
  isDecisionGradePositiveTrustStatus,
  mapSourceCoverageStateToTrustStatus,
  resolveTrustUiStatus,
  type TrustEvidenceKind,
  type TrustUiStatus as CanonicalTrustUiStatus,
} from '@vitalcv/trust-state';

/**
 * Shared trust/status language for public VitalCV surfaces.
 *
 * Copy guardrails:
 * - Never show Verified or Clear without real, decision-grade evidence.
 * - Unsupported or not-yet-run sources render as pending, stale, unavailable,
 *   access required, or review required.
 * - Preview payloads must render as Preview.
 * - Honest partial truth beats fake certainty.
 */

export type { TrustEvidenceKind };
export type TrustUiStatus = CanonicalTrustUiStatus | 'preview_only';

export type SourceCoverageState = PassportSourceCoverageState;
/**
 * Trust status tone — drives visual rendering of trust badges.
 *
 * 'preview_only' is legacy naming for preview/non-decision-grade data.
 * It renders as "Preview" (blue badge) and is treated as blocking
 * by `isBlockingStatus`. It NEVER implies verified/checked trust.
 */
export type TrustStatusTone =
  | 'positive'
  | 'informational'
  | 'warning'
  | 'critical'
  | 'neutral'
  | 'preview_only';

const TRUST_STATUS_META: Record<TrustUiStatus, { label: string; badgeClassName: string }> = {
  verified: {
    label: 'Source-backed',
    badgeClassName: 'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
  },
  clear: {
    label: 'Checked',
    badgeClassName: 'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
  },
  checked: {
    label: 'Checked',
    badgeClassName: 'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
  },
  pending: {
    label: getTrustStatusLabel('pending'),
    badgeClassName: 'border-transparent bg-[var(--vt-badge-pending-bg)] text-[var(--vt-badge-pending-text)]',
  },
  stale: {
    label: getTrustStatusLabel('stale'),
    badgeClassName: 'border-transparent bg-[var(--vt-badge-pending-bg)] text-[var(--vt-badge-pending-text)]',
  },
  unavailable: {
    label: getTrustStatusLabel('unavailable'),
    badgeClassName: 'border-transparent bg-[var(--vt-badge-unavailable-bg)] text-[var(--vt-badge-unavailable-text)]',
  },
  access_required: {
    label: getTrustStatusLabel('access_required'),
    badgeClassName: 'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
  },
  review_required: {
    label: getTrustStatusLabel('review_required'),
    badgeClassName: 'border-transparent bg-[var(--vt-badge-unavailable-bg)] text-[var(--vt-badge-unavailable-text)]',
  },
  demo: {
    label: 'Preview',
    badgeClassName: 'border-transparent bg-[var(--vt-badge-preview-bg)] text-[var(--vt-badge-preview-text)]',
  },
  preview_only: {
    label: 'Preview',
    badgeClassName: 'border-transparent bg-[var(--vt-badge-preview-bg)] text-[var(--vt-badge-preview-text)]',
  },
};

const SAFE_DISPLAY_LABELS: Record<TrustUiStatus, readonly string[]> = {
  verified: ['Source-backed'],
  clear: ['Checked', 'No sanctions found'],
  checked: ['Checked', 'Source-backed'],
  pending: ['Pending'],
  stale: ['Stale'],
  unavailable: ['Unavailable'],
  access_required: ['Access required'],
  review_required: ['Review required'],
  demo: ['Preview', 'Preview only'],
  preview_only: ['Preview', 'Preview only'],
};

const VDS_TRUST_STATUS_LABELS = {
  checked: 'Checked',
  verified: 'Source-backed',
  clear: 'Checked',
  enrolled: 'Enrolled',
  pending: 'Pending',
  stale: 'Stale',
  review_required: 'Review required',
  unavailable: 'Unavailable',
  access_required: 'Access required',
  not_decision_grade: 'Not decision-grade',
  blocked: 'Blocked',
} as const;

export type VdsTrustStatus = keyof typeof VDS_TRUST_STATUS_LABELS;

export function getVdsTrustStatusLabel(
  status: VdsTrustStatus,
): string {
  return VDS_TRUST_STATUS_LABELS[status];
}

export function getTrustStatusLabel(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status]?.label ?? getCanonicalTrustStatusLabel(status);
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
    case 'preview_only':
      return 'preview_only';
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
    || status === 'preview_only'
  );
}

export function isInspectableStatus(status: TrustUiStatus): boolean {
  return (
    status === 'verified'
    || status === 'clear'
    || status === 'checked'
    || status === 'stale'
    || status === 'review_required'
    || status === 'preview_only'
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
  return status !== 'preview_only' && isDecisionGradePositiveTrustStatus(status);
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
    VERIFIED: 'Source-backed',
    verified: 'Source-backed',
    CLEAR: 'Checked',
    clear: 'Checked',
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
