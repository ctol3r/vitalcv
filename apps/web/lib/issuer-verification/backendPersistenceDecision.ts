import type {
  IssuerAuditPersistenceAdapterKind,
  IssuerPersistenceAdapterDecision,
} from './auditPersistenceAdapter';

/**
 * ISSUER-9 — Backend persistence decision boundary.
 *
 * This module evaluates whether the existing backend repository
 * (apps/api/backend/repositories/psvReceipts.repo.ts) can safely
 * persist issuer audit events / PSV receipt artifacts produced by
 * the ISSUER-1..8 chain, and emits a structured decision.
 *
 * Truth contract:
 *   - Default decision is `defer_until_contract_aligned`. Backend
 *     repository compatibility is NOT persistence — even if the repo
 *     accepts a row, that does not by itself constitute a persisted
 *     audit record under VitalCV's truth contract.
 *   - Real persistence requires (a) contract alignment, (b) a
 *     server-only writer with no client-bundle crossing, and (c) the
 *     writer to confirm each row.
 *   - This module is a pure transform — no fetches, no DB writes,
 *     no dynamic-import of backend modules, no real I/O.
 *   - The decision NEVER returns `implement_now` unless every
 *     required `BackendPersistenceCapabilityCheck` is satisfied.
 *   - A decision artifact is action-history metadata about the
 *     adapter wiring; it never changes any claim's `proofTier`,
 *     `decisionGrade`, or `globalCredentialTruth`.
 */

export type BackendPersistenceDecisionStatus =
  | 'implement_now'
  | 'defer_until_contract_aligned'
  | 'unavailable'
  | 'unsafe'
  | 'needs_backend_adapter';

/**
 * The discrete reasons backend persistence is blocked. A decision
 * may carry multiple blockers; each maps to a concrete next-step.
 */
export type BackendPersistenceBlocker =
  | 'contract_shape_mismatch'
  | 'missing_limitations'
  | 'missing_source_basis'
  | 'missing_responder_attribution'
  | 'missing_freshness_scope'
  | 'no_writer_confirmation'
  | 'client_server_boundary_violation'
  | 'untested_repository'
  | 'migration_required';

/**
 * One capability the backend repository must offer before persistence
 * can be safely turned on. Each capability is checked independently.
 */
export interface BackendPersistenceCapabilityCheck {
  capability:
    | 'stores_scoped_psv_receipt'
    | 'preserves_limitation_notes'
    | 'preserves_source_basis'
    | 'preserves_responder_attribution'
    | 'preserves_freshness_and_scope'
    | 'distinguishes_candidate_vs_receipt'
    | 'supports_audit_event_persistence'
    | 'exposes_server_only_writer'
    | 'has_test_coverage';
  satisfied: boolean;
  notes: string;
  /** When `satisfied: false`, the blocker the gap maps to. */
  mappedBlocker?: BackendPersistenceBlocker;
}

/**
 * Plain-language recommendation surfaced verbatim by the review
 * page. Always neutral — never claims persistence is on.
 */
export interface BackendPersistenceRecommendation {
  /** Plain-language summary, e.g., "Defer until contract alignment". */
  summary: string;
  /** Ordered list of next safe steps. */
  nextSteps: ReadonlyArray<string>;
}

export interface BackendPersistenceDecision {
  status: BackendPersistenceDecisionStatus;
  /**
   * The persistence adapter kind this decision implies for the
   * audit boundary. Always `noop`/`demo`/`repository_candidate`/
   * `unavailable` until status === 'implement_now'.
   */
  impliedAdapterKind: IssuerAuditPersistenceAdapterKind;
  capabilityChecks: ReadonlyArray<BackendPersistenceCapabilityCheck>;
  blockers: ReadonlyArray<BackendPersistenceBlocker>;
  recommendation: BackendPersistenceRecommendation;
  decidedAt: string;
  /** Caller-controlled note: why this decision was emitted. */
  reason: string;
}

