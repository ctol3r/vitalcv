import {
  CanonicalPrimitiveError,
  assertNonEmptyString,
  assertStrictlyAfter,
  parseRfc3339Utc,
} from '../domain-core';
import { RecognitionEvent } from './RecognitionEvent';
import {
  assertHashAnchor,
  assertValidProof,
  normalizeProof,
  type SignatureProof,
} from './nonRepudiation';

export type EmployerAcceptanceInput = {
  acceptanceId?: string;
  recognition: RecognitionEvent;
  employerId?: string;
  facilityId: string;
  role?: string;
  acceptedAt: string;
  countersignedAt: string;
  countersignedByEmployer: boolean;
  employerProof: SignatureProof;
  hashAnchor?: string;
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
  public readonly role: string;
  public readonly acceptedAt: string;
  public readonly countersignedAt: string;
  public readonly countersignedByEmployer: true;
  public readonly recognitionRecognizedAt: string;
  public readonly employerProof: SignatureProof;
  public readonly hashAnchor: string;

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
    assertValidProof(input.employerProof, 'EmployerAcceptance.employerProof');

    assertNonEmptyString(input.facilityId, 'EmployerAcceptance.facilityId');
    const resolvedEmployerId = input.employerId ?? input.recognition.employerId;
    assertNonEmptyString(resolvedEmployerId, 'EmployerAcceptance.employerId');

    const resolvedRole = input.role ?? 'role:unspecified';
    assertNonEmptyString(resolvedRole, 'EmployerAcceptance.role');

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

    const acceptanceId = input.acceptanceId ?? generateId('acc');
    const canonicalPayload = Object.freeze({
      event_type: 'ACCEPTANCE',
      acceptanceId,
      recognitionId: input.recognition.recognitionId,
      subjectId: input.recognition.subjectId,
      employerId: resolvedEmployerId,
      facilityId: input.facilityId,
      role: resolvedRole,
      acceptedAt: input.acceptedAt,
      countersignedAt: input.countersignedAt,
      countersignedByEmployer: true,
      recognitionRecognizedAt: input.recognition.recognizedAt,
    });

    this.acceptanceId = acceptanceId;
    this.recognitionId = input.recognition.recognitionId;
    this.subjectId = input.recognition.subjectId;
    this.employerId = resolvedEmployerId;
    this.facilityId = input.facilityId;
    this.role = resolvedRole;
    this.acceptedAt = input.acceptedAt;
    this.countersignedAt = input.countersignedAt;
    this.countersignedByEmployer = true;
    this.recognitionRecognizedAt = input.recognition.recognizedAt;
    this.employerProof = normalizeProof(input.employerProof);
    this.hashAnchor = assertHashAnchor(input.hashAnchor, canonicalPayload);

    Object.freeze(this);
  }
}
