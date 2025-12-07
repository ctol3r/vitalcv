import { Prisma, PrismaClient } from '@prisma/client';
import { CredentialRiskFactors, dedupeFactors, scoreFromFactors } from './enums.js';

const prisma = new PrismaClient();

export interface MergeRiskOptions {
  add?: CredentialRiskFactors[];
  remove?: CredentialRiskFactors[];
  details?: Record<string, unknown>;
}

function toJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export async function mergeCredentialRisk(
  clinicianId: string,
  options: MergeRiskOptions
): Promise<void> {
  const record = await prisma.credentialRisk.findUnique({ where: { clinicianId } });
  const existing = Array.isArray(record?.factors)
    ? (record!.factors as CredentialRiskFactors[])
    : [];

  const current = new Set(existing);
  if (options.remove) {
    for (const factor of options.remove) {
      current.delete(factor);
    }
  }
  if (options.add) {
    for (const factor of options.add) {
      current.add(factor);
    }
  }

  const factors = dedupeFactors(Array.from(current));
  const score = scoreFromFactors(factors);

  if (!record && factors.length === 0) {
    return;
  }

  if (record) {
    if (factors.length === 0) {
      await prisma.credentialRisk.delete({ where: { clinicianId } });
      return;
    }

    await prisma.credentialRisk.update({
      where: { clinicianId },
      data: {
        score,
        factors,
        details: options.details ? toJson(options.details) : undefined,
      },
    });
    return;
  }

  await prisma.credentialRisk.create({
    data: {
      clinicianId,
      score,
      factors,
      details: toJson(options.details),
    },
  });
}
