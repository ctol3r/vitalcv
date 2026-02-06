import {
  CanonicalPrimitiveError,
  assertNonEmptyString,
  assertStrictlyAfter,
  parseRfc3339Utc,
} from '../domain-core';
import { RecognitionEvent } from './RecognitionEvent';

export type EmployerAcceptanceInput = {
  acceptanceId?: string;
  recognition: RecognitionEvent;
  facilityId: string;
  acceptedAt: string;
  countersignedAt: string;
  countersignedByEmployer: boolean;
};

function generateId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export class EmployerAcceptance {
  public readonly acceptanceId: string;
  public readonly recognitionId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly facilityId: string;
  public readonly acceptedAt: string;
  public readonly countersignedAt: string;
  public readonly countersignedByEmployer: true;
  public readonly recognitionRecognizedAt: string;

  constructor(input: EmployerAcceptanceInput) {
    if (!input || typeof input !== 'object') {
      throw new CanonicalPrimitiveError('EmployerAcceptance input is required', 'MISSING_FIELD');
    }

    if (!(input.recognition instanceof RecognitionEvent)) {
      throw new CanonicalPrimitiveError(
        'EmployerAcceptance requires an existing RecognitionEvent',
        'INVALID_REFERENCE',
      );
    }

    if (input.recognition.psvReceiptIds.length === 0) {
      throw new CanonicalPrimitiveError(
        'EmployerAcceptance requires a RecognitionEvent with valid PSV receipts',
        'MISSING_PSV_RECEIPTS',
      );
    }

    if (input.countersignedByEmployer !== true) {
      throw new CanonicalPrimitiveError(
        'EmployerAcceptance must be explicitly countersigned by employer',
        'MISSING_COUNTERSIGNATURE',
      );
    }

    assertNonEmptyString(input.facilityId, 'EmployerAcceptance.facilityId');
    parseRfc3339Utc(input.acceptedAt, 'EmployerAcceptance.acceptedAt');
    parseRfc3339Utc(input.countersignedAt, 'EmployerAcceptance.countersignedAt');

    assertStrictlyAfter(
      input.recognition.recognizedAt,
      input.acceptedAt,
      'RecognitionEvent.recognizedAt',
      'EmployerAcceptance.acceptedAt',
    );

    const acceptedAtTs = Date.parse(input.acceptedAt);
    const countersignedAtTs = Date.parse(input.countersignedAt);
    if (countersignedAtTs < acceptedAtTs) {
      throw new CanonicalPrimitiveError(
        'EmployerAcceptance.countersignedAt must be at or after acceptedAt',
        'TIMESTAMP_ORDER',
      );
    }

    this.acceptanceId = input.acceptanceId ?? generateId('acc');
    this.recognitionId = input.recognition.recognitionId;
    this.subjectId = input.recognition.subjectId;
    this.employerId = input.recognition.employerId;
    this.facilityId = input.facilityId;
    this.acceptedAt = input.acceptedAt;
    this.countersignedAt = input.countersignedAt;
    this.countersignedByEmployer = true;
    this.recognitionRecognizedAt = input.recognition.recognizedAt;

    Object.freeze(this);
  }
}
