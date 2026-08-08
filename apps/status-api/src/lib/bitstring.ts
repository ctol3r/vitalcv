/**
 * bitstring.ts — W3C Bitstring Status List v1.0 codec.
 * https://www.w3.org/TR/vc-bitstring-status-list/
 *
 * `encodedList` per spec §4.1:
 *   base64url (RFC 4648 §5, NO padding) encoding of the GZIP-compressed
 *   (RFC 1952) bitstring. Spec-conformant producers MAY prefix the value
 *   with the Multibase base64url header `u`; the decoder tolerates it
 *   (GZIP data base64url-encodes to a string starting with `H4sI`, so the
 *   prefix is unambiguous). This service EMITS plain base64url without the
 *   prefix, matching the backend implementation in
 *   apps/api/backend/src/services/ledger/statusListManager.ts.
 *
 * Decoding is STRICT and throws `BitstringDecodeError` on any deviation —
 * callers (the fail-closed verifier) treat every throw as "unverifiable",
 * never as "not revoked".
 */

import { promisify } from 'node:util';
import zlib from 'node:zlib';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

/** W3C Bitstring Status List §4.1 — minimum list size (131,072 bits = 16 KiB). */
export const LIST_SIZE_BITS = 131_072;
export const LIST_SIZE_BYTES = LIST_SIZE_BITS / 8;

/** Minimum UNCOMPRESSED size the spec requires of any list (16 KiB). */
export const MIN_LIST_BYTES = 16_384;

export class BitstringDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitstringDecodeError';
  }
}

/** RFC 4648 §5 alphabet, no padding. */
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

/**
 * GZIP-compress a bitstring buffer and encode as base64url without padding.
 */
export async function encodeBitstring(bits: Buffer): Promise<string> {
  const compressed = await gzipAsync(bits);
  return compressed.toString('base64url');
}

/**
 * Strictly decode an `encodedList` value into the uncompressed bitstring.
 *
 * Throws `BitstringDecodeError` when the value:
 *  - is not a non-empty string,
 *  - contains characters outside the base64url alphabet (including `=` padding
 *    and the `+` / `/` characters of standard base64),
 *  - does not decompress as GZIP (wrong container, truncated, corrupted),
 *  - decompresses to fewer than the spec-minimum 16 KiB.
 */
export async function decodeBitstring(encodedList: unknown): Promise<Buffer> {
  if (typeof encodedList !== 'string' || encodedList.length === 0) {
    throw new BitstringDecodeError('encodedList must be a non-empty string.');
  }

  // Tolerate the Multibase base64url header `u` (see module header). GZIP
  // payloads always encode to a string starting with `H4sI`, so a leading
  // `u` can only be the Multibase prefix.
  const body = encodedList.startsWith('u') ? encodedList.slice(1) : encodedList;

  if (body.length === 0 || !BASE64URL_RE.test(body)) {
    throw new BitstringDecodeError(
      'encodedList is not base64url (RFC 4648 §5, no padding).',
    );
  }

  const compressed = Buffer.from(body, 'base64url');

  // Buffer.from(base64url) silently ignores nothing here (charset already
  // validated), but a round-trip guard catches length-corrupting input.
  if (compressed.length === 0) {
    throw new BitstringDecodeError('encodedList decoded to zero bytes.');
  }

  let bits: Buffer;
  try {
    bits = await gunzipAsync(compressed);
  } catch (err) {
    throw new BitstringDecodeError(
      `encodedList is not valid GZIP data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (bits.length < MIN_LIST_BYTES) {
    throw new BitstringDecodeError(
      `Decompressed bitstring is ${bits.length} bytes; spec minimum is ${MIN_LIST_BYTES}.`,
    );
  }

  return Buffer.from(bits);
}

/**
 * Read a single bit (MSB-first per spec §4.1).
 * Callers MUST range-check `index` first; out-of-range throws.
 */
export function getBit(bits: Buffer, index: number): 0 | 1 {
  assertIndexInRange(bits, index);
  const byteIndex = Math.floor(index / 8);
  const bitPos = 7 - (index % 8);
  return ((bits[byteIndex] >> bitPos) & 1) as 0 | 1;
}

/**
 * Set a single bit (MSB-first per spec §4.1).
 */
export function setBit(bits: Buffer, index: number, value: 0 | 1): void {
  assertIndexInRange(bits, index);
  const byteIndex = Math.floor(index / 8);
  const bitPos = 7 - (index % 8);
  if (value === 1) {
    bits[byteIndex] |= 1 << bitPos;
  } else {
    bits[byteIndex] &= ~(1 << bitPos);
  }
}

function assertIndexInRange(bits: Buffer, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= bits.length * 8) {
    throw new RangeError(
      `Bit index ${index} out of range for list of ${bits.length * 8} bits.`,
    );
  }
}
