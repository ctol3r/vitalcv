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

export interface ReceiptCandidate {
  candidateId: string;
  createdAt: string;
  basis: 'issuer_direct' | 'contracted_agent';
  /** Required when basis is 'contracted_agent'. */
  agentName?: string;
  /** Always required — the source the response speaks for. */
  sourceOrganizationName: string;
  attributionStatus: 'unattributed' | 'attributed_pending_review' | 'attributed_reviewed';
  /** Literal false — type-level guarantee that classification cannot be decision-grade. */
  decisionGrade: false;
  notes?: string;
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
