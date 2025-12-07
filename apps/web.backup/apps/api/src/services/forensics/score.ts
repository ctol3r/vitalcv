import { createHash } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';

import { detectIdentityAnomalies } from './identity-anomaly';
import { detectDocumentFingerprintReuse } from './doc-fingerprint';
import { analyzeBehaviorSignals } from './behavior';
import {
  buildSignalId,
  clampScore,
  ForensicsSignal,
  ForensicsSignalCategory,
  serializeSignals,
  severityFromScore,
} from './types';
import { anchorIdentityForensics } from '../audit/anchor';

const prisma = new DefaultPrismaClient();
const CATEGORY_WEIGHTS: Record<ForensicsSignalCategory, number> = {
  identity: 0.35,
  document: 0.25,
  behavior: 0.2,
  registry: 0.2,
};

const DEFAULT_LOCK_THRESHOLD = Number(process.env.IDENTITY_FORENSICS_LOCK_THRESHOLD ?? 75);

export interface EvaluateForensicsOptions {
  prisma?: PrismaClient;
  now?: Date;
  anchor?: boolean;
  lookbackDays?: number;
  fingerprintId?: string;
  fingerprintHash?: string;
  fingerprintFeatures?: Prisma.JsonValue | null;
  sampleSize?: number;
  lockThreshold?: number;
}

export interface ForensicsEvaluationResult {
  clinicianId: string;
  riskScore: number;
  normalizedScore: number;
  lockIssued: boolean;
  signals: ForensicsSignal[];
  breakdown: Record<ForensicsSignalCategory, number>;
  recordedAt: string;
  signalsHash: string;
}

export class ForensicsLockError extends Error {
  readonly clinicianId: string;
  readonly riskScore: number;
  readonly threshold: number;
  readonly statusCode = 423;
  readonly code = 'forensics_lock';

  constructor(clinicianId: string, riskScore: number, threshold: number) {
    super(
      `Clinician ${clinicianId} is locked for issuance (risk ${riskScore.toFixed(1)} ≥ ${threshold}). Manual review required.`,
    );
    this.clinicianId = clinicianId;
    this.riskScore = riskScore;
    this.threshold = threshold;
    this.name = 'ForensicsLockError';
  }
}

export function isForensicsLockError(error: unknown): error is ForensicsLockError {
  return error instanceof ForensicsLockError;
}

export async function evaluateIdentityForensics(
  clinicianId: string,
  options: EvaluateForensicsOptions = {},
): Promise<ForensicsEvaluationResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to evaluate identity forensics');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();
  const lockThreshold = options.lockThreshold ?? DEFAULT_LOCK_THRESHOLD;

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: { user: true },
  });
  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [identitySignals, documentSignal, behaviorSignals, registrySignals] = await Promise.all([
    detectIdentityAnomalies(clinicianId, {
      prisma: client,
      now,
      lookbackDays: options.lookbackDays,
      clinician,
    }),
    detectDocumentFingerprintReuse({
      prisma: client,
      clinicianId,
      fingerprintId: options.fingerprintId,
      fingerprintHash: options.fingerprintHash,
      features: options.fingerprintFeatures,
      sampleSize: options.sampleSize,
    }),
    analyzeBehaviorSignals(clinicianId, {
      prisma: client,
      now,
      lookbackDays: options.lookbackDays,
    }),
    deriveRegistrySignals(clinician, client),
  ]);

  const signals = [
    ...identitySignals,
    ...(documentSignal ? [documentSignal] : []),
    ...behaviorSignals,
    ...registrySignals,
  ];

  if (!signals.length) {
    signals.push({
      id: buildSignalId('identity', 'baseline_observation'),
      clinicianId,
      category: 'identity',
      type: 'baseline_observation',
      severity: 'low',
      score: 0.15,
      description: 'No anomalous identity signals recorded during this window.',
      observedAt: now.toISOString(),
      metadata: {},
    });
  }

  const { normalizedScore, breakdown } = computeRisk(signals);
  const riskScore = Number((normalizedScore * 100).toFixed(2));
  const lockIssued = riskScore >= lockThreshold;
  const signalsHash = hashSignals(signals);

  await client.identityForensics.create({
    data: {
      clinicianId,
      riskScore,
      signals: serializeSignals(signals),
    },
  });

  if (options.anchor !== false) {
    anchorIdentityForensics({
      clinicianId,
      riskScore,
      signalsHash,
    }).catch((error) => console.warn('[forensics][anchor] failed to anchor record', error));
  }

  return {
    clinicianId,
    riskScore,
    normalizedScore,
    lockIssued,
    signals,
    breakdown,
    recordedAt: now.toISOString(),
    signalsHash,
  };
}

export async function listForensicsHistory(
  clinicianId: string,
  options: { limit?: number; prisma?: PrismaClient } = {},
) {
  const client = options.prisma ?? prisma;
  const limit = Math.max(1, Math.min(options.limit ?? 25, 200));

  const records = await client.identityForensics.findMany({
    where: { clinicianId },
    orderBy: { lastReviewed: 'desc' },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    signals: Array.isArray(record.signals) ? (record.signals as ForensicsSignal[]) : [],
  }));
}

export async function listForensicsAlerts(
  options: { limit?: number; minScore?: number; prisma?: PrismaClient } = {},
) {
  const client = options.prisma ?? prisma;
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const minScore = options.minScore ?? DEFAULT_LOCK_THRESHOLD;

  const records = await client.identityForensics.findMany({
    where: { riskScore: { gte: minScore } },
    orderBy: { lastReviewed: 'desc' },
    take: limit,
  });

  return records.map((record) => ({
    ...record,
    signals: Array.isArray(record.signals) ? (record.signals as ForensicsSignal[]) : [],
  }));
}

