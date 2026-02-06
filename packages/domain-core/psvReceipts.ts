import { CanonicalPrimitiveError } from './errors';
import { parseRfc3339Utc, assertNonEmptyString } from './timestamps';

export type PsvReceiptSnapshot = Readonly<{
  receiptId: string;
  fetchedAt: string;
  ttlSeconds: number;
  revoked: boolean;
}>;

export type ValidReceiptSet = Readonly<{
  receiptIds: readonly string[];
  lastVerifiedAt: string;
}>;

function assertTtlSeconds(value: unknown, fieldName: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new CanonicalPrimitiveError(`${fieldName} must be a positive integer`, 'INVALID_FIELD', {
      fieldName,
      value,
    });
  }
}

export function validateReceiptSet(
  receipts: readonly PsvReceiptSnapshot[],
  asOf: string,
): ValidReceiptSet {
  const asOfTs = parseRfc3339Utc(asOf, 'asOf');

  if (!Array.isArray(receipts) || receipts.length === 0) {
    throw new CanonicalPrimitiveError(
      'At least one PSV receipt is required',
      'MISSING_PSV_RECEIPTS',
      {
        receiptCount: Array.isArray(receipts) ? receipts.length : null,
      },
    );
  }

  const uniqueIds = new Set<string>();
  let latestReceiptTs = 0;

  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== 'object') {
      throw new CanonicalPrimitiveError('Invalid PSV receipt payload', 'INVALID_FIELD');
    }

    assertNonEmptyString(receipt.receiptId, 'psvReceipt.receiptId');
    if (uniqueIds.has(receipt.receiptId)) {
      throw new CanonicalPrimitiveError('Duplicate PSV receipt ID', 'INVALID_FIELD', {
        receiptId: receipt.receiptId,
      });
    }
    uniqueIds.add(receipt.receiptId);

    const fetchedAtTs = parseRfc3339Utc(receipt.fetchedAt, 'psvReceipt.fetchedAt');
    assertTtlSeconds(receipt.ttlSeconds, 'psvReceipt.ttlSeconds');

    if (receipt.revoked === true) {
      throw new CanonicalPrimitiveError('PSV receipt is revoked', 'PSV_RECEIPT_REVOKED', {
        receiptId: receipt.receiptId,
      });
    }

    const expiresAtTs = fetchedAtTs + receipt.ttlSeconds * 1000;
    if (asOfTs > expiresAtTs) {
      throw new CanonicalPrimitiveError('PSV receipt is expired', 'PSV_RECEIPT_EXPIRED', {
        receiptId: receipt.receiptId,
        fetchedAt: receipt.fetchedAt,
        ttlSeconds: receipt.ttlSeconds,
      });
    }

    latestReceiptTs = Math.max(latestReceiptTs, fetchedAtTs);
  }

  const sortedIds = Object.freeze([...uniqueIds].sort());
  const lastVerifiedAt = new Date(latestReceiptTs).toISOString();

  return Object.freeze({
    receiptIds: sortedIds,
    lastVerifiedAt,
  });
}
