/**
 * credentialModel.ts — Wave 94: Verifiable Credential Model
 *
 * Defines the credential data structure used across issuer, verifier,
 * and wallet services. No Prisma dependency — credentials are self-contained
 * signed objects that can live outside the database.
 */

// ── Status lifecycle ──────────────────────────────────────────────────

export type CredentialStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED';

// ── Core credential ───────────────────────────────────────────────────

export interface VerifiableCredential {
  /** Unique credential identifier (UUID v4) */
  credentialId: string;

  /** DID or identifier of the issuing authority */
  issuer: string;

  /** DID or NPI of the credential subject (clinician) */
  subject: string;

  /** Arbitrary claim payload — license details, board cert, etc. */
  claims: Record<string, unknown>;

  /** ES256 compact JWS signature over the canonical payload */
  signature: string;

  /** Current credential status */
  status: CredentialStatus;

  /** ISO-8601 issuance timestamp */
  issuedAt: string;

  /** ISO-8601 expiration (optional — some credentials don't expire) */
  expiresAt?: string;

  /** Schema version for forward compatibility */
  schemaVersion: '1.0';
}

// ── Unsigned envelope (pre-signing) ───────────────────────────────────

export interface UnsignedCredential {
  credentialId: string;
  issuer: string;
  subject: string;
  claims: Record<string, unknown>;
  issuedAt: string;
  expiresAt?: string;
  schemaVersion: '1.0';
}

// ── Issue request ─────────────────────────────────────────────────────

export interface IssueCredentialRequest {
  /** Issuer identifier — must be registered in the trust registry */
  issuer: string;
  /** Subject NPI or DID */
  subject: string;
  /** Claim payload */
  claims: Record<string, unknown>;
  /** Optional expiration (ISO-8601) */
  expiresAt?: string;
}

// ── SD-JWT VC extensions (Wave 111) ──────────────────────────────────

/**
 * Metadata for a claim that supports selective disclosure.
 */
export interface DisclosableClaimMetadata {
  /** Whether this claim can be selectively disclosed */
  disclosable: boolean;
  /** Friendly display name */
  displayName?: string;
  /** Whether disclosure of this claim is required by default */
  requiredForPresentation?: boolean;
}

/**
 * Extended credential with SD-JWT VC metadata.
 * Layered over VerifiableCredential — use when issuing via vc+sd-jwt format.
 */
export interface SdJwtVcMetadata {
  /** Claims that can be selectively disclosed, with metadata */
  disclosableClaims: Record<string, DisclosableClaimMetadata>;
  /** Holder DID for binding (optional — enables holder-binding proofs) */
  holderDid?: string;
  /** The SD-JWT string after issuance (replaces `signature` for vc+sd-jwt format) */
  sdJwt?: string;
  /** Format identifier */
  format: 'vc+sd-jwt' | 'jwt_vc_json';
}

// ── Verification result ───────────────────────────────────────────────

export interface VerificationResult {
  valid: boolean;
  credentialId: string;
  checks: {
    signature: boolean;
    issuerTrusted: boolean;
    statusActive: boolean;
    notExpired: boolean;
  };
  errors: string[];
  verifiedAt: string;
  /** Wave 112: HAIP compliance result */
  haip?: {
    compliant: boolean;
    issuerCompliant: boolean | null;
    violations: Array<{ rule: string; detail: string; severity: string }>;
  };
}
