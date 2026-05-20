import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

import {
  CHAIN_GENESIS_MARKER,
  CHAIN_HASH_ALGORITHM,
  calculateNextHash,
  canonicalizePayload,
  verifyChainSegment,
} from '../../src/services/ledger/HashChainService';

describe('canonicalizePayload · stable ordering', () => {
  it('sorts object keys lexicographically', () => {
    const a = { c: 1, a: 2, b: 3 };
    const b = { b: 3, a: 2, c: 1 };
    expect(canonicalizePayload(a)).toBe(canonicalizePayload(b));
    expect(canonicalizePayload(a)).toBe('{"a":2,"b":3,"c":1}');
  });

  it('recurses into nested objects and arrays', () => {
    const a = { x: { z: 1, y: 2 }, arr: [{ b: 1, a: 2 }] };
    const b = { arr: [{ a: 2, b: 1 }], x: { y: 2, z: 1 } };
    expect(canonicalizePayload(a)).toBe(canonicalizePayload(b));
  });

  it('preserves null + primitive values verbatim', () => {
    expect(canonicalizePayload(null)).toBe('null');
    expect(canonicalizePayload(0)).toBe('0');
    expect(canonicalizePayload(false)).toBe('false');
    expect(canonicalizePayload('abc')).toBe('"abc"');
  });
});

describe('calculateNextHash · SHA-256 contract', () => {
  it('exposes the algorithm identifier', () => {
    expect(CHAIN_HASH_ALGORITHM).toBe('sha256');
  });

  it('is deterministic for the same input', () => {
    const p = { type: 'attestation', subject: '1356428912' };
    expect(calculateNextHash('PREV_HASH', p)).toBe(
      calculateNextHash('PREV_HASH', p),
    );
  });

  it('matches an externally-computed SHA-256(prev|canonical(payload))', () => {
    const prev = 'abc123';
    const payload = { b: 2, a: 1 };
    const canonical = '{"a":1,"b":2}';
    const expected = createHash('sha256')
      .update(prev)
      .update('|')
      .update(canonical)
      .digest('hex');
    expect(calculateNextHash(prev, payload)).toBe(expected);
  });

  it('treats empty / nullish previousHash as the GENESIS marker', () => {
    const p = { type: 'genesis_check' };
    expect(calculateNextHash('', p)).toBe(
      calculateNextHash(CHAIN_GENESIS_MARKER, p),
    );
  });

  it('genesis marker is the binding literal "GENESIS_VITALCV"', () => {
    expect(CHAIN_GENESIS_MARKER).toBe('GENESIS_VITALCV');
  });

  it('chain reacts to any payload mutation (tamper detection)', () => {
    const h1 = calculateNextHash('PREV', { a: 1, b: 2 });
    const h2 = calculateNextHash('PREV', { a: 1, b: 3 });
    expect(h1).not.toBe(h2);
  });

  it('chain reacts to any previousHash mutation', () => {
    const p = { a: 1 };
    expect(calculateNextHash('h1', p)).not.toBe(calculateNextHash('h2', p));
  });

  it('hash boundary separator prevents payload/prevHash collision', () => {
    // Without the '|' separator, `prev='AB', payload='C'` would hash the
    // same as `prev='A', payload='BC'`. The separator makes that impossible.
    const a = calculateNextHash('AB', 'C');
    const b = calculateNextHash('A', 'BC');
    expect(a).not.toBe(b);
  });
});

describe('verifyChainSegment · offline replay', () => {
  it('returns -1 when the chain reconciles end-to-end', () => {
    const payloads = [
      { e: 1 },
      { e: 2 },
      { e: 3 },
    ];
    let prev = CHAIN_GENESIS_MARKER;
    const entries = payloads.map((p) => {
      const h = calculateNextHash(prev, p);
      prev = h;
      return { payload: p, expectedHash: h };
    });
    expect(verifyChainSegment(CHAIN_GENESIS_MARKER, entries)).toBe(-1);
  });

  it('returns the index of the first divergence', () => {
    const payloads = [{ e: 1 }, { e: 2 }, { e: 3 }];
    let prev = CHAIN_GENESIS_MARKER;
    const entries = payloads.map((p) => {
      const h = calculateNextHash(prev, p);
      prev = h;
      return { payload: p, expectedHash: h };
    });
    // Tamper with entry index 1's payload
    const tampered = entries.map((e, i) =>
      i === 1 ? { ...e, payload: { e: 999 } } : e,
    );
    expect(verifyChainSegment(CHAIN_GENESIS_MARKER, tampered)).toBe(1);
  });
});
