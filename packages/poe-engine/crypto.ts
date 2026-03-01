import { createHash } from 'node:crypto';

/**
 * SHA-256 hash returning lowercase hex.
 * Mirrors apps/api/backend/src/utils/deterministic.ts:sha256Hex
 */
export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Hash-concat for Merkle tree internal nodes.
 * Mirrors apps/api/backend/src/utils/merkle.ts:hashMerkleConcat
 */
export function hashMerkleConcat(left: string, right: string): string {
  return sha256Hex(`${left}${right}`);
}
