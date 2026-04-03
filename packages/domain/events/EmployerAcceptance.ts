import { DomainError } from '@vitalcv/domain-common';

export type EmployerAcceptanceInput = {
  acceptanceId?: string;
  recognitionId: string;
  subjectId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: string;
  psvReportId: string;
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

export class EmployerAcceptance {
  public readonly acceptanceId: string;
  public readonly recognitionId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly facilityId: string;
  public readonly acceptedAt: string;
  public readonly psvReportId: string;

  constructor(input: EmployerAcceptanceInput) {
    if (!input || typeof input !== 'object') {
      throw new DomainError('EmployerAcceptance input is required', 'MISSING_FIELD');
    }

    assertNonEmpty(input.recognitionId, 'EmployerAcceptance.recognitionId');
    assertNonEmpty(input.subjectId, 'EmployerAcceptance.subjectId');
    assertNonEmpty(input.employerId, 'EmployerAcceptance.employerId');
    assertNonEmpty(input.facilityId, 'EmployerAcceptance.facilityId');
    assertTimestamp(input.acceptedAt, 'EmployerAcceptance.acceptedAt');
    assertNonEmpty(input.psvReportId, 'EmployerAcceptance.psvReportId');

    this.acceptanceId = input.acceptanceId ?? generateId('acc');
    this.recognitionId = input.recognitionId;
    this.subjectId = input.subjectId;
    this.employerId = input.employerId;
    this.facilityId = input.facilityId;
    this.acceptedAt = input.acceptedAt;
    this.psvReportId = input.psvReportId;

    Object.freeze(this);
  }
}
