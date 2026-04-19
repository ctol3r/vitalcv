/**
 * privilege-types.ts — Shared contract for the Procedure & Privilege Activation
 * mega wave (clinical privileges, commercial payer enrollment, velocity metrics,
 * delegated supervising authority).
 *
 * Truth Doctrine
 * --------------
 * These contracts intentionally model *honest absence*: every optional field
 * admits a "not on file / not yet linked" state so surfaces degrade to
 * attestable silence rather than fabricating enrolled / cleared labels.
 *
 * Status vocabularies align with the existing canonical primitives:
 *   - `PrivilegeProofStatus` is a narrow literal union mapped to TrustClaim kinds
 *   - `PayerEnrollmentStatus` uses the same trust-color semantics as PECOS
 *
 * The types are colocated (not split) because every consumer either renders
 * the employer review surfaces together or the clinician passport surfaces
 * together — splitting would create a dependency web for no payoff.
 */

/** Status vocabulary for a single requested privilege row. */
export type PrivilegeProofStatus =
  | 'met'
  | 'partial'
  | 'missing'
  | 'peer_requested'
  | 'not_applicable';

/** A single requested privilege the employer wants to grant. */
export interface ClinicalPrivilegeRequest {
  id: string;
  label: string;
  context?: string;
  requiredProof: string;
  matchedEvidence?: string;
  status: PrivilegeProofStatus;
  caseCount?: number | null;
  caseCountRequired?: number | null;
  window?: string;
  note?: string;
}

/** Status vocabulary for a commercial payer enrollment lane. */
export type PayerEnrollmentStatus =
  | 'verified'
  | 'processing'
  | 'awaiting_npi'
  | 'awaiting_caqh'
  | 'action_required'
  | 'not_enrolled'
  | 'unchecked';

/** One payer lane (Medicare, BCBS, Aetna, …). */
export interface PayerEnrollmentLane {
  id: string;
  label: string;
  category?: 'government' | 'commercial';
  status: PayerEnrollmentStatus;
  note?: string;
  observedAt?: string | null;
}

/** Dual-metric velocity readout. */
export interface VelocityCountdown {
  credentialingClearance: string | null;
  revenueActivation: string | null;
  baseline?: string | null;
  timeSaved?: string | null;
  disclosure?: string;
}

/** Agreement status for a supervising / collaborating physician. */
export type SupervisingAgreementStatus =
  | 'active'
  | 'pending'
  | 'expired'
  | 'missing';

/** Supervising or collaborating physician relationship. */
export interface SupervisingPhysicianLink {
  displayName: string;
  npi: string;
  relationship?: 'supervisor' | 'collaborator' | 'delegate';
  specialty?: string;
  state?: string;
  agreementStatus: SupervisingAgreementStatus;
  loggedAt?: string | null;
  agreementHref?: string;
}