/**
 * Result of `evaluateBackendPersistenceReadiness` — the decision
 * itself plus the structured input used to compute it. Useful for
 * tests asserting the decision is deterministic over a config.
 */
export interface BackendPersistenceReadinessResult {
  decision: BackendPersistenceDecision;
  /** True iff every capability check is satisfied. */
  allCapabilitiesSatisfied: boolean;
}

/**
 * Caller-supplied evidence describing what the backend repo
 * actually supports. The decision is computed entirely from this
 * input — there are no environment lookups, no implicit feature
 * flags, no I/O.
 *
 * Default: every capability is `satisfied: false`, modeling the
 * baseline VitalCV state where the legacy backend repo predates
 * the ISSUER-1..8 contract and has not been aligned.
 */
export interface BackendPersistenceReadinessInput {
  decidedAt: string;
  /**
   * Per-capability satisfaction flags. Any capability not listed is
   * treated as `false` — defaults are deliberately strict.
   */
  capabilities?: Partial<
    Record<BackendPersistenceCapabilityCheck['capability'], boolean>
  >;
  /**
   * Optional per-capability override notes (used by tests and the
   * review surface). When omitted, a default note is supplied per
   * capability.
   */
  notes?: Partial<
    Record<BackendPersistenceCapabilityCheck['capability'], string>
  >;
  /**
   * When set, drives the impliedAdapterKind explicitly (caller has
   * already chosen an adapter). Otherwise the decision derives the
   * kind from the capability flags.
   */
  impliedAdapterKind?: IssuerAuditPersistenceAdapterKind;
  /**
   * Caller-supplied reason for emitting the decision, surfaced
   * verbatim by the review page. Defaults to a stock string.
   */
  reason?: string;
}

const CAPABILITY_TO_BLOCKER: Record<
  BackendPersistenceCapabilityCheck['capability'],
  BackendPersistenceBlocker
> = {
  stores_scoped_psv_receipt: 'contract_shape_mismatch',
  preserves_limitation_notes: 'missing_limitations',
  preserves_source_basis: 'missing_source_basis',
  preserves_responder_attribution: 'missing_responder_attribution',
  preserves_freshness_and_scope: 'missing_freshness_scope',
  distinguishes_candidate_vs_receipt: 'contract_shape_mismatch',
  supports_audit_event_persistence: 'no_writer_confirmation',
  exposes_server_only_writer: 'client_server_boundary_violation',
  has_test_coverage: 'untested_repository',
};

const CAPABILITY_DEFAULT_NOTES: Record<
  BackendPersistenceCapabilityCheck['capability'],
  string
> = {
  stores_scoped_psv_receipt:
    'Backend repository (apps/api/backend/repositories/psvReceipts.repo.ts) stores the legacy PsvReceiptSnapshot shape, which is not the scoped PSVReceipt shape produced by ISSUER-4.',
  preserves_limitation_notes:
    'Backend row has no `limitations` array; ISSUER-4 PSVReceipt requires one.',
  preserves_source_basis:
    'Backend row has `source_authority` (a string enum) but no contracted-agent vs source distinction; ISSUER-2/3 require both.',
  preserves_responder_attribution:
    'Backend row has `attestor_id` but no AttributedResponder shape (name / role / attributedAt / attributionMethod).',
  preserves_freshness_and_scope:
    'Backend row has `ttl_seconds` but no scope object (covers / doesNotCover / sourceOrganizationName).',
  distinguishes_candidate_vs_receipt:
    'Backend repository stores PSV-receipt rows only; it does not distinguish PSVReceiptCandidate from a promoted PSVReceipt or carry the policy-review provenance.',
  supports_audit_event_persistence:
    'Backend repository does not model IssuerAuditEventRecord; there is no audit-event table or writer.',
  exposes_server_only_writer:
    'Importing the backend repository into apps/web would pull server-only Prisma into the client bundle. A client-safe RPC boundary or server action is required.',
  has_test_coverage:
    'No automated tests cover the backend repository in PR-time CI; persistence behavior is not verified.',
};

