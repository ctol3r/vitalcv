import {
  CanonicalPrimitiveError,
  assertNonEmptyString,
  parseRfc3339Utc,
  type PsvReceiptSnapshot,
  validateReceiptSet,
} from '../domain-core';
import {
  assertHashAnchor,
  assertValidProof,
  normalizeProof,
  type SignatureProof,
} from './nonRepudiation';

export type RecognitionEventInput = {
  recognitionId?: string;
  subjectId: string;
  employerId: string;
  recognizedAt: string;
  psvReceipts: readonly PsvReceiptSnapshot[];
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

export class RecognitionEvent {
  public readonly recognitionId: string;
  public readonly subjectId: string;
  public readonly employerId: string;
  public readonly recognizedAt: string;
  public readonly psvReceiptIds: readonly string[];
  public readonly lastVerifiedAt: string;
  public readonly proof: SignatureProof;
  public readonly hashAnchor: string;

  constructor(input: RecognitionEventInput) {
    if (!input || typeof input !== 'object') {
      throw new CanonicalPrimitiveError('RecognitionEvent input is required', 'MISSING_FIELD');
    }

    assertNonEmptyString(input.subjectId, 'RecognitionEvent.subjectId');
    assertNonEmptyString(input.employerId, 'RecognitionEvent.employerId');
    parseRfc3339Utc(input.recognizedAt, 'RecognitionEvent.recognizedAt');
    assertValidProof(input.proof, 'RecognitionEvent.proof');

    const receiptSet = validateReceiptSet(input.psvReceipts, input.recognizedAt);
    if (receiptSet.receiptIds.length === 0) {
      throw new CanonicalPrimitiveError(
        'RecognitionEvent requires at least one PSV receipt',
        'MISSING_PSV_RECEIPTS',
      );
    }

    const recognitionId = input.recognitionId ?? generateId('rec');
    const canonicalPayload = Object.freeze({
      event_type: 'RECOGNITION',
      recognitionId,
      subjectId: input.subjectId,
      employerId: input.employerId,
      recognizedAt: input.recognizedAt,
      psvReceiptIds: receiptSet.receiptIds,
      lastVerifiedAt: receiptSet.lastVerifiedAt,
    });

    this.recognitionId = recognitionId;
    this.subjectId = input.subjectId;
    this.employerId = input.employerId;
    this.recognizedAt = input.recognizedAt;
    this.psvReceiptIds = Object.freeze([...receiptSet.receiptIds]);
    this.lastVerifiedAt = receiptSet.lastVerifiedAt;
    this.proof = normalizeProof(input.proof);
    this.hashAnchor = assertHashAnchor(input.hashAnchor, canonicalPayload);

    Object.freeze(this);
  }
}
