/**
 * ISSUER-1 — Issuer Confirmation Hub contracts.
 *
 * Truth contract (mirrors docs/architecture/vitalcv-knowledge-trust-graph.md):
 *   - A request is not a verification.
 *   - sent / viewed_by_issuer is not a verification.
 *   - requires_release pauses the request.
 *   - legally_only maps to review_required.
 *   - wrong_office never confirms the claim.
 *   - confirmed creates a ReceiptCandidate only — never a global proof.
 *   - A contracted-agent response must preserve the distinction
 *     between the agent and the source it acts for.
 *
 * These types intentionally encode the contract at the type level
 * (e.g., ReceiptCandidate.decisionGrade is the literal `false`) so a
 * future caller cannot upgrade an issuer response to decision-grade
 * without a type error.
 */

export type VerificationClaimType =
  | 'education_degree'
  | 'medical_school'
  | 'residency'
  | 'fellowship'
  | 'background_check'
  | 'professional_license'
  | 'work_history'
  | 'board_certification'
  | 'publication_research'
  | 'unknown';

export type VerificationRequestStatus =
  | 'draft'
  | 'consent_required'
  | 'ready_to_send'
  | 'sent'
  | 'viewed_by_issuer'
  | 'requires_release'
  | 'confirmed'
  | 'partially_confirmed'
  | 'corrected'
  | 'unable_to_verify'
  | 'wrong_office'
  | 'legally_only'
  | 'expired'
  | 'canceled';

export type IssuerResponseStatus =
  | 'confirmed'
  | 'partially_confirmed'
  | 'corrected'
  | 'unable_to_verify'
  | 'requires_release'
  | 'wrong_office'
  | 'legally_only';

export type RouteKey =
  | 'clearinghouse_or_registrar'
  | 'direct_program_or_gme_office'
  | 'certified_background_check_partner'
  | 'source_adapter_or_background_partner'
  | 'employer_direct'
  | 'board_source_or_manual'
  | 'publication_index_or_manual_review'
  | 'manual_review';

/**
 * Partner categories — deliberately one level above named vendors.
 * VitalCV does not yet have live integrations; encoding categories
 * keeps the router shape stable when real partners land later.
 */
export type PartnerCategory =
  | 'student_clearinghouse_degreeverify_category'
  | 'healthcare_background_screening_category'
  | 'background_license_screening_category'
  | 'specialty_board_source_category'
  | 'state_board_source_category'
  | 'employer_direct_category'
  | 'publication_index_category'
  | 'manual_review_category';

export type PartnerAccessLevel = 'available' | 'access_required' | 'future';

export interface VerificationPartner {
  partnerId: string;
  category: PartnerCategory;
  /** Display label uses the category, not a named vendor. */
  displayLabel: string;
  accessLevel: PartnerAccessLevel;
  notes?: string;
}

export interface VerificationRoute {
  route: RouteKey;
  partnerCategory: PartnerCategory;
  rationale: string;
  accessLevel: PartnerAccessLevel;
}

export interface IssuerCandidate {
  candidateId: string;
  organizationName: string;
  contactRole?: string;
  email?: string;
  phone?: string;
  source: 'clinician_provided' | 'directory_lookup' | 'partner_directory';
  /** When the candidate is a contracted agent, agentActsFor names the source. */
  isContractedAgent?: boolean;
  agentActsFor?: string;
}

export interface ConsentArtifact {
  consentId: string;
  scope: string;
  status: 'pending' | 'granted' | 'revoked' | 'expired';
  consentedAt?: string;
  expiresAt?: string;
  releaseFormUrl?: string;
}

/**
 * Review states a ReceiptCandidate can carry once it has been
 * derived from an IssuerResponse. None of these states implies the
 * underlying claim is finalized verification — they describe what
 * policy-level review is still required.
 */
export type ReceiptCandidateReviewState =
  | 'review_required'
  | 'ready_for_policy_review'
  | 'conflict_review_required'
  | 'release_required'
  | 'reroute_required'
  | 'unable_to_verify'
  | 'expired'
  | 'canceled';

