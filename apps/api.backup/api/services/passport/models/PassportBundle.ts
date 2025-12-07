import { PassportBundle, PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface PassportBundleRecordInput {
  clinicianId: string;
  bundleHash: string;
}

/**
 * Compute a deterministic SHA-256 hash for a bundle payload.
 * Accepts Buffer or string input and returns a lowercase hex digest.
 */
export function computeBundleHash(payload: Buffer | string): string {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8');
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Persist a passport bundle record for a clinician. Used to provide an audit trail
 * every time the encrypted ZIP is generated.
 */
export async function recordPassportBundle(
  input: PassportBundleRecordInput,
): Promise<PassportBundle> {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required to record a passport bundle');
  }
  if (!input.bundleHash || input.bundleHash.length < 16) {
    throw new Error('bundleHash is required and must be at least 16 characters');
  }

  return prisma.passportBundle.create({
    data: {
      clinicianId: input.clinicianId,
      bundleHash: input.bundleHash.toLowerCase(),
    },
  });
}

/**
 * Fetch the most recent bundles for a clinician. Useful for analytics and troubleshooting.
 */
export async function listRecentPassportBundles(
  clinicianId: string,
  take: number = 5,
): Promise<PassportBundle[]> {
  if (!clinicianId) {
    return [];
  }

  return prisma.passportBundle.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(take, 25),
  });
}

