export type CanonicalPrimitiveErrorCode =
  | 'MISSING_FIELD'
  | 'INVALID_FIELD'
  | 'INVALID_TIMESTAMP'
  | 'MISSING_PSV_RECEIPTS'
  | 'PSV_RECEIPT_EXPIRED'
  | 'PSV_RECEIPT_REVOKED'
  | 'INVALID_REFERENCE'
  | 'MISSING_COUNTERSIGNATURE'
  | 'TIMESTAMP_ORDER'
  | 'CRS_BELOW_THRESHOLD'
  | 'START_EXISTS';

export class CanonicalPrimitiveError extends Error {
  constructor(
    message: string,
    public readonly code: CanonicalPrimitiveErrorCode,
    public readonly context?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'CanonicalPrimitiveError';
  }
}