/**
 * The party VitalCV believes provided the IssuerResponse.
 * Attribution is recorded explicitly so a reviewer can see *who*
 * spoke for the source, separate from the source itself.
 */
export interface AttributedResponder {
  name: string;
  role?: string;
  contact?: string;
  attributedAt: string;
  attributionMethod:
    | 'self_attested'
    | 'directory_match'
    | 'partner_assertion'
    | 'unknown';
}

/**
 * Records the source of record the response speaks for, plus any
 * contracted-agent layer between VitalCV and that source. This shape
 * is the load-bearing piece of the contracted-agent rule: the agent
 * and the source are never collapsed into one identity.
 */
export interface SourceBasis {
  /** The authoritative source of record the response speaks for. */
  sourceOrganizationName: string;
  isContractedAgent: boolean;
  /** Required when isContractedAgent is true. */
  agentName?: string;
  /** Required when isContractedAgent is true — the source the agent acts for. */
  agentActsFor?: string;
  basisNote?: string;
}

/**
 * Audit metadata kept alongside the candidate so a reviewer can
 * trace where the response came from. This is metadata only — it is
 * not an audit event and does not write to any system store.
 */
export interface ReceiptCandidateAuditMetadata {
  recordedAt: string;
  recordedBy: 'demo' | 'review_surface' | 'system';
  inboundChannel:
    | 'issuer_response_form'
    | 'partner_response'
    | 'manual_entry';
  notes?: string;
}

export interface ReceiptCandidate {
  // ---- ISSUER-1 baseline fields ----
  candidateId: string;
  createdAt: string;
  basis: 'issuer_direct' | 'contracted_agent';
  /** Required when basis is 'contracted_agent'. */
  agentName?: string;
  /** The source the response speaks for (after agent normalization). */
  sourceOrganizationName: string;
  attributionStatus: 'unattributed' | 'attributed_pending_review' | 'attributed_reviewed';
  /** Literal false — type-level guarantee that the candidate is not decision-grade. */
  decisionGrade: false;
  notes?: string;

  // ---- ISSUER-2 review-surface extensions (optional for back-compat) ----
  /** Canonical id used by the review surface; the builder sets it equal to candidateId. */
  receiptCandidateId?: string;
  requestId?: string;
  claimId?: string;
  claimType?: VerificationClaimType;
  issuerCandidate?: IssuerCandidate;
  responseStatus?: IssuerResponseStatus;
  responseSummary?: string;
  attributedResponder?: AttributedResponder;
  responseReceivedAt?: string;
  sourceBasis?: SourceBasis;
  /** Set when the responding party is a contracted agent acting for a source. */
  contractedAgent?: { name: string; actsFor: string };
  limitationNote?: string;
  reviewState?: ReceiptCandidateReviewState;
  /** Literal — type-level guarantee that the candidate is never marked source-backed. */
  proofTier?: 'receipt_candidate';
  auditMetadata?: ReceiptCandidateAuditMetadata;
}

export interface IssuerResponse {
  responseId: string;
  status: IssuerResponseStatus;
  respondedAt: string;
  responderName?: string;
  responderRole?: string;
  freeText?: string;
  /** A response may still need review before a receipt candidate is even staged. */
  reviewRequired: boolean;
  receiptCandidate?: ReceiptCandidate;
}

export interface IssuerVerificationRequestHistoryEntry {
  status: VerificationRequestStatus;
  at: string;
  note?: string;
}

export interface IssuerVerificationRequest {
  requestId: string;
  claimType: VerificationClaimType;
  claimSummary: string;
  issuerCandidate: IssuerCandidate;
  route: VerificationRoute;
  consent: ConsentArtifact;
  status: VerificationRequestStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  history: IssuerVerificationRequestHistoryEntry[];
  response?: IssuerResponse;
}

