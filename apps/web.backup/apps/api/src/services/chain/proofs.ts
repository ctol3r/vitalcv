import { PrismaClient } from '@prisma/client';

export interface BlockProofPayload {
  eventId: string;
  blockHash: string;
  merklePath: string[];
  eventType: string;
  palletName?: string;
  timestamp: string;
}

const prisma = initializePrisma();

export async function recordBlockProof(payload: BlockProofPayload): Promise<void> {
  if (!prisma) return;
  const delegate = (prisma as any).blockProof;
  if (!delegate?.upsert) return;

  try {
    await delegate.upsert({
      where: { eventId: payload.eventId },
      update: {
        blockHash: payload.blockHash,
        merklePath: payload.merklePath,
        eventType: payload.eventType,
        palletName: payload.palletName ?? 'audit.scrapbook',
        timestamp: payload.timestamp,
      },
      create: {
        eventId: payload.eventId,
        blockHash: payload.blockHash,
        merklePath: payload.merklePath,
        eventType: payload.eventType,
        palletName: payload.palletName ?? 'audit.scrapbook',
        timestamp: payload.timestamp,
      },
    });
  } catch (error) {
    console.warn('[chain][proofs] failed to persist block proof', error);
  }
}

export async function getBlockProof(eventId: string) {
  if (!prisma) return null;
  const delegate = (prisma as any).blockProof;
  if (!delegate?.findUnique) return null;
  try {
    return await delegate.findUnique({ where: { eventId } });
  } catch (error) {
    console.warn('[chain][proofs] failed to fetch block proof', error);
    return null;
  }
}

export async function getBlockProofsForEvents(eventIds: string[]) {
  if (!prisma || !eventIds.length) return [];
  const delegate = (prisma as any).blockProof;
  if (!delegate?.findMany) return [];
  try {
    return await delegate.findMany({
      where: { eventId: { in: eventIds } },
    });
  } catch (error) {
    console.warn('[chain][proofs] failed to fetch proofs for events', error);
    return [];
  }
}

function initializePrisma(): PrismaClient | null {
  try {
    return new PrismaClient();
  } catch (error) {
    console.warn('[chain][proofs] prisma unavailable', error);
    return null;
  }
}










