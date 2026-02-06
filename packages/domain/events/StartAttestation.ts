import { DomainError } from '../errors';

export type StartAttestationInput = {
  startId?: string;
  acceptanceId: string;
  subjectId: string;
  employerId: string;
  attestedAt: string;
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

export class StartAttestation {
  public readonly startId: string;
  public readonly acceptanceId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly attestedAt: string;

  constructor(input: StartAttestationInput) {
    if (!input || typeof input !== 'object') {
      throw new DomainError('StartAttestation input is required', 'MISSING_FIELD');
    }

    assertNonEmpty(input.acceptanceId, 'StartAttestation.acceptanceId');
    assertNonEmpty(input.subjectId, 'StartAttestation.subjectId');
    assertNonEmpty(input.employerId, 'StartAttestation.employerId');
    assertTimestamp(input.attestedAt, 'StartAttestation.attestedAt');

    this.startId = input.startId ?? generateId('start');
    this.acceptanceId = input.acceptanceId;
    this.subjectId = input.subjectId;
    this.employerId = input.employerId;
    this.attestedAt = input.attestedAt;

    Object.freeze(this);
  }
}
