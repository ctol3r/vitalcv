import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContractDocument {
  clinicianId: string;
  employerId: string;
  type: 'pdf' | 'structured_offer' | 'amendment';
  content: string | Buffer;
  metadata?: Record<string, unknown>;
}

/**
 * Ingest contract PDFs
 */
export async function ingestContractPDF(
  clinicianId: string,
  employerId: string,
  pdfContent: Buffer,
  metadata?: Record<string, unknown>,
): Promise<string> {
  // Store contract (in production, would use file storage)
  const contractId = `contract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Update or create contract health
  await prisma.contractHealth.upsert({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
    create: {
      clinicianId,
      employerId,
      health: {
        contractId,
        type: 'pdf',
        ingestedAt: new Date().toISOString(),
        metadata,
      },
    },
    update: {
      health: {
        contractId,
        type: 'pdf',
        ingestedAt: new Date().toISOString(),
        metadata,
      },
      updatedAt: new Date(),
    },
  });

  return contractId;
}

/**
 * Ingest structured offers
 */
export async function ingestStructuredOffer(
  clinicianId: string,
  employerId: string,
  offer: Record<string, unknown>,
): Promise<void> {
  await prisma.contractHealth.upsert({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
    create: {
      clinicianId,
      employerId,
      health: {
        type: 'structured_offer',
        offer,
        ingestedAt: new Date().toISOString(),
      },
    },
    update: {
      health: {
        type: 'structured_offer',
        offer,
        ingestedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  });
}

/**
 * Ingest contract amendments
 */
export async function ingestAmendment(
  clinicianId: string,
  employerId: string,
  amendment: Record<string, unknown>,
): Promise<void> {
  const existing = await prisma.contractHealth.findUnique({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
  });

  const health = existing?.health as Record<string, unknown> || {};
  const amendments = (health.amendments as Array<unknown>) || [];
  amendments.push({
    ...amendment,
    amendedAt: new Date().toISOString(),
  });

  await prisma.contractHealth.upsert({
    where: {
      clinicianId_employerId: {
        clinicianId,
        employerId,
      },
    },
    create: {
      clinicianId,
      employerId,
      health: {
        amendments: [amendment],
      },
    },
    update: {
      health: {
        ...health,
        amendments,
      },
      updatedAt: new Date(),
    },
  });
}