/**
 * ISSUER-3 — Policy Review Decision Surface contracts.
 *
 * Truth contract:
 *   - Only `accept_candidate` may produce a PSVReceiptCandidate.
 *   - `accept_candidate` requires the candidate be in
 *     `ready_for_policy_review` (not `review_required`,
 *     `conflict_review_required`, or any other state).
 *   - Reject preserves the underlying response/evidence; it does not
 *     delete the original IssuerResponse or the ReceiptCandidate's
 *     audit metadata.
 *   - request_more_info and reroute do not verify anything; they loop
 *     back to the issuer routing layer.
 *   - A PSVReceiptCandidate is itself still candidate-grade output
 *     (`decisionGrade: false`, distinct
 *     `proofTier: 'psv_receipt_candidate'`) and is NOT a global PSV
 *     receipt. Promotion to PSVReceipt is a future wave with its own
 *     gate.
 */

export type PolicyReviewAction =
  | 'accept_candidate'
  | 'reject_candidate'
  | 'request_more_info'
  | 'request_release'
  | 'reroute'
  | 'mark_conflict_review'
  | 'cancel';

export type PolicyReviewDecisionStatus =
  | 'pending_review'
  | 'accepted_as_psv_candidate'
  | 'rejected'
  | 'request_more_info'
  | 'requires_release'
  | 'reroute_required'
  | 'conflict_review_required'
  | 'expired'
  | 'canceled';

export interface PolicyReviewActor {
  actorId: string;
  displayName: string;
  role:
    | 'policy_reviewer'
    | 'credentialing_committee'
    | 'compliance_officer'
    | 'demo';
}

/**
 * Audit metadata kept with a policy review decision. Like
 * ReceiptCandidateAuditMetadata, this is metadata-only — it is not a
 * real audit-event row, and `recordedBy: 'demo'` makes that explicit
 * for the review surface.
 */
export interface PolicyReviewAuditMetadata {
  recordedAt: string;
  recordedBy: 'demo' | 'review_surface' | 'system';
  notes?: string;
}

/**
 * The reason a decision did or did not produce a PSVReceiptCandidate.
 * Present whether the decision created the candidate or refused to.
 */
export interface PolicyReviewOutcome {
  createdPsvReceiptCandidate: boolean;
  reason: string;
  /** Set when the gate refused; identifies which gate blocked. */
  refusalGate?:
    | 'review_state_not_ready'
    | 'action_does_not_create_candidate'
    | 'legally_only_requires_limitation_note'
    | 'wrong_office_cannot_create_candidate'
    | 'unable_to_verify_cannot_create_candidate'
    | 'conflict_review_unresolved';
}

/**
 * The accept/reject/etc. decision a policy reviewer makes against a
 * receipt candidate. Decisions are recorded as metadata only on the
 * demo surface — no DB row is written.
 */
export interface PolicyReviewDecision {
  decisionId: string;
  receiptCandidateId: string;
  requestId: string;
  action: PolicyReviewAction;
  status: PolicyReviewDecisionStatus;
  decidedAt: string;
  actor: PolicyReviewActor;
  rationale?: string;
  /** True only when the action was accept_candidate AND all gates passed. */
  createdPsvReceiptCandidate: boolean;
  outcome: PolicyReviewOutcome;
  auditMetadata: PolicyReviewAuditMetadata;
}

/**
 * The output of an accepted policy review. Still candidate-grade
 * output: `decisionGrade: false` literal and
 * `proofTier: 'psv_receipt_candidate'` literal. Promotion to a real
 * PSVReceipt is a future wave (ISSUER-4) and requires its own gate.
 */
export interface PSVReceiptCandidate {
  psvCandidateId: string;
  receiptCandidateId: string;
  requestId: string;
  claimId: string;
  claimType: VerificationClaimType;
  acceptedAt: string;
  acceptedBy: PolicyReviewActor;
  /** Carried through from the underlying ReceiptCandidate. */
  sourceBasis: SourceBasis;
  attributedResponder: AttributedResponder;
  /** Required when the underlying response was legally_only. */
  limitationNote?: string;
  /** Literal — type-level guarantee this is not decision-grade. */
  decisionGrade: false;
  /** Literal — distinct from ReceiptCandidate's 'receipt_candidate'. */
  proofTier: 'psv_receipt_candidate';
  notes?: string;
}
