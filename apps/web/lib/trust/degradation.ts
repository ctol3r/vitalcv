/**
 * Canonical failure / degradation taxonomy.
 *
 * Source: `Failure Taxonomy.html` (VCV-DEG-001) and
 * `Degraded State Semantics.html`. Five non-confusable modes across three
 * planes; one success. The taxonomy is closed. Severity encodes plane
 * ownership, not danger.
 *
 * Five things that look like "no result" — they are not the same. The
 * system distinguishes them so a user never has to guess.
 */

export type FailureMode = 'A' | 'B' | 'C' | 'D' | 'E';

export type FailurePlane =
  | 'upstream'
  | 'policy'
  | 'verifier'
  | 'subject'
  | 'issuer';

export type Severity = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';

export type SigmaState =
  | 'sigma_ok'
  | 'sigma_defer'
  | 'sigma_halt'
  | 'sigma_restricted'
  | 'sigma_withheld';

export type FrameStyle =
  | 'dashed_paper'
  | 'solid_ink_0'
  | 'solid_ink_900_fill'
  | 'solid_ink_0_thick'
  | 'solid_ink_950_fill';

export interface FailureModeDescriptor {
  readonly mode: FailureMode;
  readonly title: string;
  readonly plane: FailurePlane;
  readonly severity: Severity;
  readonly sigmaState: SigmaState;
  readonly frame: FrameStyle;
  readonly owner: string;
  readonly cause: string;
  readonly userSees: string;
  readonly action: string;
  readonly recovers: string;
  readonly isSuccess: boolean;
}

const FAILURE_MODES: Record<FailureMode, FailureModeDescriptor> = {
  A: {
    mode: 'A',
    title: 'Source unreachable',
    plane: 'upstream',
    severity: 'S1',
    sigmaState: 'sigma_defer',
    frame: 'dashed_paper',
    owner: 'Upstream registry',
    cause:
      "The source didn't answer in time. A specific registry is slow or unresponsive. The rest of the system continues; this lane is not fresh.",
    userSees:
      'Dashed lane chip · stale checked_at · honest age label · receipt records source.X.degraded=true inline.',
    action:
      'Wait or retry. Anything older than the source’s last confirmed value is treated as not yet checked, not as adverse.',
    recovers: 'Recovers via upstream restoration.',
    isSuccess: false,
  },
  B: {
    mode: 'B',
    title: 'Anonymous restriction',
    plane: 'policy',
    severity: 'S2',
    sigmaState: 'sigma_restricted',
    frame: 'solid_ink_0',
    owner: 'VitalCV policy + holder',
    cause:
      'This lane requires sign-in. Some sources reveal protected fields only when the holder is authenticated. The check did not fail; it was not attempted under your identity.',
    userSees:
      'Lane greyed · sign-in affordance · no claim asserted; no findings denied.',
    action:
      'Sign in (or have the subject sign in). This is not an outage.',
    recovers: 'Recovers via caller authentication.',
    isSuccess: false,
  },
  C: {
    mode: 'C',
    title: 'Infrastructure outage',
    plane: 'verifier',
    severity: 'S4',
    sigmaState: 'sigma_halt',
    frame: 'solid_ink_900_fill',
    owner: 'VitalCV (paged)',
    cause:
      'A VitalCV service cannot serve this request right now. Existing signed receipts remain valid; they verify offline against did:web:vitalcv.health and do not require our servers.',
    userSees:
      'Black status banner · incident id · link to status page · current SLO impact stated.',
    action:
      'If holding a signed receipt, verify it against the public verifier; no VitalCV server needed. Otherwise wait.',
    recovers: 'Recovers via VitalCV restoration.',
    isSuccess: false,
  },
  D: {
    mode: 'D',
    title: 'No adverse findings',
    plane: 'subject',
    severity: 'S0',
    sigmaState: 'sigma_ok',
    frame: 'solid_ink_0_thick',
    owner: 'No one — the system worked.',
    cause:
      'The source answered. Zero records returned. This is an affirmative negative; it is materially different from "we could not check".',
    userSees:
      'Solid lane chip · no adverse findings · 0 records · fresh checked_at · receipt signed.',
    action: 'None. This is the affirmative state; the receipt is re-verifiable.',
    recovers: 'No recovery needed.',
    isSuccess: true,
  },
  E: {
    mode: 'E',
    title: 'Issuer unavailable',
    plane: 'issuer',
    severity: 'S3',
    sigmaState: 'sigma_withheld',
    frame: 'solid_ink_950_fill',
    owner: 'VitalCV keyholder quorum',
    cause:
      'The active signing key is unreachable, expired, or under rotation. New receipts cannot issue until the issuer continuity plane recovers. Existing signed receipts remain valid until and unless explicitly revoked via StatusList2021.',
    userSees:
      'Inverted black banner across signed surfaces · issuance paused · existing credentials unaffected unless revoked.',
    action:
      'Verifiers: continue to trust existing receipts. Operators: rotate to backup signer per runbook.',
    recovers: 'Recovers via quorum activation.',
    isSuccess: false,
  },
};

