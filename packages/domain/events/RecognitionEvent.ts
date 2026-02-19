import { DomainError } from '../../domain-common/src/errors/DomainError';

export type RecognitionVerification = {
  verifiedAt: string;
  verificationRef: string;
};

export type RecognitionRevocation = {
  revokedAt: string;
  revocationRef: string;
};

export type RecognitionEventInput = {
  recognitionId?: string;
  subjectId: string;
  employerId: string;
  recognizedAt: string;
  verification: RecognitionVerification;
  expiresAt: string | null;
  revocation?: RecognitionRevocation | null;
};

function generateId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function assertNonEmpty(value: string, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError(`${field} is required`, 'MISSING_FIELD');
  }
}

function assertTimestamp(value: string, field: string) {
  assertNonEmpty(value, field);
  if (Number.isNaN(Date.parse(value))) {
    throw new DomainError(`${field} must be a valid ISO 8601 timestamp`, 'INVALID_TIMESTAMP');
  }
}

export class RecognitionEvent {
  public readonly recognitionId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly recognizedAt: string;
  public readonly verification: RecognitionVerification;
  public readonly expiresAt: string | null;
  public readonly revocation: RecognitionRevocation | null;

  constructor(input: RecognitionEventInput) {
    if (!input || typeof input !== 'object') {
      throw new DomainError('RecognitionEvent input is required', 'MISSING_FIELD');
    }

    assertNonEmpty(input.subjectId, 'RecognitionEvent.subjectId');
    assertNonEmpty(input.employerId, 'RecognitionEvent.employerId');
    assertTimestamp(input.recognizedAt, 'RecognitionEvent.recognizedAt');

    if (!input.verification || typeof input.verification !== 'object') {
      throw new DomainError('RecognitionEvent.verification is required', 'MISSING_VERIFICATION');
    }

    assertTimestamp(input.verification.verifiedAt, 'RecognitionEvent.verification.verifiedAt');
    assertNonEmpty(
      input.verification.verificationRef,
      'RecognitionEvent.verification.verificationRef',
    );

    if (input.expiresAt !== null) {
      assertTimestamp(input.expiresAt, 'RecognitionEvent.expiresAt');
    }

    const revocation = input.revocation ?? null;
    if (revocation) {
      assertTimestamp(revocation.revokedAt, 'RecognitionEvent.revocation.revokedAt');
      assertNonEmpty(revocation.revocationRef, 'RecognitionEvent.revocation.revocationRef');
    }

    this.recognitionId = input.recognitionId ?? generateId('rec');
    this.subjectId = input.subjectId;
    this.employerId = input.employerId;
    this.recognizedAt = input.recognizedAt;
    this.verification = Object.freeze({ ...input.verification });
    this.expiresAt = input.expiresAt;
    this.revocation = revocation ? Object.freeze({ ...revocation }) : null;

    Object.freeze(this);
  }
}