const RECOMMENDATION_BY_STATUS: Record<
  BackendPersistenceDecisionStatus,
  BackendPersistenceRecommendation
> = {
  implement_now: {
    summary:
      'All capability checks are satisfied. A server-only writer may be wired in this slice. Persistence still requires writer confirmation per row.',
    nextSteps: [
      'Wire a server-only writer that confirms each row.',
      'Toggle the persistence adapter kind to repository_enabled.',
      'Verify writer confirmation under tests before exposing to operators.',
    ],
  },
  defer_until_contract_aligned: {
    summary:
      'Backend repository compatibility is not persistence. Defer until contract alignment is complete.',
    nextSteps: [
      'Align backend repository shape with ISSUER-2..5 PSVReceipt and ISSUER-7 audit-event types.',
      'Add limitation, source basis, responder attribution, scope, and candidate-vs-receipt distinction to the persistence schema.',
      'Add a server-only writer that confirms each row before reporting persisted status.',
      'Add tests proving every truth-contract field round-trips.',
      'Re-evaluate the decision once each capability check flips to satisfied.',
    ],
  },
  unavailable: {
    summary:
      'No backend persistence adapter is wired in this environment. Persistence is unavailable.',
    nextSteps: [
      'Decide whether to add a server-only writer or to keep persistence as a deferred decision.',
    ],
  },
  unsafe: {
    summary:
      'A backend persistence path was attempted but is unsafe under the truth contract. Persistence remains off.',
    nextSteps: [
      'Read the blocker list and address each one.',
      'Do not turn on persistence until every blocker is resolved.',
    ],
  },
  needs_backend_adapter: {
    summary:
      'A backend adapter implementation is required before persistence may be enabled.',
    nextSteps: [
      'Implement a server-only adapter that maps issuer artifacts to a contract-aligned schema.',
      'Add tests for the adapter; confirm zero client-bundle imports.',
      'Re-run readiness evaluation once the adapter exists.',
    ],
  },
};

function buildCapabilityCheck(
  capability: BackendPersistenceCapabilityCheck['capability'],
  satisfied: boolean,
  note: string | undefined,
): BackendPersistenceCapabilityCheck {
  return {
    capability,
    satisfied,
    notes: note ?? CAPABILITY_DEFAULT_NOTES[capability],
    mappedBlocker: satisfied ? undefined : CAPABILITY_TO_BLOCKER[capability],
  };
}

const ALL_CAPABILITIES: ReadonlyArray<BackendPersistenceCapabilityCheck['capability']> = [
  'stores_scoped_psv_receipt',
  'preserves_limitation_notes',
  'preserves_source_basis',
  'preserves_responder_attribution',
  'preserves_freshness_and_scope',
  'distinguishes_candidate_vs_receipt',
  'supports_audit_event_persistence',
  'exposes_server_only_writer',
  'has_test_coverage',
];

function decideStatus(
  allSatisfied: boolean,
  blockers: ReadonlyArray<BackendPersistenceBlocker>,
  satisfiedCount: number,
  totalCount: number,
): BackendPersistenceDecisionStatus {
  if (allSatisfied) return 'implement_now';

  // Escalation thresholds: the `unsafe` and `needs_backend_adapter`
  // statuses describe an operator who has CLEARLY tried to enable
  // persistence (most gates satisfied) but is blocked by a specific
  // capability. With most gates still missing, the broad default is
  // `defer_until_contract_aligned`.
  const onlyOneMissing = satisfiedCount === totalCount - 1;
  if (onlyOneMissing && blockers.includes('client_server_boundary_violation')) {
    return 'unsafe';
  }
  if (onlyOneMissing && blockers.includes('no_writer_confirmation')) {
    return 'needs_backend_adapter';
  }
  return 'defer_until_contract_aligned';
}

function impliedAdapterKindFor(
  status: BackendPersistenceDecisionStatus,
): IssuerAuditPersistenceAdapterKind {
  switch (status) {
    case 'implement_now':
      return 'repository_enabled';
    case 'defer_until_contract_aligned':
      return 'repository_candidate';
    case 'needs_backend_adapter':
      return 'repository_candidate';
    case 'unsafe':
      return 'unavailable';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'noop';
  }
}

