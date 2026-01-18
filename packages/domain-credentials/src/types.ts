/**
 * Domain Types for Credential Trust Infrastructure
 *
 * Pure TypeScript types with no dependencies.
 * All "truth" is time-bound - no absolute statements about validity.
 */

/**
 * Credential Status - Revocation First
 *
 * Order matters: Check REVOKED before VALID
 */
export enum CredentialStatus {
  REVOKED = 'REVOKED',           // Terminal state - cannot be unrevoked
  EXPIRED = 'EXPIRED',           // Time-bound invalidity
  NOT_YET_VALID = 'NOT_YET_VALID', // Time-bound invalidity (future)
  SUSPENDED = 'SUSPENDED',       // Temporary invalidity
  VALID = 'VALID',               // Valid at evaluation time
  UNKNOWN = 'UNKNOWN',           // Cannot determine (fail loudly elsewhere)
}

/**
 * Revocation Reason - Audit Trail
 */
export enum RevocationReason {
  COMPROMISED = 'COMPROMISED',           // Security breach
  LICENSE_REVOKED = 'LICENSE_REVOKED',   // Underlying credential revoked
  SUPERSEDED = 'SUPERSEDED',             // Replaced by newer credential
  AFFILIATION_ENDED = 'AFFILIATION_ENDED', // Employment/affiliation terminated
  FRAUD = 'FRAUD',                       // Fraudulent issuance
  ADMINISTRATIVE = 'ADMINISTRATIVE',     // Admin action
  HOLDER_REQUEST = 'HOLDER_REQUEST',     // Holder requested revocation
}

/**
 * Revocation Record
 *
 * Immutable once created. Revocation is irreversible.
 */
export interface RevocationRecord {
  readonly credential_id: string;
  readonly revoked_at: Date;
  readonly reason: RevocationReason;
  readonly revoked_by: string;          // Who performed the revocation
  readonly effective_immediately: boolean; // True if retroactive
  readonly metadata?: Record<string, unknown>;
}

/**
 * Temporal Bounds for Credential Validity
 *
 * All credentials have finite validity periods.
 */
export interface TemporalBounds {
  readonly issued_at: Date;
  readonly not_before?: Date;           // Optional: credential valid from this date
  readonly expires_at: Date;            // Required: all credentials expire
  readonly max_age_seconds?: number;    // Optional: freshness requirement
}

/**
 * Credential Subject - Who the credential is about
 */
export interface CredentialSubject {
  readonly id: string;                  // DID or unique identifier
  readonly npi?: string;                // National Provider Identifier (if healthcare)
  readonly type: string;                // Subject type (e.g., "Practitioner", "Organization")
  readonly claims: Record<string, unknown>; // Flexible claims
}

/**
 * Credential Core
 *
 * Minimal credential structure for domain logic.
 * Does not include full W3C VC structure (that's in another layer).
 */
export interface Credential {
  readonly id: string;
  readonly type: string[];              // Credential type (e.g., ["VerifiableCredential", "LicenseCredential"])
  readonly issuer: string;              // Issuer DID or identifier
  readonly subject: CredentialSubject;
  readonly temporal: TemporalBounds;
  readonly status_list_index?: number;  // Optional: index in status list
  readonly proof_type?: string;         // Optional: signature algorithm
}

/**
 * Status Check Result
 *
 * Result of checking credential status at a specific time.
 * Immutable snapshot.
 */
export interface StatusCheckResult {
  readonly credential_id: string;
  readonly status: CredentialStatus;
  readonly checked_at: Date;
  readonly valid_until?: Date;          // When status expires (for caching)
  readonly revocation?: RevocationRecord;
  readonly reason?: string;             // Human-readable reason for status
}

/**
 * Freshness Requirement
 *
 * Policy for how fresh a credential must be.
 */
export interface FreshnessRequirement {
  readonly max_age_seconds: number;
  readonly allow_not_before: boolean;   // Allow credentials with future not_before?
  readonly grace_period_seconds?: number; // Grace period after expiration
}

/**
 * Trust Evaluation Context
 *
 * Context for evaluating credential trust.
 */
export interface TrustEvaluationContext {
  readonly evaluation_time: Date;
  readonly freshness?: FreshnessRequirement;
  readonly require_revocation_check: boolean;
  readonly trusted_issuers?: string[]; // Optional: only trust specific issuers
}

/**
 * Trust Evaluation Result
 *
 * Outcome of full trust evaluation (QIA: Quality, Identity, Authorization).
 */
export interface TrustEvaluationResult {
  readonly trusted: boolean;
  readonly quality_score: number;       // 0-1: quality assessment
  readonly identity_verified: boolean;  // Identity claims verified
  readonly authorized: boolean;         // Issuer authorized to issue
  readonly status: StatusCheckResult;
  readonly failures: string[];          // List of failure reasons
  readonly evaluated_at: Date;
}

/**
 * Error Types
 */
export class CredentialTrustError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'CredentialTrustError';
  }
}

export class RevocationCheckFailedError extends CredentialTrustError {
  constructor(message: string) {
    super(message, 'REVOCATION_CHECK_FAILED');
  }
}

export class TemporalBoundsViolationError extends CredentialTrustError {
  constructor(message: string) {
    super(message, 'TEMPORAL_BOUNDS_VIOLATION');
  }
}

export class AmbiguousStateError extends CredentialTrustError {
  constructor(message: string) {
    super(message, 'AMBIGUOUS_STATE');
  }
}
