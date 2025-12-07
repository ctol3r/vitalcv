import { CredentialRiskFactors, EhrSyncSeverity, EHR_SEVERITY_SCORE_FLOORS } from './enums';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EhrSyncFailureOptions {
  clinicianId: string;
  privilegeSetId?: string;
  failureReason?: string;
  mismatchDetails?: {
    missing: string[];
    unexpected: string[];
  };
  severity?: EhrSyncSeverity;
}

export async function recordEhrSyncFailure(options: EhrSyncFailureOptions): Promise<void> {
  const {
    clinicianId,
    privilegeSetId,
    failureReason,
    mismatchDetails,
    severity = 'MEDIUM',
  } = options;

  const existing = await prisma.credentialRisk.findUnique({ where: { clinicianId } });
  const existingFactors = Array.isArray(existing?.factors)
    ? (existing?.factors as string[])
    : [];
  const factorSet = new Set<string>(existingFactors);
  factorSet.add(CredentialRiskFactors.EHR_SYNC_FAILURE);

  const nextScore = Math.max(existing?.score ?? 0, EHR_SEVERITY_SCORE_FLOORS[severity]);
  const nextDetails = normalizeDetails(existing?.details);
  const failureInfo = {
    ...(nextDetails.ehrSync ?? {}),
    lastFailureAt: new Date().toISOString(),
    lastFailureReason: failureReason,
    privilegeSetId,
    severity,
    mismatchDetails,
    failureCount: typeof nextDetails.ehrSync?.failureCount === 'number'
      ? nextDetails.ehrSync.failureCount + 1
      : 1,
  };
  nextDetails.ehrSync = failureInfo;

  if (existing) {
    await prisma.credentialRisk.update({
      where: { clinicianId },
      data: {
        score: nextScore,
        factors: Array.from(factorSet),
        details: nextDetails,
      },
    });
  } else {
    await prisma.credentialRisk.create({
      data: {
        clinicianId,
        score: nextScore,
        factors: Array.from(factorSet),
        details: nextDetails,
      },
    });
  }
}

export async function clearEhrSyncAlerts(clinicianId: string): Promise<void> {
  const existing = await prisma.credentialRisk.findUnique({ where: { clinicianId } });
  if (!existing) {
    return;
  }

  const factors = Array.isArray(existing.factors) ? [...(existing.factors as string[])] : [];
  const filtered = factors.filter((factor) => factor !== CredentialRiskFactors.EHR_SYNC_FAILURE);

  const nextDetails = normalizeDetails(existing.details);
  if (nextDetails.ehrSync) {
    nextDetails.ehrSync.lastRecoveredAt = new Date().toISOString();
    nextDetails.ehrSync.mismatchDetails = undefined;
    nextDetails.ehrSync.lastFailureReason = undefined;
  }

  const nextScore = filtered.length === 0 ? Math.min(existing.score, 40) : existing.score;

  await prisma.credentialRisk.update({
    where: { clinicianId },
    data: {
      score: nextScore,
      factors: filtered,
      details: nextDetails,
    },
  });
}

function normalizeDetails(details: unknown): Record<string, any> {
  if (!details || typeof details !== 'object') {
    return {};
  }
  return JSON.parse(JSON.stringify(details));
}
