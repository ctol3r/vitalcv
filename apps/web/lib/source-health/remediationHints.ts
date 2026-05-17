import type {
  CanonicalSourceCoverageState,
  SourceHealthOperatorStatus,
} from '@vitalcv/trust-state';

/**
 * remediationHints — operator-action language for non-decision-grade
 * source lanes.
 *
 * The hint surface is intentionally operator-focused, not buyer-facing.
 * Every hint instructs the operator on the next step that closes the
 * gap; it never blames the clinician for a gated source, never implies
 * a gated/unknown lane is decision-grade, and never uses banned
 * truth-contract phrases.
 *
 * Two axes:
 *   - `operatorStatus`: HEALTHY / DEGRADED / STALE / CRITICAL — coarse
 *     transport / probe health (from @vitalcv/trust-state SourceHealthEntry).
 *   - `coverageState`: the canonical CanonicalSourceCoverageState —
 *     `gated`, `accessRequired`, `reviewRequired`, `unavailable`, etc.
 *
 * Precedence (highest first):
 *   1. `coverageState === 'gated'`     — institutional access gate
 *   2. `coverageState === 'unavailable'` OR `operatorStatus === 'CRITICAL'`
 *      — source not reachable; lane is not decision-grade
 *   3. `coverageState === 'accessRequired'`
 *      — credential/contract is the next operator step
 *   4. `coverageState === 'reviewRequired'`
 *      — manual review queue is the next operator step
 *   5. `operatorStatus === 'DEGRADED'` — repeated failures, probe still working
 *   6. `operatorStatus === 'STALE'`    — last success too old
 *   7. `coverageState === 'pending'` / `'notDecisionGrade'` / `'previewOnly'`
 *      — informational guidance only
 *
 * HEALTHY + `coverageState === 'checked'` returns `null` (no hint).
 */

export type RemediationHintTone = 'critical' | 'warn' | 'info';

export interface RemediationHint {
  /** Visual tone for the panel — never used to claim trust. */
  tone: RemediationHintTone;
  /** Operator-action copy. */
  copy: string;
  /**
   * Diagnostic identifier so tests and logs can pin the matched rule.
   * Not user-visible.
   */
  rule:
    | 'gated'
    | 'unavailable'
    | 'critical'
    | 'access_required'
    | 'review_required'
    | 'degraded'
    | 'stale'
    | 'pending'
    | 'not_decision_grade'
    | 'preview_only';
}

export interface RemediationHintInput {
  sourceId?: string | null;
  operatorStatus?: SourceHealthOperatorStatus | null;
  coverageState?: CanonicalSourceCoverageState | null;
}

const HINT_GATED: RemediationHint = {
  tone: 'warn',
  rule: 'gated',
  copy:
    'Institutional access required. Confirm source agreement or mark lane as access-required before review.',
};

const HINT_UNAVAILABLE: RemediationHint = {
  tone: 'critical',
  rule: 'unavailable',
  copy:
    'Source unavailable. Do not treat this lane as decision-grade until a fresh check succeeds.',
};

const HINT_CRITICAL: RemediationHint = {
  tone: 'critical',
  rule: 'critical',
  copy:
    'Source probe failing. Check connector config, env flags, and network access; do not rely on this lane until a fresh check succeeds.',
};

const HINT_ACCESS_REQUIRED: RemediationHint = {
  tone: 'warn',
  rule: 'access_required',
  copy:
    'Operator credentials required to query this source. Provision access or route the candidate to manual review.',
};

const HINT_REVIEW_REQUIRED: RemediationHint = {
  tone: 'warn',
  rule: 'review_required',
  copy:
    'Lane signal is ambiguous. Route to operator review before treating it as decision-grade.',
};

const HINT_DEGRADED: RemediationHint = {
  tone: 'warn',
  rule: 'degraded',
  copy:
    'Repeated probe failures observed. Confirm API credentials and connector health; if the failure persists, route to operator review.',
};

const HINT_STALE: RemediationHint = {
  tone: 'warn',
  rule: 'stale',
  copy:
    'Refresh source probe. If stale state persists, route to operator review before relying on this lane.',
};

const HINT_PENDING: RemediationHint = {
  tone: 'info',
  rule: 'pending',
  copy:
    'First probe has not completed. Wait for the next scheduled run or trigger a manual refresh.',
};

const HINT_NOT_DECISION_GRADE: RemediationHint = {
  tone: 'info',
  rule: 'not_decision_grade',
  copy:
    'Lane is informational only. Do not treat as decision-grade evidence.',
};

const HINT_PREVIEW_ONLY: RemediationHint = {
  tone: 'info',
  rule: 'preview_only',
  copy:
    'Preview / demo data only. Not derived from a live source probe.',
};

/**
 * Resolve the operator remediation hint for a source lane, or `null`
 * when the lane is healthy and decision-grade (no hint to show).
 *
 * The function never mutates input and never reads global state, which
 * makes it trivial to test and safe to call from server or client.
 */
export function getRemediationHint(
  input: RemediationHintInput,
): RemediationHint | null {
  const coverage = input.coverageState ?? null;
  const operator = input.operatorStatus ?? null;

  // Highest-precedence rules first — institutional access and outright
  // unavailability are always the next operator step regardless of
  // transport health.
  if (coverage === 'gated') return HINT_GATED;
  if (coverage === 'unavailable') return HINT_UNAVAILABLE;
  if (operator === 'CRITICAL') return HINT_CRITICAL;

  if (coverage === 'accessRequired') return HINT_ACCESS_REQUIRED;
  if (coverage === 'reviewRequired') return HINT_REVIEW_REQUIRED;

  if (operator === 'DEGRADED') return HINT_DEGRADED;
  if (operator === 'STALE' || coverage === 'stale') return HINT_STALE;

  if (coverage === 'pending') return HINT_PENDING;
  if (coverage === 'notDecisionGrade') return HINT_NOT_DECISION_GRADE;
  if (coverage === 'previewOnly') return HINT_PREVIEW_ONLY;

  // HEALTHY + checked, or any combination that does not match a rule
  // above, has no hint.
  return null;
}

/**
 * Convenience: returns `true` iff the lane needs an operator hint.
 * Useful for panels that gate render on hint presence.
 */
export function needsRemediationHint(input: RemediationHintInput): boolean {
  return getRemediationHint(input) !== null;
}
