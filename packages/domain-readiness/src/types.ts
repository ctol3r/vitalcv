/**
 * Domain types for Credential Readiness Score (CRS).
 *
 * Pure TypeScript only. Deterministic + explainable.
 */

import type { AuthoritySnapshot } from '@domain/authority';
import type { ValidityResult } from '@domain/credentials';
import type { TrustGradient } from '@domain/qia';

export type CRSGrade = 'RED' | 'YELLOW' | 'GREEN';

export enum CRSReasonCode {
  CREDENTIAL_REVOKED = 'CREDENTIAL_REVOKED',
  CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED',
  CREDENTIAL_NOT_YET_VALID = 'CREDENTIAL_NOT_YET_VALID',
  AUTHORITY_REVOKED = 'AUTHORITY_REVOKED',
  AUTHORITY_EXPIRED = 'AUTHORITY_EXPIRED',
  AUTHORITY_PENDING = 'AUTHORITY_PENDING',
  QIA_INVALID = 'QIA_INVALID',
  TRUST_GRADIENT_LOW = 'TRUST_GRADIENT_LOW',
  TRUST_GRADIENT_MEDIUM = 'TRUST_GRADIENT_MEDIUM',
  DECAY_FRESHNESS = 'DECAY_FRESHNESS',
}

export interface CRSReason {
  readonly code: CRSReasonCode;
  readonly message: string;
  readonly deduction: number;
}

export interface CRSResult {
  readonly score: number;
  readonly grade: CRSGrade;
  readonly reasons: CRSReason[];
}

export type QiaValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: string[] };

export type AuthorityStateSummary = AuthoritySnapshot;

export interface CRSInput {
  readonly credentialValidityResult: ValidityResult;
  readonly authorityStateSummary: AuthorityStateSummary;
  readonly qiaValidationResult: QiaValidationResult;
  readonly trustGradient: TrustGradient;
  readonly decay?: {
    readonly half_life_ms?: number;
  };
}

export interface ReadinessSignal {
  readonly greenlight: boolean;
  readonly blockers: string[];
}

export class DomainReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainReadinessError';
  }
}

export class ReadinessInvariantError extends DomainReadinessError {
  constructor(message: string) {
    super(message);
    this.name = 'ReadinessInvariantError';
  }
}

export class AmbiguousReadinessStateError extends DomainReadinessError {
  constructor(message: string) {
    super(message);
    this.name = 'AmbiguousReadinessStateError';
  }
}
