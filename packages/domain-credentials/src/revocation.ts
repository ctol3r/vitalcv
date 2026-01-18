/**
 * Revocation-First Validity Logic
 *
 * CRITICAL: Always check revocation BEFORE checking temporal validity.
 * A revoked credential is invalid regardless of temporal bounds.
 */

import {
  type Credential,
  CredentialStatus,
  type RevocationRecord,
  type StatusCheckResult,
  RevocationCheckFailedError,
  AmbiguousStateError,
} from './types';

/**
 * Check if credential is revoked
 *
 * INVARIANT: Revocation is terminal - once revoked, always revoked.
 *
 * @throws RevocationCheckFailedError if revocation status cannot be determined
 * @throws AmbiguousStateError if revocation record is inconsistent
 */
export function isRevoked(
  credential: Credential,
  revocationRecord: RevocationRecord | null,
  checkTime: Date = new Date(),
): boolean {
  // No revocation record = not revoked
  if (!revocationRecord) {
    return false;
  }

  // Validate revocation record consistency
  if (revocationRecord.credential_id !== credential.id) {
    throw new AmbiguousStateError(
      `Revocation record credential_id mismatch: expected ${credential.id}, got ${revocationRecord.credential_id}`
    );
  }

  // Effective immediately = revoked from moment of revocation
  if (revocationRecord.effective_immediately) {
    return checkTime >= revocationRecord.revoked_at;
  }

  // Not effective immediately = revoked from revocation time
  return checkTime >= revocationRecord.revoked_at;
}

/**
 * Create revocation status check result
 *
 * PURE: No side effects
 */
export function createRevocationStatusResult(
  credential: Credential,
  revocationRecord: RevocationRecord,
  checkTime: Date = new Date(),
): StatusCheckResult {
  return {
    credential_id: credential.id,
    status: CredentialStatus.REVOKED,
    checked_at: checkTime,
    valid_until: undefined, // Revoked credentials are never valid again
    revocation: revocationRecord,
    reason: `Revoked on ${revocationRecord.revoked_at.toISOString()} - ${revocationRecord.reason}`,
  };
}

/**
 * Validate revocation record
 *
 * INVARIANT: Revocation records must be consistent and complete.
 *
 * @throws AmbiguousStateError if revocation record is invalid
 */
export function validateRevocationRecord(record: RevocationRecord): void {
  if (!record.credential_id) {
    throw new AmbiguousStateError('Revocation record missing credential_id');
  }

  if (!record.revoked_at) {
    throw new AmbiguousStateError('Revocation record missing revoked_at');
  }

  if (record.revoked_at > new Date()) {
    throw new AmbiguousStateError(
      `Revocation record has future revoked_at: ${record.revoked_at.toISOString()}`
    );
  }

  if (!record.reason) {
    throw new AmbiguousStateError('Revocation record missing reason');
  }

  if (!record.revoked_by) {
    throw new AmbiguousStateError('Revocation record missing revoked_by');
  }
}

/**
 * Check if revocation is retroactive
 *
 * Retroactive revocations invalidate the credential from issuance time,
 * not from revocation time.
 */
export function isRetroactive(revocationRecord: RevocationRecord): boolean {
  return revocationRecord.effective_immediately === true;
}

/**
 * Get effective revocation time
 *
 * For retroactive revocations, this is the issuance time of the credential.
 * For normal revocations, this is the revocation time.
 */
export function getEffectiveRevocationTime(
  credential: Credential,
  revocationRecord: RevocationRecord,
): Date {
  if (isRetroactive(revocationRecord)) {
    return credential.temporal.issued_at;
  }
  return revocationRecord.revoked_at;
}

/**
 * Revocation-First Status Check
 *
 * CRITICAL: This is the entry point for all status checks.
 * Always check revocation BEFORE temporal validity.
 *
 * @returns StatusCheckResult if revoked, null otherwise
 */
export function checkRevocationFirst(
  credential: Credential,
  revocationRecord: RevocationRecord | null,
  checkTime: Date = new Date(),
): StatusCheckResult | null {
  // No revocation record = not revoked
  if (!revocationRecord) {
    return null;
  }

  // Validate revocation record
  validateRevocationRecord(revocationRecord);

  // Check if revoked at check time
  if (isRevoked(credential, revocationRecord, checkTime)) {
    return createRevocationStatusResult(credential, revocationRecord, checkTime);
  }

  return null;
}
