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

  // ---- ISSUER-ES256 — signed receipt extension ----
  /**
   * ES256-signed JWT minted by signIssuerReceipt when the response
   * status is 'confirmed'. Present only on confirmed candidates.
   * The JWT payload carries claimId, source, status, observed_at,
   * and raw_hash. Absent on non-confirmed candidates.
   */
  signedReceiptJwt?: string;
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

/**
 * ISSUER-4 — PSV Receipt Promotion contracts.
 *
 * Truth contract:
 *   - A PSVReceipt is **scoped evidence**, not global credential
 *     truth. The receipt's scope, limitations, and freshness policy
 *     are themselves load-bearing.
 *   - Only an accepted policy review (i.e., a PSVReceiptCandidate that
 *     resulted from `policyReviewDecision.status ===
 *     'accepted_as_psv_candidate'`) may be promoted to a PSVReceipt.
 *   - rejected, request_more_info, reroute, request_release,
 *     mark_conflict_review, cancel, and any pending decision cannot
 *     promote.
 *   - wrong_office and unable_to_verify response statuses cannot
 *     promote even if the candidate somehow reached this surface.
 *   - legally_only candidates promote only if a limitation note
 *     travels with the candidate.
 *   - The promotion helper is a pure transform; no DB writes, no
 *     audit-event writes. PSVReceiptAuditMetadata.eventState defaults
 *     to `'pending_not_written'` so callers cannot accidentally claim
 *     a real audit row was written when none was.
 *   - PSVReceipt.proofTier is the literal `'psv_receipt'` (distinct
 *     from `'psv_receipt_candidate'` and `'receipt_candidate'`).
 *   - PSVReceipt.decisionGrade is the literal `true` for the source
 *     check this receipt records — but the credential claim it backs
 *     only inherits truth within the receipt's scope, limitations,
 *     and freshness window. globalCredentialTruth is the literal
 *     `false` to make that explicit.
 */

export type PSVReceiptPromotionFailureReason =
  | 'not_a_psv_receipt_candidate'
  | 'policy_review_not_accepted'
  | 'wrong_office_cannot_promote'
  | 'unable_to_verify_cannot_promote'
  | 'rejected_cannot_promote'
  | 'request_more_info_cannot_promote'
  | 'reroute_cannot_promote'
  | 'release_required_cannot_promote'
  | 'conflict_review_unresolved'
  | 'legally_only_requires_limitation'
  | 'missing_source_basis'
  | 'missing_attributed_responder';

export type PSVReceiptAuditEventState =
  | 'pending_not_written'
  | 'queued_demo_only'
  | 'written';

/**
 * Audit metadata for a PSV receipt. The truth contract requires
 * `eventState !== 'written'` until a real audit-event row is actually
 * written by an audit service that exists in the codebase. Until
 * then, callers must surface this as pending — never as written.
 */
export interface PSVReceiptAuditMetadata {
  recordedAt: string;
  recordedBy: 'demo' | 'review_surface' | 'system';
  /** Defaults to 'pending_not_written' so demo surfaces cannot claim a real write. */
  eventState: PSVReceiptAuditEventState;
  notes?: string;
}

/**
 * The scope binding a PSV receipt. Even though the receipt is
 * decision-grade for the source check it records, the credential
 * claim it can support is bounded by this scope. claimType bounds
 * what kind of claim is covered; covers and doesNotCover are
 * human-readable narrowings.
 */
export interface PSVReceiptScope {
  claimType: VerificationClaimType;
  /** Plain-language description of what this receipt covers. */
  covers: string;
  /** Plain-language description of what this receipt does NOT cover. */
  doesNotCover: string;
  /** Source-of-record organization name (carried from sourceBasis). */
  sourceOrganizationName: string;
}

/**
 * An explicit limitation that travels with a PSV receipt. Examples:
 * "Dates and identity only" for a legally_only response;
 * "Federal exclusions only" for an OIG LEIE check; "Self-attested
 * agent" for a contracted-agent response.
 */
