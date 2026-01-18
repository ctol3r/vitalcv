/**
 * Domain types for credential validity.
 *
 * Pure TypeScript only. All validity is time-derived.
 */

export enum CredentialStatus {
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
  NOT_YET_VALID = 'NOT_YET_VALID',
  VALID = 'VALID',
}

export interface TemporalBounds {
  readonly issued_at: Date;
  readonly not_before?: Date;
  readonly expires_at: Date;
}

export interface CredentialSubject {
  readonly id: string;
  readonly type: string;
  readonly claims: Record<string, unknown>;
}

export interface Credential {
  readonly id: string;
  readonly type: string[];
  readonly issuer: string;
  readonly subject: CredentialSubject;
  readonly temporal: TemporalBounds;
}

export type RevocationReason =
  | 'COMPROMISED'
  | 'LICENSE_REVOKED'
  | 'SUPERSEDED'
  | 'AFFILIATION_ENDED'
  | 'FRAUD'
  | 'ADMINISTRATIVE'
  | 'HOLDER_REQUEST'
  | 'OTHER';

export interface RevocationRecord {
  readonly credential_id: string;
  readonly revoked_at: Date;
  /**
   * Optional effective time. When omitted, revocation is effective at revoked_at.
   */
  readonly effective_at?: Date;
  readonly reason: RevocationReason | string;
  readonly revoked_by: string;
  readonly metadata?: Record<string, unknown>;
}

export interface FreshnessRequirement {
  readonly max_age_seconds: number;
  readonly grace_period_seconds?: number;
}

type ValidityBase = {
  readonly credential_id: string;
  readonly status: CredentialStatus;
  readonly checked_at: Date;
  readonly valid_until?: Date;
  readonly revocation?: RevocationRecord;
  readonly reason?: string;
};

export type ValidityResult =
  | (ValidityBase & {
      readonly status: CredentialStatus.REVOKED;
      readonly revocation: RevocationRecord;
      readonly valid_until?: undefined;
    })
  | (ValidityBase & {
      readonly status: CredentialStatus.EXPIRED;
    })
  | (ValidityBase & {
      readonly status: CredentialStatus.NOT_YET_VALID;
    })
  | (ValidityBase & {
      readonly status: CredentialStatus.VALID;
      readonly valid_until: Date;
    });

export type StatusCheckResult = ValidityResult;

export class DomainCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainCredentialsError';
  }
}

export class AmbiguousStateError extends DomainCredentialsError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousStateError';
  }
}

export class TemporalBoundsViolationError extends DomainCredentialsError {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalBoundsViolationError';
  }
}

export class RevocationRecordError extends DomainCredentialsError {
  constructor(message: string) {
    super(message);
    this.name = 'RevocationRecordError';
  }
}