export async function assertIssuanceAllowed(
  clinicianId: string,
  options: { prisma?: PrismaClient; threshold?: number } = {},
): Promise<void> {
  const client = options.prisma ?? prisma;
  const threshold = options.threshold ?? DEFAULT_LOCK_THRESHOLD;

  const latest = await client.identityForensics.findFirst({
    where: { clinicianId },
    orderBy: { lastReviewed: 'desc' },
  });

  if (!latest) {
    return;
  }

  if (latest.riskScore >= threshold) {
    throw new ForensicsLockError(clinicianId, latest.riskScore, threshold);
  }
}

function computeRisk(signals: ForensicsSignal[]): {
  normalizedScore: number;
  breakdown: Record<ForensicsSignalCategory, number>;
} {
  const grouping = new Map<ForensicsSignalCategory, number[]>();
  signals.forEach((signal) => {
    grouping.set(signal.category, [...(grouping.get(signal.category) ?? []), signal.score]);
  });

  let normalizedScore = 0;
  const breakdown = {
    identity: 0,
    document: 0,
    behavior: 0,
    registry: 0,
  } satisfies Record<ForensicsSignalCategory, number>;

  (Object.keys(CATEGORY_WEIGHTS) as ForensicsSignalCategory[]).forEach((category) => {
    const values = grouping.get(category);
    if (!values || !values.length) {
      return;
    }
    const average = clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
    const weighted = average * CATEGORY_WEIGHTS[category];
    breakdown[category] = Number(weighted.toFixed(4));
    normalizedScore += weighted;
  });

  return {
    normalizedScore: clampScore(normalizedScore),
    breakdown,
  };
}

async function deriveRegistrySignals(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  client: PrismaClient,
): Promise<ForensicsSignal[]> {
  const identifierFilter = buildMonitorFilter(clinician.npi, clinician.user?.did ?? null);
  if (!identifierFilter) {
    return [];
  }

  const [npdbMonitor, npdbEvents, oigMonitor, activeLicenses] = await Promise.all([
    client.npdbOigMonitor.findFirst({
      where: {
        monitorType: 'NPDB',
        ...identifierFilter,
      },
      orderBy: { checkDate: 'desc' },
    }),
    client.riskEvent.findMany({
      where: { clinicianId: clinician.id, type: 'npdb' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    client.npdbOigMonitor.findFirst({
      where: {
        monitorType: 'OIG',
        ...identifierFilter,
      },
      orderBy: { checkDate: 'desc' },
    }),
    client.stateLicenseVerification.findMany({
      where: {
        clinicianId: clinician.id,
        status: {
          in: ['active', 'ACTIVE', 'current', 'CURRENT'],
        },
      },
      take: 8,
    }),
  ]);

  const signals: ForensicsSignal[] = [];

  if (npdbMonitor) {
    const monitorCount = extractAdverseCount(npdbMonitor);
    const declared = npdbEvents.length;
    if (monitorCount > declared) {
      const gapScore = clampScore((monitorCount - declared) / Math.max(1, monitorCount));
      signals.push({
        id: buildSignalId('registry', 'npdb_misalignment'),
        clinicianId: clinician.id,
        category: 'registry',
        type: 'npdb_misalignment',
        severity: severityFromScore(gapScore),
        score: gapScore,
        description: `NPDB monitor shows ${monitorCount} adverse events, but only ${declared} recorded internally.`,
        observedAt: (npdbMonitor.checkDate ?? new Date()).toISOString(),
        metadata: {
          monitorStatus: npdbMonitor.status,
          monitorCount,
          declaredEvents: declared,
        },
      });
    }
  }

  if (oigMonitor) {
    const monitorStatus = String(oigMonitor.status ?? 'UNKNOWN').toUpperCase();
    if (monitorStatus === 'ADVERSE_ACTION' && activeLicenses.length) {
      const score = clampScore(0.65 + Math.min(0.25, activeLicenses.length * 0.05));
      signals.push({
        id: buildSignalId('registry', 'oig_exclusion_vs_license'),
        clinicianId: clinician.id,
        category: 'registry',
        type: 'oig_exclusion_vs_license',
        severity: severityFromScore(score),
        score,
        description: `OIG shows an active exclusion while ${activeLicenses.length} licenses remain active.`,
        observedAt: (oigMonitor.checkDate ?? new Date()).toISOString(),
        metadata: {
          activeLicenses: activeLicenses.map((license) => ({
            id: license.id,
            state: license.state,
            status: license.status,
            expiryDate: license.expiryDate?.toISOString() ?? null,
          })),
        },
      });
    }
  }

  return signals;
}

function extractAdverseCount(record: {
  adverseActions?: unknown;
  payload?: Prisma.JsonValue;
}): number {
  if (Array.isArray(record.adverseActions)) {
    return record.adverseActions.length;
  }
  if (typeof record.adverseActions === 'number') {
    return record.adverseActions;
  }
  if (record.payload && typeof record.payload === 'object') {
    const payload = record.payload as Record<string, unknown>;
    const counts = payload.counts as Record<string, unknown> | undefined;
    if (counts && typeof counts.adverse_actions === 'number') {
      return counts.adverse_actions;
    }
  }
  return 0;
}

function buildMonitorFilter(npi?: string | null, clinicianDid?: string | null) {
  const clauses = [];
  if (clinicianDid) {
    clauses.push({ clinicianDid });
  }
  if (npi) {
    clauses.push({ npi });
  }
  if (!clauses.length) {
    return null;
  }
  if (clauses.length === 1) {
    return clauses[0];
  }
  return { OR: clauses } as Prisma.NpdbOigMonitorWhereInput;
}

function hashSignals(signals: ForensicsSignal[]): string {
  return createHash('sha256').update(JSON.stringify(signals)).digest('hex');
}