export interface PSVReceiptLimitation {
  kind:
    | 'legally_only'
    | 'partial_confirmation'
    | 'contracted_agent'
    | 'access_required'
    | 'jurisdictional_scope'
    | 'other';
  description: string;
}

/**
 * Freshness policy for a PSV receipt. ttlDays is the maximum age at
 * which the receipt is considered current; staleAfter is the absolute
 * timestamp at which it crosses out of policy. The receipt does not
 * self-revoke — a separate revocation surface (future wave) is the
 * authority for that.
 */
export interface FreshnessPolicy {
  ttlDays: number;
  issuedAt: string;
  staleAfter: string;
}

/**
 * The PSV receipt artifact itself. Promotion from PSVReceiptCandidate
 * via `promotePsvReceiptCandidate` is the only path to construct
 * one; the type-level invariants below cannot be satisfied by hand.
 */
export interface PSVReceipt {
  psvReceiptId: string;
  /** The PSVReceiptCandidate this receipt was promoted from. */
  psvCandidateId: string;
  receiptCandidateId: string;
  requestId: string;
  claimId: string;
  claimType: VerificationClaimType;
  promotedAt: string;
  promotedBy: PolicyReviewActor;
  /** Carried verbatim from the candidate. Agent and source remain distinct. */
  sourceBasis: SourceBasis;
  attributedResponder: AttributedResponder;
  /** Required, non-empty narrative bounds for what this receipt covers. */
  scope: PSVReceiptScope;
  /**
   * Required limitations array. May be empty only when the underlying
   * response had none; legally_only and contracted_agent responses
   * always emit at least one entry.
   */
  limitations: PSVReceiptLimitation[];
  freshness: FreshnessPolicy;
  /** Literal — distinct from the candidate tiers; PSV receipts have their own tier. */
  proofTier: 'psv_receipt';
  /**
   * Literal — the source check is decision-grade. Whether the
   * credential claim it backs flips to verified is bounded by scope,
   * limitations, and freshness; this flag does NOT mean global
   * credential truth.
   */
  decisionGrade: true;
  /** Literal — explicit guard against any global-truth interpretation. */
  globalCredentialTruth: false;
  auditMetadata: PSVReceiptAuditMetadata;
  notes?: string;
}

/**
 * Input shape for `promotePsvReceiptCandidate`.
 */
export interface PSVReceiptPromotionInput {
  psvReceiptCandidate: PSVReceiptCandidate;
  /**
   * The policy review decision that produced the candidate. Promotion
   * refuses unless decision.status === 'accepted_as_psv_candidate'.
   */
  policyReviewDecision: PolicyReviewDecision;
  /**
   * The originating issuer-response status (carried from the
   * underlying ReceiptCandidate). Defense-in-depth: even though
   * ISSUER-3 refuses wrong_office / unable_to_verify upstream, this
   * field lets the promotion helper re-check independently. Callers
   * MUST pass this when known.
   */
  originResponseStatus?: IssuerResponseStatus;
  /** ID assigned to the receipt by the caller. */
  psvReceiptId: string;
  promotedAt: string;
  promotedBy: PolicyReviewActor;
  /** Freshness TTL in days. Caller-controlled so tests stay deterministic. */
  ttlDays: number;
  scope: PSVReceiptScope;
  /**
   * Optional override; if omitted, the helper derives limitations
   * from the candidate's response status and contracted-agent flag.
   */
  limitations?: PSVReceiptLimitation[];
  notes?: string;
}

/**
 * Result of a promotion attempt. `promoted` is true iff a PSVReceipt
 * was constructed; `failureReason` is set iff promotion was refused.
 */
export interface PSVReceiptPromotionResult {
  promoted: boolean;
  psvReceipt?: PSVReceipt;
  failureReason?: PSVReceiptPromotionFailureReason;
  message: string;
  /** The candidate is preserved on every outcome — no mutation. */
  preservedCandidate: PSVReceiptCandidate;
}