/**
 * Pure: evaluate readiness from caller-supplied evidence. Default
 * (every capability missing) returns `defer_until_contract_aligned`.
 */
export function evaluateBackendPersistenceReadiness(
  input: BackendPersistenceReadinessInput,
): BackendPersistenceReadinessResult {
  const checks = ALL_CAPABILITIES.map((cap) =>
    buildCapabilityCheck(
      cap,
      input.capabilities?.[cap] === true,
      input.notes?.[cap],
    ),
  );
  const allSatisfied = checks.every((c) => c.satisfied);
  const blockers = checks
    .filter((c) => !c.satisfied && c.mappedBlocker)
    .map((c) => c.mappedBlocker as BackendPersistenceBlocker);
  const dedupedBlockers = Array.from(new Set(blockers));
  const satisfiedCount = checks.filter((c) => c.satisfied).length;
  const status = decideStatus(
    allSatisfied,
    dedupedBlockers,
    satisfiedCount,
    checks.length,
  );
  const impliedAdapterKind =
    input.impliedAdapterKind ?? impliedAdapterKindFor(status);
  const recommendation = RECOMMENDATION_BY_STATUS[status];
  const reason =
    input.reason ??
    (allSatisfied
      ? 'All backend persistence capability checks pass.'
      : 'Backend persistence is deferred pending contract alignment.');

  return {
    decision: {
      status,
      impliedAdapterKind,
      capabilityChecks: checks,
      blockers: dedupedBlockers,
      recommendation,
      decidedAt: input.decidedAt,
      reason,
    },
    allCapabilitiesSatisfied: allSatisfied,
  };
}

/**
 * Pure: convenience builder for the canonical defer decision used
 * by the review surface and the no-op adapter path.
 */
export function buildBackendPersistenceDeferDecision(input: {
  decidedAt: string;
  reason?: string;
}): BackendPersistenceDecision {
  return evaluateBackendPersistenceReadiness({
    decidedAt: input.decidedAt,
    reason: input.reason,
  }).decision;
}

/**
 * Plain-language explanation surfaced verbatim by the review surface.
 */
export function explainBackendPersistenceDecision(
  decision: BackendPersistenceDecision,
): string {
  const blockerSummary =
    decision.blockers.length === 0
      ? '(no blockers)'
      : decision.blockers.join(', ');
  return (
    `Status: ${decision.status}. Implied adapter kind: ${decision.impliedAdapterKind}. ` +
    `Blockers: ${blockerSummary}. ${decision.recommendation.summary}`
  );
}

/**
 * Pure: defensive guard. Throws unless the decision says
 * `implement_now`. Use at the point where a real persistence call
 * would be made — so a buggy caller cannot bypass the gate.
 */
export function assertBackendPersistenceSafe(
  decision: BackendPersistenceDecision,
): void {
  if (decision.status !== 'implement_now') {
    throw new Error(
      `assertBackendPersistenceSafe refused: backend persistence decision is ${decision.status}; only implement_now permits real writes.`,
    );
  }
}

/**
 * Pure: surface the implied adapter decision metadata for the
 * persistence-adapter boundary. Can be plugged into
 * IssuerAuditWriteResult.adapterDecision so callers can show which
 * decision drove the adapter wiring.
 */
export function asAdapterDecisionMetadata(
  decision: BackendPersistenceDecision,
): Pick<IssuerPersistenceAdapterDecision, 'kind' | 'reason' | 'wiringDescription'> {
  return {
    kind: decision.impliedAdapterKind,
    reason: explainBackendPersistenceDecision(decision),
    wiringDescription:
      decision.status === 'implement_now'
        ? 'Backend persistence enabled — server-only writer wired and confirmed by tests.'
        : 'Backend persistence deferred — see backendPersistenceDecision blockers.',
  };
}
