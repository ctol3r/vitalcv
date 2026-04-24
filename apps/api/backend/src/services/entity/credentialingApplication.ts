/**
 * credentialingApplication.ts
 *
 * Schema for the CredentialingApplication — the central artifact that gates
 * DECISION_GRADE under full delegated credentialing.
 *
 * Lifecycle: draft → submitted → under_review → approved | denied
 * Approval requires: full PSV coverage + signed attestation.
 */

// ── Attestation ──────────────────────────────────────────────────────────────

export interface CredentialingAttestation {
  /** NPI or user ID of the signer */
  signedBy: string;
  /** ISO 8601 */
  signedAt: string;
  /** SHA-256 of the canonical attestation payload (entityId + npi + language + signedAt) */
  attestationHash: string;
  /** Semantic version of the attestation language used */
  attestationVersion: string;
  /** The full attestation statement as presented to and signed by the applicant */
  language: string;
}

// ── Application ──────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'withdrawn';

export interface PSVRequirementSnapshot {
  sourceId: string;
  label: string;
  credentialType: string;
  state: string;
  required: boolean;
}

export interface CredentialingApplication {
  applicationId: string;
  entityId: string;
  npi: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  /** Provider's signed attestation. Null until the provider completes the application flow. */
  attestation: CredentialingAttestation | null;
  /** Complete list of PSV checks required for this provider at submission time */
  requiredPSV: PSVRequirementSnapshot[];
  /** Subset of requiredPSV that were not yet 'checked' at submission time */
  missingPSV: PSVRequirementSnapshot[];
  /** 'full' only when all required PSV are checked and attestation is signed */
  completenessLevel: 'full' | 'partial' | 'none';
  /** Schema version — bump when shape changes to support migration */
  applicationVersion: string;
  createdAt: string;
  updatedAt: string;
  /** ISO 8601 — null if no expiry window applies */
  expiresAt: string | null;
}

// ── ApplicationData surface (embedded in TrustPassport) ──────────────────────

export interface ApplicationData {
  applicationId: string | null;
  status: ApplicationStatus | null;
  submittedAt: string | null;
  attestation: CredentialingAttestation | null;
}

export const NULL_APPLICATION_DATA: ApplicationData = {
  applicationId: null,
  status: null,
  submittedAt: null,
  attestation: null,
};
