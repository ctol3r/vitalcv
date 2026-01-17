/**
 * HASH UTILITIES
 *
 * Deterministic hashing for claim values
 * No raw PII - only hashes are stored
 */

import { createHash } from 'crypto';
import { Hash, HashAlgorithm, assertHash, HASH_ALGORITHMS } from './types';

/**
 * Compute cryptographic hash of input data
 *
 * @param data - Input data to hash (string or buffer)
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Hash in format "algorithm:hexdigest"
 * @throws Never - always returns valid hash
 */
export function computeHash(
  data: string | Buffer,
  algorithm: HashAlgorithm = 'sha256'
): Hash {
  if (!HASH_ALGORITHMS.includes(algorithm)) {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  const normalizedAlgorithm = algorithm === 'blake2b256' ? 'blake2b512' : algorithm;
  const hash = createHash(normalizedAlgorithm);
  hash.update(data);

  let digest = hash.digest('hex');

  // For blake2b256, truncate to 256 bits (64 hex chars)
  if (algorithm === 'blake2b256') {
    digest = digest.substring(0, 64);
  }

  const result = `${algorithm}:${digest}`;

  // Validate result (should always pass)
  assertHash(result, 'computed hash');

  return result as Hash;
}

/**
 * Compute hash with optional salt/pepper
 *
 * @param data - Input data
 * @param salt - Optional salt (adds randomness)
 * @param pepper - Optional pepper (secret, adds security)
 * @param algorithm - Hash algorithm
 * @returns Hash
 */
export function computeHashWithSalt(
  data: string,
  salt?: string,
  pepper?: string,
  algorithm: HashAlgorithm = 'sha256'
): Hash {
  const combined = [data, salt, pepper].filter(Boolean).join('::');
  return computeHash(combined, algorithm);
}

/**
 * Verify hash matches expected value
 *
 * @param data - Original data
 * @param expectedHash - Expected hash to compare
 * @param salt - Optional salt used in original hash
 * @param pepper - Optional pepper used in original hash
 * @returns true if hash matches
 */
export function verifyHash(
  data: string,
  expectedHash: Hash,
  salt?: string,
  pepper?: string
): boolean {
  // Extract algorithm from expected hash
  const [algorithm] = expectedHash.split(':') as [HashAlgorithm, string];

  if (!HASH_ALGORITHMS.includes(algorithm)) {
    return false;
  }

  const computed = computeHashWithSalt(data, salt, pepper, algorithm);

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(computed, expectedHash);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks by ensuring comparison takes constant time
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract algorithm from hash string
 *
 * @param hash - Hash string
 * @returns Algorithm name
 * @throws If hash format is invalid
 */
export function extractAlgorithm(hash: Hash): HashAlgorithm {
  const [algorithm] = hash.split(':');

  if (!HASH_ALGORITHMS.includes(algorithm as HashAlgorithm)) {
    throw new Error(`Invalid hash algorithm in: ${hash}`);
  }

  return algorithm as HashAlgorithm;
}

/**
 * Extract digest from hash string
 *
 * @param hash - Hash string
 * @returns Hex digest
 * @throws If hash format is invalid
 */
export function extractDigest(hash: Hash): string {
  const parts = hash.split(':');

  if (parts.length !== 2) {
    throw new Error(`Invalid hash format: ${hash}`);
  }

  return parts[1];
}
