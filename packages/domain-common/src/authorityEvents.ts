/**
 * AUTHORITY EVENTS
 *
 * Immutable authority statements that can be accepted by employers/facilities.
 * These events are read-only and must be audit anchored.
 */

export const AUTHORITY_ISSUER_TYPES = [
  'facility',
  'employer',
  'board',
  'state',
  'federal',
  'payer',
  'private',
  'platform',
] as const;

export type AuthorityIssuerType = (typeof AUTHORITY_ISSUER_TYPES)[number];

export const AUTHORITY_CREDENTIAL_STATUS_VALUES = [
  'active',
  'expired',
  'suspended',
  'revoked',
  'restricted',
] as const;

export type AuthorityCredentialStatus = (typeof AUTHORITY_CREDENTIAL_STATUS_VALUES)[number];

export const AUTHORITY_CREDENTIAL_TYPE_VALUES = [
  'facility-credential',
  'privilege',
  'license',
  'board-certification',
  'psv',
  'other',
] as const;

export type AuthorityCredentialType = (typeof AUTHORITY_CREDENTIAL_TYPE_VALUES)[number];

export interface AuthorityFacility {
  facilityId: string;
  name: string;
  npi?: string;
  location?: string;
}

export interface AuthorityCredential {
  credentialId: string;
  type: AuthorityCredentialType;
  title: string;
  status: AuthorityCredentialStatus;
  issuedAt: string;
  expiresAt?: string | null;
  issuerName?: string;
  facility?: AuthorityFacility;
  scope?: string[];
}

export interface AuthorityEvent {
  /** Unique identifier for the authority event */
  authorityId: string;

  /** Subject (clinician/practitioner) identifier */
  subjectDid: string;

  /** Optional subject display name */
  subjectName?: string;

  /** Issuer identifier */
  issuerDid: string;

  /** Issuer display name */
  issuerName: string;

  /** Issuer type */
  issuerType: AuthorityIssuerType;

  /** Authority event type */
  authorityType: AuthorityCredentialType;

  /** Timestamp when authority was issued (ISO 8601) */
  issuedAt: string;

  /** Optional expiration (ISO 8601) */
  expiresAt?: string | null;

  /** Facility context (if applicable) */
  facility?: AuthorityFacility;

  /** Credential details (facility-issued or external) */
  credential?: AuthorityCredential;

  /** Evidence reference (no document uploads) */
  evidenceRef?: string;

  /** Cryptographic proof of issuer signature */
  proof: {
    type: 'Ed25519Signature2020' | 'JcsEd25519Signature2020';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    proofValue: string;
  };

  /** Hash anchor for immutability verification */
  hashAnchor: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuthorityAcceptanceEvent {
  /** Unique identifier for this acceptance event */
  acceptanceId: string;

  /** Reference to the AuthorityEvent being accepted */
  authorityId: string;

  /** Entity that accepted the authority event */
  acceptedBy: {
    entityId?: string;
    name: string;
    did?: string;
    type: 'employer' | 'facility' | 'payer' | 'issuer' | 'other';
  };

  /** Timestamp when acceptance was recorded (ISO 8601) */
  acceptedAt: string;

  /** Acceptance decision */
  decision: 'ACCEPTED';

  /** Authority event hash at time of acceptance */
  authorityHash: string;

  /** Hash anchor for acceptance immutability */
  hashAnchor: string;
}
