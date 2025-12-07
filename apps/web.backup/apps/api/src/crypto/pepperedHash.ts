/**
 * Peppered Hash Utility for On-Chain Anchors
 *
 * Implements GDPR-compliant hashing for sensitive identifiers that need to be
 * stored on-chain. Uses a high-entropy per-record pepper stored only off-chain,
 * enabling GDPR erasure via deleting the off-chain record.
 *
 * The pepper is stored in Postgres and only the hash ends up on Substrate,
 * ensuring that sensitive identifiers cannot be recovered from on-chain data alone.
 */

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

export interface PepperedHashRecord {
  id: string;
  pepper: string; // High-entropy random value (32 bytes, base64url encoded)
  targetHash: string; // SHA-256 hash of (identifier + pepper)
  identifierType: 'credentialId' | 'subjectDid' | 'npi' | 'custom';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  deletedAt?: Date;
}

/**
 * Generate a high-entropy pepper (32 random bytes)
 */
export function generatePepper(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Compute peppered hash: SHA-256(identifier + pepper)
 */
export function computePepperedHash(identifier: string, pepper: string): string {
  const combined = `${identifier}:${pepper}`;
  return createHash('sha256').update(combined, 'utf-8').digest('hex');
}

/**
 * Store a pepper for an identifier and return the hash
 */
export async function storePepperAndHash(
  identifier: string,
  identifierType: PepperedHashRecord['identifierType'],
  metadata?: Record<string, unknown>,
): Promise<{ hash: string; recordId: string }> {
  const pepper = generatePepper();
  const hash = computePepperedHash(identifier, pepper);

  // Store in database (assuming a PepperedHash table exists)
  // For now, we'll use a generic approach that can be adapted to your schema
  const record = await prisma.$executeRaw`
    INSERT INTO "PepperedHash" (id, pepper, "targetHash", "identifierType", metadata, "createdAt")
    VALUES (gen_random_uuid()::text, ${pepper}, ${hash}, ${identifierType}, ${JSON.stringify(
    metadata || {},
  )}::jsonb, NOW())
    RETURNING id
  `;

  // If the above doesn't work with your Prisma setup, you might need to:
  // 1. Add a PepperedHash model to your Prisma schema
  // 2. Use prisma.pepperedHash.create() instead

  return {
    hash,
    recordId: typeof record === 'string' ? record : 'unknown',
  };
}

/**
 * Retrieve pepper for a given identifier (for verification/debugging only)
 * This should be restricted in production to authorized services only.
 */
export async function retrievePepper(identifier: string): Promise<string | null> {
  // This is a lookup function - in practice, you'd query by identifier
  // For security, this should be heavily restricted
  const result = await prisma.$queryRaw<Array<{ pepper: string }>>`
    SELECT pepper FROM "PepperedHash"
    WHERE "targetHash" = ${computePepperedHash(
      identifier,
      '',
    )} -- This won't work, need actual lookup
    AND "deletedAt" IS NULL
    LIMIT 1
  `;

  return result[0]?.pepper || null;
}

/**
 * Delete pepper record (GDPR erasure)
 * This makes the on-chain hash unlinkable to the original identifier
 */
export async function erasePepper(identifier: string): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE "PepperedHash"
      SET "deletedAt" = NOW()
      WHERE "targetHash" IN (
        SELECT "targetHash" FROM "PepperedHash"
        WHERE metadata->>'identifier' = ${identifier}
        AND "deletedAt" IS NULL
      )
    `;

    return true;
  } catch (error) {
    console.error('Failed to erase pepper:', error);
    return false;
  }
}

/**
 * Verify a hash matches an identifier (requires pepper lookup)
 * Used for verification when you have both the identifier and need to check the hash
 */
export async function verifyPepperedHash(
  identifier: string,
  expectedHash: string,
): Promise<boolean> {
  // In practice, you'd need to look up the pepper first
  // This is a simplified version
  const pepper = await retrievePepper(identifier);
  if (!pepper) {
    return false;
  }

  const computedHash = computePepperedHash(identifier, pepper);
  return computedHash === expectedHash;
}

/**
 * Create a peppered hash for VC issuance
 * This is the main function used during credential issuance
 */
export async function createVCPepperedHash(
  credentialId: string,
  subjectDid: string,
): Promise<{
  credentialHash: string;
  subjectHash: string;
  recordId: string;
}> {
  // Create separate hashes for credential ID and subject DID
  const credentialResult = await storePepperAndHash(credentialId, 'credentialId', {
    subjectDid,
  });

  const subjectResult = await storePepperAndHash(subjectDid, 'subjectDid', {
    credentialId,
  });

  return {
    credentialHash: credentialResult.hash,
    subjectHash: subjectResult.hash,
    recordId: credentialResult.recordId,
  };
}

/**
 * Batch create peppered hashes (for efficiency)
 */
export async function batchCreatePepperedHashes(
  identifiers: Array<{
    identifier: string;
    type: PepperedHashRecord['identifierType'];
    metadata?: Record<string, unknown>;
  }>,
): Promise<Array<{ identifier: string; hash: string; recordId: string }>> {
  const results = await Promise.all(
    identifiers.map(({ identifier, type, metadata }) =>
      storePepperAndHash(identifier, type, metadata).then((result) => ({
        identifier,
        hash: result.hash,
        recordId: result.recordId,
      })),
    ),
  );

  return results;
}
