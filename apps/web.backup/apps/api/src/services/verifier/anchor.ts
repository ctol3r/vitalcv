import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

/**
 * Anchor verifier check hash to blockchain
 */
export async function anchorVerifierCheck(
  verifierId: string,
  result: Record<string, unknown>,
): Promise<void> {
  // Store check
  await prisma.verifierCheck.create({
    data: {
      verifierId,
      result,
      timestamp: new Date(),
    },
  });

  // Anchor to blockchain
  anchorEvent('verifierCheckAnchored', {
    verifierId,
    checkHash: JSON.stringify(result),
    timestamp: new Date().toISOString(),
  });
}

