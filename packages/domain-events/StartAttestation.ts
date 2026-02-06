import {
  CanonicalPrimitiveError,
  assertStartReadyCrs,
  parseRfc3339Utc,
} from '../domain-core';
import { EmployerAcceptance } from './EmployerAcceptance';
import {
  assertHashAnchor,
  assertValidProof,
  normalizeProof,
  type SignatureProof,
} from './nonRepudiation';

export type StartAttestationInput = {
  startId?: string;
  acceptance: EmployerAcceptance;
  attestedAt: string;
  crsScore: number;
  proof: SignatureProof;
  hashAnchor?: string;
};

function generateId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

export class StartAttestation {
  public readonly startId: string;
  public readonly recognitionId: string;
  public readonly acceptanceId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly attestedAt: string;
  public readonly crsScore: number;
  public readonly proof: SignatureProof;
  public readonly hashAnchor: string;

  constructor(input: StartAttestationInput) {
    if (!input || typeof input !== 'object') {
      throw new CanonicalPrimitiveError('StartAttestation input is required', 'MISSING_FIELD');
    }

    if (!(input.acceptance instanceof EmployerAcceptance)) {
      throw new CanonicalPrimitiveError(
        'StartAttestation requires an existing EmployerAcceptance',
        'INVALID_REFERENCE',
      );
    }

    if (input.acceptance.countersignedByEmployer !== true) {
      throw new CanonicalPrimitiveError(
        'StartAttestation requires explicit employer countersignature on acceptance',
        'MISSING_COUNTERSIGNATURE',
      );
    }

    assertStartReadyCrs(input.crsScore);
    parseRfc3339Utc(input.attestedAt, 'StartAttestation.attestedAt');
    assertValidProof(input.proof, 'StartAttestation.proof');

    const attestedAtTs = Date.parse(input.attestedAt);
    const countersignedAtTs = Date.parse(input.acceptance.countersignedAt);
    const recognizedAtTs = Date.parse(input.acceptance.recognitionRecognizedAt);

    if (attestedAtTs <= countersignedAtTs || attestedAtTs <= recognizedAtTs) {
      throw new CanonicalPrimitiveError(
        'StartAttestation.attestedAt must be strictly after Acceptance and Recognition',
        'TIMESTAMP_ORDER',
        {
          recognitionRecognizedAt: input.acceptance.recognitionRecognizedAt,
          acceptanceCountersignedAt: input.acceptance.countersignedAt,
          attestedAt: input.attestedAt,
        },
      );
    }

    const startId = input.startId ?? generateId('start');
    const canonicalPayload = Object.freeze({
      event_type: 'START',
      startId,
      recognitionId: input.acceptance.recognitionId,
      acceptanceId: input.acceptance.acceptanceId,
      subjectId: input.acceptance.subjectId,
      employerId: input.acceptance.employerId,
      attestedAt: input.attestedAt,
      crsScore: input.crsScore,
    });

    this.startId = startId;
    this.recognitionId = input.acceptance.recognitionId;
    this.acceptanceId = input.acceptance.acceptanceId;
    this.subjectId = input.acceptance.subjectId;
    this.employerId = input.acceptance.employerId;
    this.attestedAt = input.attestedAt;
    this.crsScore = input.crsScore;
    this.proof = normalizeProof(input.proof);
    this.hashAnchor = assertHashAnchor(input.hashAnchor, canonicalPayload);

    Object.freeze(this);
  }
}
