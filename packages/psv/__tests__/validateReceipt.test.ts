import { describe, expect, it } from 'vitest';
import { PSVReceipt } from '../PSVReceipt';
import { resolveReceiptStatus, validateReceipt } from '../validateReceipt';

describe('PSV receipt status resolution', () => {
  it('resolves VALID | EXPIRED | REVOKED explicitly', () => {
    const base = {
      receipt_id: '11111111-1111-4111-8111-111111111111',
      source_authority: 'ABMS' as const,
      access_or_license_id: 'LIC-1',
      transaction_id: 'txn-1',
      fetched_at: '2026-02-06T10:00:00.000Z',
      response_hash: 'a'.repeat(64),
      ttl_seconds: 60,
      revoked: false,
    };

    expect(resolveReceiptStatus(base, '2026-02-06T10:00:30.000Z')).toBe('VALID');
    expect(resolveReceiptStatus(base, '2026-02-06T10:02:00.000Z')).toBe('EXPIRED');
    expect(resolveReceiptStatus({ ...base, revoked: true }, '2026-02-06T10:00:30.000Z')).toBe('REVOKED');
  });

  it('fails closed for malformed receipts', () => {
    const malformed = {
      receipt_id: 'bad',
      fetched_at: 'not-a-time',
      ttl_seconds: 0,
      revoked: false,
    };

    const result = validateReceipt(malformed, '2026-02-06T10:00:00.000Z');
    expect(result.status).toBe('EXPIRED');
    expect(result.is_valid).toBe(false);
  });

  it('keeps receipts immutable after creation', () => {
    const receipt = PSVReceipt.create({
      source_authority: 'ABMS',
      access_or_license_id: 'LIC-IMMUTABLE',
      transaction_id: 'txn-immutable',
      fetched_at: '2026-02-06T10:00:00.000Z',
      raw_response: '{"status":"ok"}',
      ttl_seconds: 60,
    });

    expect(() => {
      (receipt as { revoked: boolean }).revoked = true;
    }).toThrow();

    expect(receipt.revoked).toBe(false);
  });
});
