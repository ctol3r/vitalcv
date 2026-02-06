import type { PSVReceiptSnapshot } from './PSVReceipt';

export type ReceiptValidationResult = Readonly<{
  is_valid: boolean;
  is_expired: boolean;
  is_revoked: boolean;
}>;

export type ReceiptValidationSummary = Readonly<{
  has_missing: boolean;
  has_expired: boolean;
  has_revoked: boolean;
  all_valid: boolean;
}>;

const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function parseAsEpoch(value: string | Date, field: string): number {
  if (value instanceof Date) {
    const epochMs = value.getTime();
    if (!Number.isFinite(epochMs)) {
      throw new Error(`${field} must be a valid timestamp`);
    }
    return epochMs;
  }

  if (typeof value !== 'string' || !RFC3339_UTC_REGEX.test(value)) {
    throw new Error(`${field} must be RFC3339 UTC`);
  }

  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs)) {
    throw new Error(`${field} must be a valid timestamp`);
  }

  return epochMs;
}

function isValidReceiptShape(receipt: Partial<PSVReceiptSnapshot>): boolean {
  return (
    typeof receipt?.fetched_at === 'string' &&
    RFC3339_UTC_REGEX.test(receipt.fetched_at) &&
    Number.isFinite(Date.parse(receipt.fetched_at)) &&
    Number.isInteger(receipt.ttl_seconds) &&
    (receipt.ttl_seconds as number) > 0 &&
    typeof receipt.revoked === 'boolean'
  );
}

export function validateReceipt(
  receipt: Partial<PSVReceiptSnapshot>,
  as_of: string | Date,
): ReceiptValidationResult {
  const asOfEpochMs = parseAsEpoch(as_of, 'as_of');

  if (!isValidReceiptShape(receipt)) {
    return Object.freeze({
      is_valid: false,
      is_expired: true,
      is_revoked: Boolean(receipt?.revoked),
    });
  }

  const fetchedAtEpochMs = Date.parse(receipt.fetched_at as string);
  const expiresAtEpochMs = fetchedAtEpochMs + (receipt.ttl_seconds as number) * 1000;

  const is_revoked = receipt.revoked === true;
  const is_expired = asOfEpochMs > expiresAtEpochMs;

  return Object.freeze({
    is_valid: !is_expired && !is_revoked,
    is_expired,
    is_revoked,
  });
}

export function validateReceiptSet(
  receipts: readonly Partial<PSVReceiptSnapshot>[],
  as_of: string | Date,
): ReceiptValidationSummary {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return Object.freeze({
      has_missing: true,
      has_expired: false,
      has_revoked: false,
      all_valid: false,
    });
  }

  let has_expired = false;
  let has_revoked = false;

  for (const receipt of receipts) {
    const result = validateReceipt(receipt, as_of);
    if (result.is_expired) has_expired = true;
    if (result.is_revoked) has_revoked = true;
  }

  return Object.freeze({
    has_missing: false,
    has_expired,
    has_revoked,
    all_valid: !has_expired && !has_revoked,
  });
}
