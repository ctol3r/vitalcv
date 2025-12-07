import { PrismaClient, TrustedIssuer } from '@prisma/client';
import { anchorTrustEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface TrustedIssuerInput {
  did: string;
  orgNpi: string;
  orgName: string;
}

export async function addIssuer(input: TrustedIssuerInput): Promise<TrustedIssuer> {
  const record = await prisma.trustedIssuer.upsert({
    where: { did: input.did },
    create: {
      did: input.did,
      orgNpi: input.orgNpi,
      orgName: input.orgName,
    },
    update: {
      orgNpi: input.orgNpi,
      orgName: input.orgName,
    },
  });

  anchorTrustEvent('trustedIssuerAdded', {
    did: record.did,
    orgNpi: record.orgNpi,
    orgName: record.orgName,
  });

  return record;
}

export async function removeIssuer(did: string): Promise<TrustedIssuer | null> {
  const existing = await prisma.trustedIssuer.findUnique({ where: { did } });
  if (!existing) {
    return null;
  }

  await prisma.trustedIssuer.delete({ where: { did } });
  anchorTrustEvent('trustedIssuerRemoved', {
    did: existing.did,
    orgNpi: existing.orgNpi,
    orgName: existing.orgName,
  });

  return existing;
}

export async function isTrusted(did: string): Promise<boolean> {
  if (!did) {
    return false;
  }
  const record = await prisma.trustedIssuer.findUnique({ where: { did } });
  return Boolean(record);
}

export async function listTrustedIssuers(): Promise<TrustedIssuer[]> {
  return prisma.trustedIssuer.findMany({
    orderBy: { addedAt: 'desc' },
  });
}










