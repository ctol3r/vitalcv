import type {
  FreshnessPolicy,
  IssuerResponseStatus,
  PSVReceipt,
  PSVReceiptAuditEventState,
  PSVReceiptAuditMetadata,
  PSVReceiptLimitation,
  PSVReceiptPromotionFailureReason,
  PSVReceiptPromotionInput,
  PSVReceiptPromotionResult,
  PSVReceiptScope,
  PSVReceiptCandidate,
  PolicyReviewActor,
  PolicyReviewDecision,
} from './types';

/**
 * ISSUER-4 — PSV Receipt Promotion helper.
 *
 * Truth contract:
 *   - A PSVReceipt is **scoped evidence**, not global credential
 *     truth. Even when promotion succeeds, the receipt's scope,
 *     limitations, and freshness window remain controlling.
 *   - Only an accepted policy review (decision.status ===
 *     'accepted_as_psv_candidate') may promote.
 *   - rejected, request_more_info, request_release, reroute,
 *     mark_conflict_review, cancel, and pending decisions cannot
 *     promote.
 *   - wrong_office and unable_to_verify response statuses cannot
 *     promote — defense-in-depth against any upstream gate failure.
 *   - legally_only candidates promote only with at least one
 *     limitation entry.
 *   - Source basis and attributed responder are required and copied
 *     verbatim. The contracted-agent / source distinction is never
 *     collapsed.
 *   - PSVReceipt.proofTier is the literal `'psv_receipt'`.
 *     decisionGrade is the literal `true` for the source check
 *     itself; globalCredentialTruth is the literal `false` so no
 *     caller can interpret a receipt as a free pass to credential
 *     the clinician for everything.
 *   - Audit metadata defaults to eventState='pending_not_written'.
 *     This module does NOT write a real audit-event row.
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * audit-event writes, no real I/O.
 */

const ACCEPT_DECISION_STATUS = 'accepted_as_psv_candidate' as const;
const ACCEPT_DECISION_ACTION = 'accept_candidate' as const;

const FAILURE_MESSAGES: Record<PSVReceiptPromotionFailureReason, string> = {
  not_a_psv_receipt_candidate:
    'Promotion input is not a PSVReceiptCandidate produced by an accepted policy review.',
  policy_review_not_accepted:
    'Promotion requires policyReviewDecision.status === "accepted_as_psv_candidate".',
  wrong_office_cannot_promote:
    'A wrong_office response cannot promote to a PSV receipt; the request must be rerouted.',
  unable_to_verify_cannot_promote:
    'An unable_to_verify response is not a confirmation; it cannot promote to a PSV receipt.',
  rejected_cannot_promote:
    'A rejected policy review decision does not promote a candidate.',
  request_more_info_cannot_promote:
    'A request_more_info decision does not verify and cannot promote.',
  reroute_cannot_promote:
    'A reroute decision does not promote a candidate; the request must be sent elsewhere.',
  release_required_cannot_promote:
    'A request_release decision pauses the candidate; promotion is blocked until the release returns.',
  conflict_review_unresolved:
    'A conflict_review_required decision blocks promotion until conflict review is complete.',
  legally_only_requires_limitation:
    'A legally_only origin response requires at least one explicit limitation before promotion.',
  missing_source_basis:
    'Promotion requires the candidate to carry a source basis.',
  missing_attributed_responder:
    'Promotion requires the candidate to carry an attributed responder.',
};

/**
 * Pure predicate. Returns the failure reason that would block
 * promotion, or `undefined` when promotion may proceed.
 */
