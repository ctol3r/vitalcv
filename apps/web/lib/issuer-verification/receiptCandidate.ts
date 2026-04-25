import type {
  AttributedResponder,
  IssuerResponse,
  IssuerResponseStatus,
  IssuerVerificationRequest,
  ReceiptCandidate,
  ReceiptCandidateReviewState,
  SourceBasis,
} from './types';

/**
 * ISSUER-2 — Issuer Response Intake + Receipt-Candidate Builder.
 *
 * Truth contract:
 *   - A receipt candidate is not final PSV.
 *   - confirmed responses map to ready_for_policy_review (NOT verified).
 *   - corrected responses produce a conflict_review_required state.
 *   - legally_only / partially_confirmed remain review_required.
 *   - requires_release pauses; wrong_office reroutes; unable_to_verify
 *     does not confirm.
 *   - Source basis (and any contracted-agent layer) is preserved
 *     verbatim; the agent and source are never collapsed.
 *   - decisionGrade : false and proofTier : 'receipt_candidate' are
 *     literal-typed so no caller can upgrade a candidate without a
 *     type error.
 *
 * This module is a pure transform — no fetches, no audit-event
 * writes, no model calls.
 */

/** Map an issuer-response status to the review state of its candidate. */
const REVIEW_STATE_BY_RESPONSE: Record<
  IssuerResponseStatus,
  ReceiptCandidateReviewState
> = {
  confirmed: 'ready_for_policy_review',
  partially_confirmed: 'review_required',
  corrected: 'conflict_review_required',
  legally_only: 'review_required',
  requires_release: 'release_required',
  wrong_office: 'reroute_required',
  unable_to_verify: 'unable_to_verify',
};

export function getIssuerResponseReviewState(
  status: IssuerResponseStatus,
): ReceiptCandidateReviewState {
  return REVIEW_STATE_BY_RESPONSE[status];
}

interface NormalizedReview {
  reviewState: ReceiptCandidateReviewState;
  sourceBasis: SourceBasis;
  attributedResponder: AttributedResponder;
}

/**
 * Pure normalization: derive the review state, source basis, and
 * responder attribution for a (request, response) pair. The agent /
 * source distinction is materialized here so downstream surfaces
 * cannot accidentally collapse them.
 */
export function normalizeIssuerResponseForReview(
  request: IssuerVerificationRequest,
  response: IssuerResponse,
): NormalizedReview {
  const issuer = request.issuerCandidate;
  const isAgent = !!issuer.isContractedAgent;

  const sourceBasis: SourceBasis = isAgent
    ? {
        sourceOrganizationName:
          issuer.agentActsFor ?? '(source unattributed)',
        isContractedAgent: true,
        agentName: issuer.organizationName,
        agentActsFor: issuer.agentActsFor,
        basisNote:
          'Response provided by a contracted agent acting for the named source. Agent and source are recorded separately.',
      }
    : {
        sourceOrganizationName: issuer.organizationName,
        isContractedAgent: false,
        basisNote: 'Response provided directly by the source of record.',
      };

  const attributedResponder: AttributedResponder = {
    name: response.responderName ?? '(unattributed)',
    role: response.responderRole,
    attributedAt: response.respondedAt,
    attributionMethod: response.responderName ? 'self_attested' : 'unknown',
  };

  return {
    reviewState: getIssuerResponseReviewState(response.status),
    sourceBasis,
    attributedResponder,
  };
}

const LIMITATION_NOTE_BY_STATUS: Record<IssuerResponseStatus, string> = {
  confirmed:
    'Issuer confirmed the claim. This is a receipt candidate; policy review is required before treating it as proof.',
  partially_confirmed:
    'Issuer confirmed only part of the claim; remaining detail must be reviewed and confirmed separately.',
  corrected:
    'Issuer returned corrected details; the corrected version must be reviewed before proof can be derived.',
  legally_only:
    'Issuer confirmed dates / identity only; committee review may be required before relying on this response.',
  requires_release:
    'Issuer requires an additional release before responding; this candidate is paused for release.',
  wrong_office:
    'Issuer indicated the request must be routed to another office; this candidate is non-confirmatory.',
  unable_to_verify:
    'Issuer could not verify this claim from their records; this is not a confirmation.',
};

interface BuilderOptions {
  receiptCandidateId: string;
  claimId: string;
  auditChannel?:
    | 'issuer_response_form'
    | 'partner_response'
    | 'manual_entry';
  recordedBy?: 'demo' | 'review_surface' | 'system';
}

/**
 * Build a ReceiptCandidate from a (request, response) pair. Always
 * returns a candidate — never a verified claim. Always sets
 * decisionGrade=false and proofTier='receipt_candidate'.
 */
export function buildReceiptCandidateFromIssuerResponse(
  request: IssuerVerificationRequest,
  response: IssuerResponse,
  options: BuilderOptions,
): ReceiptCandidate {
  const { reviewState, sourceBasis, attributedResponder } =
    normalizeIssuerResponseForReview(request, response);

  const limitationNote = LIMITATION_NOTE_BY_STATUS[response.status];

  return {
    // ISSUER-1 baseline
    candidateId: options.receiptCandidateId,
    createdAt: response.respondedAt,
    basis: sourceBasis.isContractedAgent ? 'contracted_agent' : 'issuer_direct',
    agentName: sourceBasis.agentName,
    sourceOrganizationName: sourceBasis.sourceOrganizationName,
    attributionStatus: 'attributed_pending_review',
    decisionGrade: false,
    notes:
      'Receipt candidate produced from an issuer response. Policy review is required before this can be treated as proof.',

    // ISSUER-2 review-surface fields
    receiptCandidateId: options.receiptCandidateId,
    requestId: request.requestId,
    claimId: options.claimId,
    claimType: request.claimType,
    issuerCandidate: request.issuerCandidate,
    responseStatus: response.status,
    responseSummary: response.freeText,
    attributedResponder,
    responseReceivedAt: response.respondedAt,
    sourceBasis,
    contractedAgent: sourceBasis.isContractedAgent
      ? {
          name: sourceBasis.agentName ?? '(unattributed agent)',
          actsFor: sourceBasis.agentActsFor ?? sourceBasis.sourceOrganizationName,
        }
      : undefined,
    limitationNote,
    reviewState,
    proofTier: 'receipt_candidate',
    auditMetadata: {
      recordedAt: response.respondedAt,
      recordedBy: options.recordedBy ?? 'review_surface',
      inboundChannel: options.auditChannel ?? 'issuer_response_form',
      notes:
        'Demo audit metadata; the review surface does not write a real audit-event row.',
    },
  };
}
