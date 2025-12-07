import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger.js';
import {
  CredentialRiskFactors,
  CredentialRiskFactor,
  RISK_SEVERITY_WEIGHT,
} from './enums.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('credentialRisk');

export type RiskSeverity = 'info' | 'warning' | 'critical';

export interface RiskAdjustmentInput {
  clinicianId: string;
  factor: CredentialRiskFactors;
  severity?: RiskSeverity;
  delta?: number;
  details?: Record<string, unknown>;
  reason?: string;
}

export interface RiskResolutionInput {
  clinicianId: string;
  factor: CredentialRiskFactors;
  severity?: RiskSeverity;
  notes?: string;
}

type PrismaLike = Pick<PrismaClient, 'credentialRisk'>;

function getClient(client?: PrismaLike): PrismaLike {
  return client ?? prisma;
}

function coerceFactorArray(value: Prisma.JsonValue | null): CredentialRiskFactor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is CredentialRiskFactor => typeof entry === 'string');
}

function mergeDetails(
  existing: Prisma.JsonValue | null,
  factor: CredentialRiskFactor,
  payload?: Record<string, unknown>
) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (payload) {
    base[factor] = payload;
  }
  return base;
}

export async function applyRiskAdjustment(
  input: RiskAdjustmentInput,
  options: { prisma?: PrismaLike } = {}
): Promise<void> {
  if (!input.clinicianId) {
    return;
  }

  const client = getClient(options.prisma);
  const severity = input.severity ?? 'warning';
  const delta = input.delta ?? RISK_SEVERITY_WEIGHT[severity];

  const current = await client.credentialRisk.findUnique({
    where: { clinicianId: input.clinicianId },
  });

  const nextScore = Math.max(0, (current?.score ?? 0) + delta);
  const nextFactors = Array.from(
    new Set([...coerceFactorArray(current?.factors ?? null), input.factor])
  );
  const details = mergeDetails(current?.details ?? null, input.factor, input.details);

  await client.credentialRisk.upsert({
    where: { clinicianId: input.clinicianId },
    create: {
      clinicianId: input.clinicianId,
      score: nextScore,
      factors: nextFactors,
      details,
    },
    update: {
      score: nextScore,
      factors: nextFactors,
      details,
      updatedAt: new Date(),
    },
  });

  log.info('[CredentialRisk] Applied drift factor', {
    clinicianId: input.clinicianId,
    factor: input.factor,
    severity,
    delta,
    reason: input.reason,
  });
}

export async function resolveRiskFactor(
  input: RiskResolutionInput,
  options: { prisma?: PrismaLike } = {}
): Promise<void> {
  if (!input.clinicianId) {
    return;
  }

  const client = getClient(options.prisma);
  const record = await client.credentialRisk.findUnique({
    where: { clinicianId: input.clinicianId },
  });

  if (!record) {
    return;
  }

  const severity = input.severity ?? 'warning';
  const delta = RISK_SEVERITY_WEIGHT[severity];
  const remainingFactors = coerceFactorArray(record.factors).filter(
    (factor) => factor !== input.factor
  );
  const nextScore = Math.max(0, record.score - delta);

  let details: Prisma.JsonValue | undefined = record.details ?? undefined;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const clone = { ...(details as Record<string, unknown>) };
    delete clone[input.factor];
    details = clone;
  }

  await client.credentialRisk.update({
    where: { clinicianId: input.clinicianId },
    data: {
      score: nextScore,
      factors: remainingFactors,
      details,
      updatedAt: new Date(),
    },
  });

  log.info('[CredentialRisk] Resolved drift factor', {
    clinicianId: input.clinicianId,
    factor: input.factor,
    severity,
    notes: input.notes,
  });
}

