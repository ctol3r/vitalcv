import {
  type PSVReceiptSnapshot,
  type SourceAuthority,
  resolveReceiptStatus,
  type ReceiptStatus,
} from '@vitalcv/psv';

export type ReceiptSource = SourceAuthority;

export type FreshnessWindow = Readonly<{
  fetched_at: string;
  ttl_seconds: number;
}>;

export type VerificationReceipt = PSVReceiptSnapshot;

export type VerificationReceiptStatus = ReceiptStatus;

export function resolveVerificationReceiptStatus(
  receipt: VerificationReceipt,
  asOf: string,
): VerificationReceiptStatus {
  return resolveReceiptStatus(receipt, asOf);
}
