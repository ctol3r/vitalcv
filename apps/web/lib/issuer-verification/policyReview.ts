import type {
  PolicyReviewAction,
  PolicyReviewActor,
  PolicyReviewAuditMetadata,
  PolicyReviewDecision,
  PolicyReviewDecisionStatus,
  PolicyReviewOutcome,
  PSVReceiptCandidate,
  ReceiptCandidate,
} from './types';

/**
 * ISSUER-3 — Policy Review Decision helper.
 *
 * Truth contract:
 *   - Only `accept_candidate` may produce a PSVReceiptCandidate.
 *   - `accept_candidate` is gated on the candidate being in
 *     `ready_for_policy_review`. Other review states (review_required,
 *     conflict_review_required, release_required, reroute_required,
 *     unable_to_verify, expired, canceled) cannot produce a candidate.
 *   - Defense in depth: if a candidate's underlying response was
 *     `legally_only`, a limitation note is required even if the gate
 *     above is somehow bypassed.
 *   - Defense in depth: `wrong_office` and `unable_to_verify`
 *     responses are explicitly rejected by the builder regardless of
 *     review state.
 *   - request_more_info, reroute, request_release, mark_conflict_review,
 *     cancel, and reject_candidate NEVER produce a candidate.
 *   - A PSVReceiptCandidate carries `decisionGrade: false` literal and
 *     `proofTier: 'psv_receipt_candidate'` literal. It is not a global
 *     PSV receipt and cannot be upgraded to one without a separate
 *     promotion wave (ISSUER-4).
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * audit-event writes, no real I/O.
 */

const ACTION_TO_STATUS: Record<PolicyReviewAction, PolicyReviewDecisionStatus> = {
  accept_candidate: 'accepted_as_psv_candidate',
  reject_candidate: 'rejected',
  request_more_info: 'request_more_info',
  request_release: 'requires_release',
  reroute: 'reroute_required',
  mark_conflict_review: 'conflict_review_required',
  cancel: 'canceled',
};

/**
 * Map an action to its decision status. The underlying review of
 * the candidate is unchanged — only the decision status changes.
 */
export function policyReviewStatusForAction(
  action: PolicyReviewAction,
): PolicyReviewDecisionStatus {
  return ACTION_TO_STATUS[action];
}

/**
 * Pure predicate: can the given (candidate, action) pair produce a
 * PSVReceiptCandidate? Returns the gate that blocked when refused so
 * the caller can attach it to the decision outcome.
 */
export function canCreatePsvReceiptCandidate(
  candidate: ReceiptCandidate,
  action: PolicyReviewAction,
): PolicyReviewOutcome {
  if (action !== 'accept_candidate') {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'Only the accept_candidate action can create a PSVReceiptCandidate.',
      refusalGate: 'action_does_not_create_candidate',
    };
  }

  if (candidate.responseStatus === 'wrong_office') {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'A wrong_office response cannot create a PSVReceiptCandidate; the request must be rerouted.',
      refusalGate: 'wrong_office_cannot_create_candidate',
    };
  }

  if (candidate.responseStatus === 'unable_to_verify') {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'An unable_to_verify response is not a confirmation and cannot create a PSVReceiptCandidate.',
      refusalGate: 'unable_to_verify_cannot_create_candidate',
    };
  }

  if (candidate.reviewState === 'conflict_review_required') {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'Conflict review is required before this candidate can be accepted.',
      refusalGate: 'conflict_review_unresolved',
    };
  }

  if (candidate.reviewState !== 'ready_for_policy_review') {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'Candidate must be ready_for_policy_review before it can be accepted as a PSV receipt candidate.',
      refusalGate: 'review_state_not_ready',
    };
  }

  if (
    candidate.responseStatus === 'legally_only' &&
    !candidate.limitationNote
  ) {
    return {
      createdPsvReceiptCandidate: false,
      reason:
        'A legally_only response requires a limitation note before a PSVReceiptCandidate may be created.',
      refusalGate: 'legally_only_requires_limitation_note',
    };
  }

  return {
    createdPsvReceiptCandidate: true,
    reason: 'Candidate accepted under policy review.',
  };
}

interface PsvCandidateBuilderOptions {
  psvCandidateId: string;
  acceptedAt: string;
  acceptedBy: PolicyReviewActor;
  notes?: string;
}

/**
 * Build a PSVReceiptCandidate. Throws if the gates would refuse —
 * callers MUST consult canCreatePsvReceiptCandidate first. The throw
 * is defense-in-depth so a bug in caller wiring cannot silently
 * produce a candidate the gate would have blocked.
 */