export function describeFailureMode(mode: FailureMode): FailureModeDescriptor {
  return FAILURE_MODES[mode];
}

export function allFailureModes(): readonly FailureModeDescriptor[] {
  return ['A', 'B', 'C', 'D', 'E'].map((m) => FAILURE_MODES[m as FailureMode]);
}

/**
 * Lifecycle states a single claim or surface can be in. Disjoint from
 * `FailureMode`: a `signed` claim can carry a per-source mode-A defer
 * without the whole surface degrading.
 */
export type DegradationState =
  | 'fresh'
  | 'degraded'
  | 'stale'
  | 'revoked'
  | 'interrupted'
  | 'pending_human_review'
  | 'unverifiable'
  | 'continuity_mismatch';

export interface DegradationCopy {
  readonly state: DegradationState;
  readonly headline: string;
  readonly detail: string;
  readonly alarmist: false;
}

const DEGRADATION_COPY: Record<DegradationState, DegradationCopy> = {
  fresh: {
    state: 'fresh',
    headline: 'Source-confirmed',
    detail: 'Live authority consulted within freshness budget.',
    alarmist: false,
  },
  degraded: {
    state: 'degraded',
    headline: 'Operational degradation',
    detail: 'Upstream source slow; last-known value rendered with stale-flag.',
    alarmist: false,
  },
  stale: {
    state: 'stale',
    headline: 'Stale-but-signed',
    detail: 'Last confirmed value remains signed; freshness defers.',
    alarmist: false,
  },
  revoked: {
    state: 'revoked',
    headline: 'Credential revoked',
    detail:
      'StatusList2021 bit set to 1. The issuer has revoked this credential; do not honor.',
    alarmist: false,
  },
  interrupted: {
    state: 'interrupted',
    headline: 'Trust interruption',
    detail: 'Replay chain has a recorded gap. Continuity not currently established.',
    alarmist: false,
  },
  pending_human_review: {
    state: 'pending_human_review',
    headline: 'Pending human review',
    detail: 'Routed to the human-reviewed lane; an operator signs before issuance.',
    alarmist: false,
  },
  unverifiable: {
    state: 'unverifiable',
    headline: 'Unverifiable',
    detail:
      'No source-of-record was consulted under this identity. Evidence pending.',
    alarmist: false,
  },
  continuity_mismatch: {
    state: 'continuity_mismatch',
    headline: 'Continuity mismatch',
    detail:
      'Replay head does not reconcile to the TSA anchor; chain requires re-anchor.',
    alarmist: false,
  },
};

export function describeDegradation(state: DegradationState): DegradationCopy {
  return DEGRADATION_COPY[state];
}

/**
 * Maps a degradation state to a stable visual-grammar token. Components
 * read this so a state always renders with the same border / continuity
 * treatment regardless of surface.
 */
export type DegradationVisual =
  | 'continuous'
  | 'dashed'
  | 'hard_interruption'
  | 'manual_lane'
  | 'pending_anchor';

export function visualForDegradation(
  state: DegradationState,
): DegradationVisual {
  switch (state) {
    case 'fresh':
      return 'continuous';
    case 'degraded':
    case 'stale':
    case 'unverifiable':
      return 'dashed';
    case 'revoked':
    case 'interrupted':
    case 'continuity_mismatch':
      return 'hard_interruption';
    case 'pending_human_review':
      return 'manual_lane';
  }
}