export function getPsvReceiptPromotionFailureReason(
  candidate: PSVReceiptCandidate,
  decision: PolicyReviewDecision,
  originResponseStatus?: IssuerResponseStatus,
  limitations?: readonly PSVReceiptLimitation[],
): PSVReceiptPromotionFailureReason | undefined {
  if (
    candidate.proofTier !== 'psv_receipt_candidate' ||
    candidate.decisionGrade !== false
  ) {
    return 'not_a_psv_receipt_candidate';
  }

  // Decision must be the accept path.
  if (decision.action !== ACCEPT_DECISION_ACTION) {
    if (decision.status === 'rejected') return 'rejected_cannot_promote';
    if (decision.status === 'request_more_info')
      return 'request_more_info_cannot_promote';
    if (decision.status === 'reroute_required') return 'reroute_cannot_promote';
    if (decision.status === 'requires_release')
      return 'release_required_cannot_promote';
    if (decision.status === 'conflict_review_required')
      return 'conflict_review_unresolved';
    return 'policy_review_not_accepted';
  }
  if (decision.status !== ACCEPT_DECISION_STATUS) {
    return 'policy_review_not_accepted';
  }
  if (!decision.createdPsvReceiptCandidate) {
    return 'policy_review_not_accepted';
  }

  // Defense-in-depth: response-status-level refusal regardless of decision.
  if (originResponseStatus === 'wrong_office') {
    return 'wrong_office_cannot_promote';
  }
  if (originResponseStatus === 'unable_to_verify') {
    return 'unable_to_verify_cannot_promote';
  }

  // Source basis and attributed responder are required.
  if (!candidate.sourceBasis) return 'missing_source_basis';
  if (!candidate.attributedResponder) return 'missing_attributed_responder';

  // legally_only candidates need an explicit limitation.
  const legallyOnlyOrigin = originResponseStatus === 'legally_only';
  const hasLimitationFromCandidate = !!candidate.limitationNote;
  const hasLimitationFromInput = (limitations ?? []).length > 0;
  if (legallyOnlyOrigin && !hasLimitationFromCandidate && !hasLimitationFromInput) {
    return 'legally_only_requires_limitation';
  }

  return undefined;
}

/**
 * Pure predicate convenience: true iff promotion would succeed.
 */
export function canPromoteToPsvReceipt(
  candidate: PSVReceiptCandidate,
  decision: PolicyReviewDecision,
  originResponseStatus?: IssuerResponseStatus,
  limitations?: readonly PSVReceiptLimitation[],
): boolean {
  return (
    getPsvReceiptPromotionFailureReason(
      candidate,
      decision,
      originResponseStatus,
      limitations,
    ) === undefined
  );
}

interface ReceiptArtifactOptions {
  psvReceiptId: string;
  candidate: PSVReceiptCandidate;
  scope: PSVReceiptScope;
  limitations: PSVReceiptLimitation[];
  freshness: FreshnessPolicy;
  promotedAt: string;
  promotedBy: PolicyReviewActor;
  notes?: string;
}

/**
 * Build the PSVReceipt artifact. Internal helper — callers should go
 * through `promotePsvReceiptCandidate` so the gates run.
 */
export function buildPsvReceiptArtifact(
  options: ReceiptArtifactOptions,
): PSVReceipt {
  const { candidate } = options;
  if (!candidate.sourceBasis) {
    throw new Error(
      'buildPsvReceiptArtifact requires candidate.sourceBasis',
    );
  }
  if (!candidate.attributedResponder) {
    throw new Error(
      'buildPsvReceiptArtifact requires candidate.attributedResponder',
    );
  }

  const auditMetadata: PSVReceiptAuditMetadata = {
    recordedAt: options.promotedAt,
    recordedBy: 'review_surface',
    eventState: 'pending_not_written',
    notes:
      'Demo audit metadata; the promotion surface does not write a real audit-event row.',
  };

  return {
    psvReceiptId: options.psvReceiptId,
    psvCandidateId: candidate.psvCandidateId,
    receiptCandidateId: candidate.receiptCandidateId,
    requestId: candidate.requestId,
    claimId: candidate.claimId,
    claimType: candidate.claimType,
    promotedAt: options.promotedAt,
    promotedBy: options.promotedBy,
    sourceBasis: candidate.sourceBasis,
    attributedResponder: candidate.attributedResponder,
    scope: options.scope,
    limitations: options.limitations,
    freshness: options.freshness,
    proofTier: 'psv_receipt',
    decisionGrade: true,
    globalCredentialTruth: false,
    auditMetadata,
    notes:
      options.notes ??
      'PSV receipt. Scoped evidence subject to limitations and freshness; not global credential truth.',
  };
}

