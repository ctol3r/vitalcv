import { PrismaClient, TrustedIssuer, TrustWeight } from '@prisma/client';

const prisma = new PrismaClient();

export const MAX_TRUST_WEIGHT = Number(process.env.TRUST_WEIGHT_MAX ?? 5);
export const DEFAULT_TRUST_WEIGHT = Number(process.env.TRUST_WEIGHT_DEFAULT ?? 3.5);

export interface TrustWeightSnapshot {
  issuerDid: string;
  weight: number;
  normalizedWeight: number;
  updatedAt: string;
}

export async function getTrustWeightSnapshot(issuerDid: string): Promise<TrustWeightSnapshot> {
  const did = issuerDid.trim();
  if (!did) {
    throw new Error('issuerDid is required to resolve trust weight');
  }

  const existing = await prisma.trustWeight.findUnique({ where: { issuerDid: did } });
  if (existing) {
    return mapRecord(existing);
  }

  const seeded = await prisma.trustWeight.create({
    data: {
      issuerDid: did,
      weight: DEFAULT_TRUST_WEIGHT,
    },
  });
  return mapRecord(seeded);
}

export async function setTrustWeight(issuerDid: string, weight: number): Promise<TrustWeightSnapshot> {
  const did = issuerDid.trim();
  const clamped = clampWeight(weight);
  const record = await prisma.trustWeight.upsert({
    where: { issuerDid: did },
    create: {
      issuerDid: did,
      weight: clamped,
    },
    update: {
      weight: clamped,
    },
  });
  return mapRecord(record);
}

export async function listTrustWeights(limit = 25): Promise<TrustWeightSnapshot[]> {
  let rows = await prisma.trustWeight.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  if (!rows.length) {
    const issuers = await prisma.trustedIssuer.findMany({
      orderBy: { addedAt: 'desc' },
      take: limit,
    });

    if (!issuers.length) {
      return [];
    }

    rows = await seedWeightsFromTrustedIssuers(issuers);
  }

  return rows.map(mapRecord);
}

export function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    return 0;
  }
  return Math.min(1, weight / MAX_TRUST_WEIGHT);
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) {
    return DEFAULT_TRUST_WEIGHT;
  }
  return Math.min(MAX_TRUST_WEIGHT, Math.max(0, weight));
}

function mapRecord(record: TrustWeight): TrustWeightSnapshot {
  return {
    issuerDid: record.issuerDid,
    weight: record.weight,
    normalizedWeight: normalizeWeight(record.weight),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function seedWeightsFromTrustedIssuers(issuers: TrustedIssuer[]): Promise<TrustWeight[]> {
  const payloads = issuers.map((issuer) =>
    prisma.trustWeight.create({
      data: {
        issuerDid: issuer.did,
        weight: DEFAULT_TRUST_WEIGHT,
      },
    }),
  );

  return prisma.$transaction(payloads);
}










