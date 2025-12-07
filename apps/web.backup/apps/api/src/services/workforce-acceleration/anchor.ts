import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

/**
 * Anchor acceleration snapshot to blockchain
 */
export async function anchorAccelerationSnapshot(
  clinicianId: string,
  signals: Record<string, unknown>,
): Promise<void> {
  // Store signals
  await prisma.accelerationSignal.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      signals,
      updatedAt: new Date(),
    },
    update: {
      signals,
      updatedAt: new Date(),
    },
  });

  // Anchor to blockchain
  anchorEvent('accelerationAnchored', {
    clinicianId,
    signalHash: JSON.stringify(signals),
    timestamp: new Date().toISOString(),
  });
}

