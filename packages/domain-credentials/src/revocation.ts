/**
 * Revocation-first utilities.
 *
 * Revocation is terminal and irreversible once effective.
 */

import {
  type Credential,
  CredentialStatus,
  type RevocationRecord,
  type StatusCheckResult,
  AmbiguousStateError,
  RevocationRecordError,
} from './types';

function assertValidDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RevocationRecordError(`${label} must be a valid Date`);
  }
  return value;
}

function assertValidCheckTime(checkTime: Date): Date {
  if (!(checkTime instanceof Date) || Number.isNaN(checkTime.getTime())) {
    throw new AmbiguousStateError('checkTime must be a valid Date');
  }
  return checkTime;
}

export function validateRevocationRecord(record: RevocationRecord): void {
  if (!record.credential_id) {
    throw new RevocationRecordError('Revocation record missing credential_id');
  }

  if (!record.revoked_by) {
    throw new RevocationRecordError('Revocation record missing revoked_by');
  }

  if (!record.reason) {
    throw new RevocationRecordError('Revocation record missing reason');
  }

  assertValidDate(record.revoked_at, 'revoked_at');

  if (record.effective_at) {
    assertValidDate(record.effective_at, 'effective_at');
  }
}

export function getEffectiveRevocationTime(record: RevocationRecord): Date {
  return record.effective_at ?? record.revoked_at;
}

export function assertRevocationRecordMatchesCredential(
  credential: Credential,
  record: RevocationRecord,
): void {
  validateRevocationRecord(record);

  if (!credential.id) {
    throw new AmbiguousStateError('Credential missing id');
  }

  if (record.credential_id !== credential.id) {
    throw new AmbiguousStateError(
      `Revocation record credential_id mismatch: expected ${credential.id}, got ${record.credential_id}`,
    );
  }

  const issuedAt = credential.temporal?.issued_at;
  if (!(issuedAt instanceof Date) || Number.isNaN(issuedAt.getTime())) {
    throw new AmbiguousStateError('Credential temporal.issued_at must be a valid Date');
  }

  if (record.revoked_at < issuedAt) {
    throw new AmbiguousStateError(
      `Revocation record revoked_at (${record.revoked_at.toISOString()}) precedes issuance (${issuedAt.toISOString()})`,
    );
  }

  const effectiveAt = getEffectiveRevocationTime(record);
  if (effectiveAt < issuedAt) {
    throw new AmbiguousStateError(
      `Revocation effective_at (${effectiveAt.toISOString()}) precedes issuance (${issuedAt.toISOString()})`,
    );
  }
}

export function isRevokedAt(
  record: RevocationRecord,
  checkTime: Date = new Date(),
): boolean {
  validateRevocationRecord(record);
  const time = assertValidCheckTime(checkTime);
  const effectiveAt = getEffectiveRevocationTime(record);
  return time >= effectiveAt;
}

export function checkRevocationFirst(
  credential: Credential,
  revocationRecord: RevocationRecord | null,
  checkTime: Date = new Date(),
): StatusCheckResult | null {
  if (!revocationRecord) {
    return null;
  }

  assertRevocationRecordMatchesCredential(credential, revocationRecord);

  const time = assertValidCheckTime(checkTime);
  const effectiveAt = getEffectiveRevocationTime(revocationRecord);

  if (time < effectiveAt) {
    return null;
  }

  return {
    credential_id: credential.id,
    status: CredentialStatus.REVOKED,
    checked_at: time,
    valid_until: undefined,
    revocation: revocationRecord,
    reason: `Revoked effective ${effectiveAt.toISOString()} (${revocationRecord.reason})`,
  };
}