export function buildPsvReceiptCandidate(
  candidate: ReceiptCandidate,
  options: PsvCandidateBuilderOptions,
): PSVReceiptCandidate {
  const outcome = canCreatePsvReceiptCandidate(candidate, 'accept_candidate');
  if (!outcome.createdPsvReceiptCandidate) {
    throw new Error(
      `buildPsvReceiptCandidate refused: ${outcome.refusalGate ?? 'unknown'} — ${outcome.reason}`,
    );
  }
  if (!candidate.sourceBasis || !candidate.attributedResponder) {
    throw new Error(
      'buildPsvReceiptCandidate requires an ISSUER-2 candidate with sourceBasis and attributedResponder.',
    );
  }

  return {
    psvCandidateId: options.psvCandidateId,
    receiptCandidateId:
      candidate.receiptCandidateId ?? candidate.candidateId,
    requestId: candidate.requestId ?? '(unknown-request)',
    claimId: candidate.claimId ?? '(unknown-claim)',
    claimType: candidate.claimType ?? 'unknown',
    acceptedAt: options.acceptedAt,
    acceptedBy: options.acceptedBy,
    sourceBasis: candidate.sourceBasis,
    attributedResponder: candidate.attributedResponder,
    limitationNote: candidate.limitationNote,
    decisionGrade: false,
    proofTier: 'psv_receipt_candidate',
    notes:
      options.notes ??
      'PSV receipt candidate. Not a global PSV receipt. Reuse and promotion are gated by a separate review.',
  };
}

interface DecisionBuilderOptions {
  decisionId: string;
  decidedAt: string;
  actor: PolicyReviewActor;
  rationale?: string;
  recordedBy?: PolicyReviewAuditMetadata['recordedBy'];
  /** Only honored when action is accept_candidate AND gates pass. */
  psvCandidateId?: string;
}

/**
 * Build the decision metadata for a (candidate, action) pair. Always
 * returns a decision — the outcome's `createdPsvReceiptCandidate`
 * flag tells callers whether a PSVReceiptCandidate was produced.
 */
export function buildPolicyReviewDecision(
  candidate: ReceiptCandidate,
  action: PolicyReviewAction,
  options: DecisionBuilderOptions,
): PolicyReviewDecision {
  const outcome = canCreatePsvReceiptCandidate(candidate, action);
  const status = policyReviewStatusForAction(action);

  return {
    decisionId: options.decisionId,
    receiptCandidateId:
      candidate.receiptCandidateId ?? candidate.candidateId,
    requestId: candidate.requestId ?? '(unknown-request)',
    action,
    status,
    decidedAt: options.decidedAt,
    actor: options.actor,
    rationale: options.rationale,
    createdPsvReceiptCandidate: outcome.createdPsvReceiptCandidate,
    outcome,
    auditMetadata: {
      recordedAt: options.decidedAt,
      recordedBy: options.recordedBy ?? 'review_surface',
      notes:
        'Demo audit metadata; the policy review surface does not write a real audit-event row.',
    },
  };
}

export interface AppliedPolicyReview {
  decision: PolicyReviewDecision;
  psvReceiptCandidate?: PSVReceiptCandidate;
  /**
   * The original ReceiptCandidate is returned unchanged. Reject and
   * other refusals do not delete or mutate the underlying evidence.
   */
  preservedCandidate: ReceiptCandidate;
}

/**
 * Apply a policy review action to a candidate. Returns the decision
 * metadata, the resulting PSVReceiptCandidate (only when
 * accept_candidate passes all gates), and the unchanged underlying
 * ReceiptCandidate so callers can confirm evidence preservation.
 */
export function applyPolicyReviewDecision(
  candidate: ReceiptCandidate,
  action: PolicyReviewAction,
  options: DecisionBuilderOptions,
): AppliedPolicyReview {
  const decision = buildPolicyReviewDecision(candidate, action, options);

  if (
    decision.createdPsvReceiptCandidate &&
    action === 'accept_candidate' &&
    options.psvCandidateId
  ) {
    const psvReceiptCandidate = buildPsvReceiptCandidate(candidate, {
      psvCandidateId: options.psvCandidateId,
      acceptedAt: options.decidedAt,
      acceptedBy: options.actor,
    });
    return {
      decision,
      psvReceiptCandidate,
      preservedCandidate: candidate,
    };
  }

  return {
    decision,
    preservedCandidate: candidate,
  };
}
