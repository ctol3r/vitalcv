import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';

describe('canonicalize', () => {
  it('produces identical output for different key orders', () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('handles nested objects with different key orders', () => {
    const a = { outer: { z: 1, a: 2 }, first: true };
    const b = { first: true, outer: { a: 2, z: 1 } };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('preserves array order', () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });

  it('handles null and undefined', () => {
    expect(canonicalize(null)).toBe('null');
    expect(canonicalize(undefined)).toBeUndefined();
  });

  it('handles primitives', () => {
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(true)).toBe('true');
  });

  it('sorts keys at every level of nesting', () => {
    const input = { c: { f: 1, e: { h: 2, g: 3 } }, a: 4, b: 5 };
    const expected = '{"a":4,"b":5,"c":{"e":{"g":3,"h":2},"f":1}}';
    expect(canonicalize(input)).toBe(expected);
  });
});

describe('sha256', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = sha256('test');
    const hash2 = sha256('test');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different input', () => {
    const hash1 = sha256('test1');
    const hash2 = sha256('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 64-character hex string', () => {
    const hash = sha256('anything');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalize + sha256 integration', () => {
  it('same object with different key order produces same hash', () => {
    const a = { provider: { npi: '123', name: 'Test' }, status: 'ACTIVE' };
    const b = { status: 'ACTIVE', provider: { name: 'Test', npi: '123' } };
    expect(sha256(canonicalize(a))).toBe(sha256(canonicalize(b)));
  });

  it('changing one value changes the hash', () => {
    const a = { npi: '123', status: 'ACTIVE' };
    const b = { npi: '123', status: 'INACTIVE' };
    expect(sha256(canonicalize(a))).not.toBe(sha256(canonicalize(b)));
  });
});
