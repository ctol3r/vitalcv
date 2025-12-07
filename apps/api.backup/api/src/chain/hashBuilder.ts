/**
 * Hash Input Builder for On-Chain Anchoring
 * Task 201.13 - Deterministic hash builder for pallet extrinsic
 *
 * Creates deterministic hashes from credential data for on-chain anchoring
 */

import { createHash } from 'crypto';

export interface CredentialHashInput {
  id: string;
  issuer: string;
  subject: string;
  issuanceDate: string;
  credentialType: string[];
  proof?: any;
}

/**
 * Build deterministic hash for credential anchoring
 * Task 201.13
 */
export function buildCredentialHash(input: CredentialHashInput): string {
  // Create canonical representation for hashing
  const canonical = {
    id: input.id,
    issuer: input.issuer,
    subject: input.subject,
    issuanceDate: input.issuanceDate,
    type: input.credentialType.sort(), // Sort for determinism
  };

  // Create deterministic JSON string
  const jsonString = JSON.stringify(canonical, Object.keys(canonical).sort());

  // Hash with SHA-256
  const hash = createHash('sha256')
    .update(jsonString)
    .digest('hex');

  return `0x${hash}`;
}

/**
 * Build hash from arbitrary data
 */
export function buildDataHash(data: any): string {
  const jsonString = typeof data === 'string'
    ? data
    : JSON.stringify(data);

  const hash = createHash('sha256')
    .update(jsonString)
    .digest('hex');

  return `0x${hash}`;
}

/**
 * Build merkle root from multiple hashes
 */
export function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    throw new Error('Cannot build merkle root from empty array');
  }

  if (hashes.length === 1) {
    return hashes[0];
  }

  // Build merkle tree layer by layer
  let currentLayer = hashes.map(h => h.replace('0x', ''));

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        // Combine two hashes
        const combined = currentLayer[i] + currentLayer[i + 1];
        const hash = createHash('sha256').update(combined, 'hex').digest('hex');
        nextLayer.push(hash);
      } else {
        // Odd one out, promote to next layer
        nextLayer.push(currentLayer[i]);
      }
    }

    currentLayer = nextLayer;
  }

  return `0x${currentLayer[0]}`;
}

/**
 * Validate hash format
 */
export function isValidHash(hash: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(hash);
}

/**
 * Convert hash to bytes
 */
export function hashToBytes(hash: string): Uint8Array {
  const cleanHash = hash.replace('0x', '');
  const bytes = new Uint8Array(cleanHash.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHash.substr(i * 2, 2), 16);
  }

  return bytes;
}