/**
 * Derive default limitations from the candidate when the caller did
 * not pass any explicitly. legally_only and contracted-agent
 * responses always emit at least one entry.
 */
function deriveDefaultLimitations(
  candidate: PSVReceiptCandidate,
  originResponseStatus: IssuerResponseStatus | undefined,
): PSVReceiptLimitation[] {
  const out: PSVReceiptLimitation[] = [];
  if (originResponseStatus === 'legally_only' || candidate.limitationNote) {
    out.push({
      kind: 'legally_only',
      description:
        candidate.limitationNote ??
        'Issuer confirmed dates / identity only; receipt does not cover clinical scope.',
    });
  }
  if (originResponseStatus === 'partially_confirmed') {
    out.push({
      kind: 'partial_confirmation',
      description:
        'Issuer confirmed only part of the claim; remaining detail is not covered by this receipt.',
    });
  }
  if (candidate.sourceBasis?.isContractedAgent) {
    out.push({
      kind: 'contracted_agent',
      description:
        'Response was provided by a contracted agent acting for the named source; agent and source identity remain distinct.',
    });
  }
  return out;
}

/**
 * Compute a freshness policy from issuance time + ttl days.
 */
function freshnessFor(promotedAt: string, ttlDays: number): FreshnessPolicy {
  const issued = new Date(promotedAt);
  if (Number.isNaN(issued.valueOf())) {
    throw new Error(
      `freshnessFor: invalid promotedAt timestamp: ${promotedAt}`,
    );
  }
  const stale = new Date(issued.valueOf());
  stale.setUTCDate(stale.getUTCDate() + ttlDays);
  return {
    ttlDays,
    issuedAt: promotedAt,
    staleAfter: stale.toISOString(),
  };
}

/**
 * Promote a PSVReceiptCandidate to a PSVReceipt. Always returns a
 * result with an explicit `promoted` flag and the preserved
 * candidate. On refusal, returns the failure reason; the candidate
 * is never mutated.
 */
export function promotePsvReceiptCandidate(
  input: PSVReceiptPromotionInput,
): PSVReceiptPromotionResult {
  const failure = getPsvReceiptPromotionFailureReason(
    input.psvReceiptCandidate,
    input.policyReviewDecision,
    input.originResponseStatus,
    input.limitations,
  );

  if (failure) {
    return {
      promoted: false,
      failureReason: failure,
      message: FAILURE_MESSAGES[failure],
      preservedCandidate: input.psvReceiptCandidate,
    };
  }

  const limitations =
    input.limitations && input.limitations.length > 0
      ? [...input.limitations]
      : deriveDefaultLimitations(
          input.psvReceiptCandidate,
          input.originResponseStatus,
        );

  const freshness = freshnessFor(input.promotedAt, input.ttlDays);

  const psvReceipt = buildPsvReceiptArtifact({
    psvReceiptId: input.psvReceiptId,
    candidate: input.psvReceiptCandidate,
    scope: input.scope,
    limitations,
    freshness,
    promotedAt: input.promotedAt,
    promotedBy: input.promotedBy,
    notes: input.notes,
  });

  return {
    promoted: true,
    psvReceipt,
    message:
      'PSV receipt promoted under accepted policy review. Scope, limitations, and freshness remain controlling.',
    preservedCandidate: input.psvReceiptCandidate,
  };
}

/**
 * Convenience: read the audit event state stamped on a promoted
 * receipt. Always 'pending_not_written' on the demo surface; tests
 * use this to assert the truth contract.
 */
export function readPsvReceiptAuditEventState(
  receipt: PSVReceipt,
): PSVReceiptAuditEventState {
  return receipt.auditMetadata.eventState;
}
