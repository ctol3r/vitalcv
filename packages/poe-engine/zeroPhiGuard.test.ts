import { describe, it, expect } from 'vitest';
import { assertHashOnlyAnchor, isHashOnlyAnchor, PhiOnChainError } from './zeroPhiGuard';

const SHA256 = 'a'.repeat(64);
const SHA256_0X = `0x${'b'.repeat(64)}`;
const SHA512 = 'c'.repeat(128);

describe('assertHashOnlyAnchor — accepts hashes', () => {
  it('accepts a bare sha256 hex', () => {
    expect(() => assertHashOnlyAnchor(SHA256)).not.toThrow();
  });
  it('accepts a 0x-prefixed hash', () => {
    expect(() => assertHashOnlyAnchor(SHA256_0X)).not.toThrow();
  });
  it('accepts a sha512 hex', () => {
    expect(() => assertHashOnlyAnchor(SHA512)).not.toThrow();
  });
  it('accepts an array of hashes', () => {
    expect(() => assertHashOnlyAnchor([SHA256, SHA256_0X])).not.toThrow();
  });
  it('accepts the canonical anchor object shape', () => {
    expect(() =>
      assertHashOnlyAnchor({ merkleRoot: SHA256, eventCount: 12, block: 1730000000 }),
    ).not.toThrow();
    expect(() =>
      assertHashOnlyAnchor({ payload_hash: SHA256, extrinsic_index: 3 }),
    ).not.toThrow();
  });
});

describe('assertHashOnlyAnchor — fails closed on non-hashes / PHI', () => {
  it('rejects a free-form string', () => {
    expect(() => assertHashOnlyAnchor('Dr. Jane Smith')).toThrow(PhiOnChainError);
  });
  it('rejects an email (PHI pattern)', () => {
    try {
      assertHashOnlyAnchor('jane@example.com');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PhiOnChainError);
      expect((e as PhiOnChainError).reason).toMatch(/email/);
    }
  });
  it('rejects a bare 10-digit NPI', () => {
    expect(() => assertHashOnlyAnchor('1457128589')).toThrow(/npi/);
  });
  it('rejects an SSN', () => {
    expect(() => assertHashOnlyAnchor('123-45-6789')).toThrow(PhiOnChainError);
  });
  it('rejects a non-hash field value', () => {
    expect(() => assertHashOnlyAnchor({ merkleRoot: 'not-a-hash' })).toThrow(/must be a hash/);
  });
  it('rejects an unallowlisted (free-form) field', () => {
    expect(() =>
      assertHashOnlyAnchor({ merkleRoot: SHA256, patientName: 'Jane' }),
    ).toThrow(/not an allowlisted/);
  });
  it('rejects a non-numeric metadata field', () => {
    expect(() => assertHashOnlyAnchor({ block: 'soon' })).toThrow(/finite number/);
  });
  it('rejects an array with a non-hash element', () => {
    expect(() => assertHashOnlyAnchor([SHA256, 'oops'])).toThrow(/not a hash/);
  });
  it('rejects null / numbers / booleans', () => {
    expect(() => assertHashOnlyAnchor(null)).toThrow(PhiOnChainError);
    expect(() => assertHashOnlyAnchor(42)).toThrow(PhiOnChainError);
    expect(() => assertHashOnlyAnchor(true)).toThrow(PhiOnChainError);
  });
});

describe('isHashOnlyAnchor', () => {
  it('returns true/false without throwing', () => {
    expect(isHashOnlyAnchor(SHA256)).toBe(true);
    expect(isHashOnlyAnchor('Jane Smith')).toBe(false);
  });
});
