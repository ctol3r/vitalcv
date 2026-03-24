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

export type SourceCoverageState =
  | 'live'
  | 'gated'
  | 'partial'
  | 'stale'
  | 'notDecisionGrade'
  | 'notChecked'
  | 'unavailable'
  | 'accessRequired'
  | 'reviewRequired'
  | 'mock';

const TRUST_STATUS_META: Record<TrustUiStatus, { label: string; badgeClassName: string }> = {
  verified: {
    label: 'Verified',
    badgeClassName: 'border-white/12 bg-white/6 text-white/70',
  },
  clear: {
    label: 'Clear',
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
    label: 'Unavailable',
    badgeClassName: 'border-white/8 bg-white/4 text-white/35',
  },
  access_required: {
    label: 'Access required',
    badgeClassName: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  },
  review_required: {
    label: 'Review required',
    badgeClassName: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
  },
  demo: {
    label: 'Demo',
    badgeClassName: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  },
};

export function getTrustStatusLabel(status: TrustUiStatus): string {
  return TRUST_STATUS_META[status].label;
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
