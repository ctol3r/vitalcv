import { DriftSeverity, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DriftEventInput {
  orgId: string;
  clinicianId: string;
  clinicianDid?: string;
  category: string;
  source: string;
  severity?: DriftSeverity;
  metadata?: Record<string, unknown>;
}

export async function createDriftEvent(input: DriftEventInput) {
  const {
    orgId,
    clinicianId,
    clinicianDid,
    category,
    source,
    severity = 'MEDIUM',
    metadata,
  } = input;

  return prisma.driftEvent.create({
    data: {
      orgId,
      clinicianId,
      clinicianDid,
      category,
      source,
      severity,
      metadata,
    },
  });
}

export async function resolveDriftEvents(options: {
  clinicianId: string;
  category?: string;
}): Promise<number> {
  const { clinicianId, category } = options;
  const result = await prisma.driftEvent.updateMany({
    where: {
      clinicianId,
      resolvedAt: null,
      ...(category ? { category } : {}),
    },
    data: {
      resolvedAt: new Date(),
    },
  });

  return result.count;
}
