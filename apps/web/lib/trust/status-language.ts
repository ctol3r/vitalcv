import type { PassportSourceCoverageState } from '@/lib/trust/source-coverage';

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

export type TrustUiStatus =
  | 'verified'
  | 'clear'
  | 'checked'
  | 'pending'
  | 'stale'
  | 'unavailable'
  | 'access_required'
  | 'review_required'
  | 'demo';

export type TrustEvidenceKind = 'verification' | 'clearance' | 'generic';

export type SourceCoverageState = PassportSourceCoverageState;

const SHARED_TRUST_STATUS_LABELS = {
  verified: 'Verified',
  clear: 'Clear',
  checked: 'Checked',
  pending: 'Pending',
  stale: 'Stale',
  unavailable: 'Unavailable',
  access_required: 'Access required',
  review_required: 'Review required',
  demo: 'Demo',
  enrolled: 'Enrolled',
  blocked: 'Blocked',
  not_decision_grade: 'Not decision-grade',
} as const;

type SharedTrustStatusLabelKey = keyof typeof SHARED_TRUST_STATUS_LABELS;

const TRUST_STATUS_META: Record<TrustUiStatus, { label: string; badgeClassName: string }> = {
  verified: {
    label: SHARED_TRUST_STATUS_LABELS.verified,
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  clear: {
    label: SHARED_TRUST_STATUS_LABELS.clear,
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  checked: {
    label: SHARED_TRUST_STATUS_LABELS.checked,
    badgeClassName: 'border-white/12 bg-white/6 text-white/65',
  },
  pending: {
    label: SHARED_TRUST_STATUS_LABELS.pending,
    badgeClassName: 'border-white/8 bg-white/4 text-white/45',
  },
  stale: {
    label: SHARED_TRUST_STATUS_LABELS.stale,
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  unavailable: {
    label: SHARED_TRUST_STATUS_LABELS.unavailable,
    badgeClassName: 'border-white/8 bg-white/4 text-white/35',
  },
  access_required: {
    label: SHARED_TRUST_STATUS_LABELS.access_required,
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  review_required: {
    label: SHARED_TRUST_STATUS_LABELS.review_required,
    badgeClassName: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
  },
  demo: {
    label: SHARED_TRUST_STATUS_LABELS.demo,
    badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  },
};

const VDS_TRUST_STATUS_LABELS: Record<
  | 'verified'
  | 'clear'
  | 'enrolled'
  | 'pending'
  | 'review required'
  | 'unavailable'
  | 'access required'
  | 'not decision-grade'
  | 'blocked',
  SharedTrustStatusLabelKey
> = {
  verified: 'verified',
  clear: 'clear',
  enrolled: 'enrolled',
  pending: 'pending',
  'review required': 'review_required',
  unavailable: 'unavailable',
  'access required': 'access_required',
  'not decision-grade': 'not_decision_grade',
  blocked: 'blocked',
};

function sharedTrustStatusLabel(status: SharedTrustStatusLabelKey): string {
  return SHARED_TRUST_STATUS_LABELS[status];
}

export function getTrustStatusLabel(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status].label;
}

export function getVdsTrustStatusLabel(
  status: keyof typeof VDS_TRUST_STATUS_LABELS,
): string {
  return sharedTrustStatusLabel(VDS_TRUST_STATUS_LABELS[status]);
}

export function getTrustStatusBadgeClassName(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status].badgeClassName;
}

export function mapSourceCoverageStateToTrustStatus(
  state: SourceCoverageState,
  options: {
    kind?: TrustEvidenceKind;
    satisfied?: boolean;
  } = {},
): TrustUiStatus {
  const { kind = 'generic', satisfied = false } = options;

  switch (state) {
    case 'mock':
      return 'demo';
    case 'stale':
      return 'stale';
    case 'unavailable':
      return 'unavailable';
    case 'gated':
    case 'accessRequired':
      return 'access_required';
    case 'reviewRequired':
      return 'review_required';
    case 'live':
      if (!satisfied) {
        return kind === 'generic' ? 'checked' : 'pending';
      }

      if (kind === 'clearance') {
        return 'clear';
      }

      return kind === 'generic' ? 'checked' : 'verified';
    case 'partial':
    case 'notDecisionGrade':
    case 'notChecked':
    default:
      return 'pending';
  }
}

export function resolveTrustUiStatus(input: {
  demo?: boolean;
  state?: SourceCoverageState | null;
  kind?: TrustEvidenceKind;
  satisfied?: boolean;
}): TrustUiStatus {
  if (input.demo) {
    return 'demo';
  }

  return mapSourceCoverageStateToTrustStatus(
    input.state ?? 'notChecked',
    {
      kind: input.kind,
      satisfied: input.satisfied,
    },
  );
}

export function isDecisionGradePositiveStatus(status: TrustUiStatus): boolean {
  return status === 'verified' || status === 'clear';
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
