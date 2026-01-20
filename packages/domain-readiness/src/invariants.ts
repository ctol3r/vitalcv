/**
 * Invariants and validation helpers for CRS computation.
 */

import { AuthorityScopeStatus } from '@domain/authority';
import { CredentialStatus, type ValidityResult } from '@domain/credentials';
import type { TrustGradient } from '@domain/qia';
import type { AuthorityStateSummary, CRSInput, QiaValidationResult } from './types';
import { AmbiguousReadinessStateError, ReadinessInvariantError } from './types';

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ReadinessInvariantError(`${label} must be a non-empty string`);
  }
  return value;
}

function assertValidDate(value: unknown, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ReadinessInvariantError(`${label} must be a valid Date`);
  }
  return value;
}

function assertFiniteNumber(value: unknown, label: string): number {
  if (!Number.isFinite(value)) {
    throw new ReadinessInvariantError(`${label} must be a finite number`);
  }
  return value;
}

function assertNormalized(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ReadinessInvariantError(`${label} must be between 0 and 1`);
  }
  return value;
}

function assertStringArray(value: unknown, label: string, allowEmpty = false): string[] {
  if (!Array.isArray(value)) {
    throw new ReadinessInvariantError(`${label} must be an array`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new ReadinessInvariantError(`${label} must not be empty`);
  }
  for (const entry of value) {
    assertNonEmptyString(entry, `${label} entry`);
  }
  return value;
}

function assertValidCredentialValidityResult(result: ValidityResult, now: Date): void {
  if (!result) {
    throw new ReadinessInvariantError('credentialValidityResult is required');
  }

  assertNonEmptyString(result.credential_id, 'credentialValidityResult.credential_id');

  if (!Object.values(CredentialStatus).includes(result.status)) {
    throw new ReadinessInvariantError(
      `credentialValidityResult.status must be one of ${Object.values(CredentialStatus).join(', ')}`,
    );
  }

  const checkedAt = assertValidDate(result.checked_at, 'credentialValidityResult.checked_at');
  if (checkedAt.getTime() > now.getTime()) {
    throw new AmbiguousReadinessStateError(
      'credentialValidityResult.checked_at cannot be in the future',
    );
  }

  if (result.reason !== undefined && typeof result.reason !== 'string') {
    throw new ReadinessInvariantError('credentialValidityResult.reason must be a string');
  }

  if (result.valid_until !== undefined) {
    assertValidDate(result.valid_until, 'credentialValidityResult.valid_until');
  }

  switch (result.status) {
    case CredentialStatus.REVOKED: {
      if (!result.revocation) {
        throw new AmbiguousReadinessStateError(
          'credentialValidityResult.revocation is required for REVOKED status',
        );
      }
      assertValidDate(result.revocation.revoked_at, 'credentialValidityResult.revocation.revoked_at');
      assertNonEmptyString(
        result.revocation.reason,
        'credentialValidityResult.revocation.reason',
      );
      assertNonEmptyString(
        result.revocation.revoked_by,
        'credentialValidityResult.revocation.revoked_by',
      );
      return;
    }
    case CredentialStatus.VALID: {
      if (!result.valid_until) {
        throw new AmbiguousReadinessStateError(
          'credentialValidityResult.valid_until is required for VALID status',
        );
      }
      return;
    }
    case CredentialStatus.EXPIRED:
    case CredentialStatus.NOT_YET_VALID:
      return;
    default:
      throw new ReadinessInvariantError('Unsupported credential validity status');
  }
}

function assertValidAuthorityStateSummary(summary: AuthorityStateSummary, now: Date): void {
  if (!summary) {
    throw new ReadinessInvariantError('authorityStateSummary is required');
  }

  if (!summary.authority) {
    throw new ReadinessInvariantError('authorityStateSummary.authority is required');
  }
  assertNonEmptyString(summary.authority.authority_id, 'authorityStateSummary.authority.authority_id');

  const asOf = assertValidDate(summary.as_of, 'authorityStateSummary.as_of');
  if (asOf.getTime() > now.getTime()) {
    throw new AmbiguousReadinessStateError('authorityStateSummary.as_of cannot be in the future');
  }

  if (!Array.isArray(summary.scopes) || summary.scopes.length === 0) {
    throw new ReadinessInvariantError('authorityStateSummary.scopes must be a non-empty array');
  }

  const allowedStatuses = new Set(Object.values(AuthorityScopeStatus));
  for (const scope of summary.scopes) {
    assertNonEmptyString(scope.scope_id, 'authorityStateSummary.scopes.scope_id');
    assertNonEmptyString(scope.authority_id, 'authorityStateSummary.scopes.authority_id');
    assertValidDate(scope.as_of, 'authorityStateSummary.scopes.as_of');
    if (scope.authority_id !== summary.authority.authority_id) {
      throw new ReadinessInvariantError('authorityStateSummary.scopes authority_id mismatch');
    }
    if (!allowedStatuses.has(scope.status)) {
      throw new ReadinessInvariantError(
        `authorityStateSummary.scopes.status must be one of ${[
          ...allowedStatuses,
        ].join(', ')}`,
      );
    }
  }
}

function assertValidQiaValidationResult(result: QiaValidationResult): void {
  if (!result) {
    throw new ReadinessInvariantError('qiaValidationResult is required');
  }
  if (typeof result.ok !== 'boolean') {
    throw new ReadinessInvariantError('qiaValidationResult.ok must be a boolean');
  }
  if (result.ok === false) {
    assertStringArray(result.reasons, 'qiaValidationResult.reasons');
  } else if ('reasons' in result) {
    throw new AmbiguousReadinessStateError(
      'qiaValidationResult.reasons must be omitted when ok is true',
    );
  }
}

function assertValidTrustGradient(gradient: TrustGradient): void {
  if (!gradient) {
    throw new ReadinessInvariantError('trustGradient is required');
  }

  const score = assertNormalized(gradient.score, 'trustGradient.score');
  if (gradient.band !== 'LOW' && gradient.band !== 'MEDIUM' && gradient.band !== 'HIGH') {
    throw new ReadinessInvariantError('trustGradient.band must be LOW, MEDIUM, or HIGH');
  }

  const components = gradient.components;
  if (!components) {
    throw new ReadinessInvariantError('trustGradient.components is required');
  }

  assertNormalized(components.confidence, 'trustGradient.components.confidence');
  assertNormalized(components.freshness, 'trustGradient.components.freshness');
  assertNormalized(components.dispute_history, 'trustGradient.components.dispute_history');
  assertNormalized(
    components.corroboration_density,
    'trustGradient.components.corroboration_density',
  );

  const expectedBand = score < 0.4 ? 'LOW' : score < 0.7 ? 'MEDIUM' : 'HIGH';
  if (gradient.band !== expectedBand) {
    throw new AmbiguousReadinessStateError(
      `trustGradient.band mismatch: expected ${expectedBand}, received ${gradient.band}`,
    );
  }
}

export function resolveAuthorityStatus(summary: AuthorityStateSummary): AuthorityScopeStatus {
  const statuses = new Set(summary.scopes.map((scope) => scope.status));
  if (statuses.size !== 1) {
    throw new AmbiguousReadinessStateError(
      `authorityStateSummary scopes disagree: ${[...statuses].join(', ')}`,
    );
  }
  return summary.scopes[0].status;
}

export function resolveFreshnessAnchor(input: CRSInput): Date {
  const credentialTime = input.credentialValidityResult.checked_at;
  const authorityTime = input.authorityStateSummary.as_of;
  const anchorTime = Math.min(credentialTime.getTime(), authorityTime.getTime());
  return new Date(anchorTime);
}

export function assertValidCRSInput(input: CRSInput, now: Date): void {
  if (!input) {
    throw new ReadinessInvariantError('input is required');
  }

  const checkTime = assertValidDate(now, 'now');
  assertValidCredentialValidityResult(input.credentialValidityResult, checkTime);
  assertValidAuthorityStateSummary(input.authorityStateSummary, checkTime);
  assertValidQiaValidationResult(input.qiaValidationResult);
  assertValidTrustGradient(input.trustGradient);

  if (input.decay?.half_life_ms !== undefined) {
    const halfLife = assertFiniteNumber(input.decay.half_life_ms, 'decay.half_life_ms');
    if (halfLife <= 0) {
      throw new ReadinessInvariantError('decay.half_life_ms must be greater than 0');
    }
  }
}
