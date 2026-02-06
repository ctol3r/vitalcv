import {
  CanonicalPrimitiveError,
  assertNonEmptyString,
  parseRfc3339Utc,
  type PsvReceiptSnapshot,
  validateReceiptSet,
} from '../domain-core';

export type RecognitionEventInput = {
  recognitionId?: string;
  subjectId: string;
  employerId: string;
  recognizedAt: string;
  psvReceipts: readonly PsvReceiptSnapshot[];
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

  constructor(input: RecognitionEventInput) {
    if (!input || typeof input !== 'object') {
      throw new CanonicalPrimitiveError('RecognitionEvent input is required', 'MISSING_FIELD');
    }

    assertNonEmptyString(input.subjectId, 'RecognitionEvent.subjectId');
    assertNonEmptyString(input.employerId, 'RecognitionEvent.employerId');
    parseRfc3339Utc(input.recognizedAt, 'RecognitionEvent.recognizedAt');

    const receiptSet = validateReceiptSet(input.psvReceipts, input.recognizedAt);
    if (receiptSet.receiptIds.length === 0) {
      throw new CanonicalPrimitiveError(
        'RecognitionEvent requires at least one PSV receipt',
        'MISSING_PSV_RECEIPTS',
      );
    }

    this.recognitionId = input.recognitionId ?? generateId('rec');
    this.subjectId = input.subjectId;
    this.employerId = input.employerId;
    this.recognizedAt = input.recognizedAt;
    this.psvReceiptIds = Object.freeze([...receiptSet.receiptIds]);
    this.lastVerifiedAt = receiptSet.lastVerifiedAt;

    Object.freeze(this);
  }
}
