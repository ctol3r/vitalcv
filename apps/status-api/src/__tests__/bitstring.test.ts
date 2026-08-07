/**
 * Strict Bitstring codec tests (W3C Bitstring Status List v1.0 §4.1).
 */

import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  BitstringDecodeError,
  LIST_SIZE_BITS,
  LIST_SIZE_BYTES,
  MIN_LIST_BYTES,
  decodeBitstring,
  encodeBitstring,
  getBit,
  setBit,
} from '../lib/bitstring';

function emptyList(): Buffer {
  return Buffer.alloc(LIST_SIZE_BYTES, 0);
}

describe('encodeBitstring', () => {
  it('emits base64url without padding', async () => {
    const encoded = await encodeBitstring(emptyList());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });

  it('round-trips through decodeBitstring', async () => {
    const bits = emptyList();
    setBit(bits, 0, 1);
    setBit(bits, 7, 1);
    setBit(bits, LIST_SIZE_BITS - 1, 1);

    const decoded = await decodeBitstring(await encodeBitstring(bits));
    expect(decoded.length).toBe(LIST_SIZE_BYTES);
    expect(getBit(decoded, 0)).toBe(1);
    expect(getBit(decoded, 7)).toBe(1);
    expect(getBit(decoded, LIST_SIZE_BITS - 1)).toBe(1);
    expect(getBit(decoded, 1)).toBe(0);
  });

  it('uses MSB-first bit ordering per spec §4.1', async () => {
    const bits = emptyList();
    setBit(bits, 0, 1); // first bit → most significant bit of byte 0
    expect(bits[0]).toBe(0b1000_0000);
    setBit(bits, 7, 1);
    expect(bits[0]).toBe(0b1000_0001);
  });
});

describe('decodeBitstring — strict failure modes', () => {
  it('accepts a Multibase base64url "u" prefix', async () => {
    const encoded = await encodeBitstring(emptyList());
    const decoded = await decodeBitstring(`u${encoded}`);
    expect(decoded.length).toBe(LIST_SIZE_BYTES);
  });

  it.each([
    ['empty string', ''],
    ['non-string (number)', 42 as unknown],
    ['non-string (null)', null as unknown],
    ['non-string (object)', {} as unknown],
  ])('rejects %s', async (_label, value) => {
    await expect(decodeBitstring(value)).rejects.toThrow(BitstringDecodeError);
  });

  it('rejects base64 padding characters', async () => {
    const encoded = await encodeBitstring(emptyList());
    await expect(decodeBitstring(`${encoded}==`)).rejects.toThrow(BitstringDecodeError);
  });

  it('rejects standard-base64 characters (+, /)', async () => {
    await expect(decodeBitstring('ab+cd/ef')).rejects.toThrow(BitstringDecodeError);
  });

  it('rejects base64url data that is not GZIP', async () => {
    const notGzip = Buffer.from('this is not gzip data at all').toString('base64url');
    await expect(decodeBitstring(notGzip)).rejects.toThrow(/not valid GZIP/);
  });

  it('rejects truncated GZIP data', async () => {
    const compressed = gzipSync(emptyList());
    const truncated = compressed.subarray(0, Math.floor(compressed.length / 2));
    await expect(decodeBitstring(truncated.toString('base64url'))).rejects.toThrow(
      BitstringDecodeError,
    );
  });

  it('rejects lists smaller than the 16 KiB spec minimum', async () => {
    const tiny = gzipSync(Buffer.alloc(MIN_LIST_BYTES - 1, 0));
    await expect(decodeBitstring(tiny.toString('base64url'))).rejects.toThrow(
      /spec minimum/,
    );
  });
});

describe('getBit / setBit range guards', () => {
  it('throws on out-of-range reads instead of returning 0', () => {
    const bits = emptyList();
    expect(() => getBit(bits, LIST_SIZE_BITS)).toThrow(RangeError);
    expect(() => getBit(bits, -1)).toThrow(RangeError);
    expect(() => getBit(bits, 1.5)).toThrow(RangeError);
  });

  it('throws on out-of-range writes', () => {
    const bits = emptyList();
    expect(() => setBit(bits, LIST_SIZE_BITS, 1)).toThrow(RangeError);
  });
});
