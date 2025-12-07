import { differenceInDays, subMonths } from 'date-fns';
import {
  PrismaClient,
  type Prisma,
  type ReadinessSignal as ReadinessSignalRecord,
  PrivilegeSafetySeverity,
} from '@prisma/client';
import {
  computePsdScore,
  computeSanctionsScore,
  computeCompactScore,
} from './dimensions';

const prisma = new PrismaClient();

export type ReadinessSignalType =
  | 'license'
  | 'board'
  | 'compact'
  | 'dea'
  | 'npdb'
  | 'sanctions'
  | 'privilege'
  | 'experience';

export interface SignalComputation {
  type: ReadinessSignalType;
  score: number;
  metadata: Record<string, unknown>;
  updatedAt: Date;
}

export interface SignalCollectionResult {
  signals: ReadinessSignalRecord[];
  previousSignals: ReadinessSignalRecord[];
}

type SignalCalculator = (clinicianId: string, client?: PrismaClient) => Promise<SignalComputation>;

export const TRACKED_SIGNAL_TYPES: ReadinessSignalType[] = [
  'license',
  'board',
  'sanctions',
  'npdb',
  'compact',
  'dea',
  'privilege',
  'experience',
];

const SIGNAL_CALCULATORS: Record<ReadinessSignalType, SignalCalculator> = {
  license: calcLicenseSignal,
  board: calcBoardSignal,
  sanctions: calcSanctionsSignal,
  npdb: calcNpdbSignal,
  compact: calcCompactSignal,
  dea: calcDeaSignal,
  privilege: calcPrivilegeSignal,
  experience: calcExperienceSignal,
};

export async function collectReadinessSignals(
  clinicianId: string,
  options: { prisma?: PrismaClient; refresh?: boolean; types?: ReadinessSignalType[] } = {},
): Promise<SignalCollectionResult> {
  const client = options.prisma ?? prisma;
  const targetTypes = options.types ?? TRACKED_SIGNAL_TYPES;

  const previousSignals = await client.readinessSignal.findMany({
    where: { clinicianId },
  });

  const latestMap = new Map<ReadinessSignalType, ReadinessSignalRecord>();
  for (const record of previousSignals) {
    if (isReadinessSignalType(record.type)) {
      latestMap.set(record.type, record);
    }
  }

  const needsRefresh = options.refresh ?? true;
  const typesToRefresh = new Set<ReadinessSignalType>();
  for (const type of targetTypes) {
    if (needsRefresh || !latestMap.has(type)) {
      typesToRefresh.add(type);
    }
  }

  if (typesToRefresh.size > 0) {
    const updates = await Promise.all(
      Array.from(typesToRefresh).map(async (type) => {
        const calculator = SIGNAL_CALCULATORS[type];
        const computed = await calculator(clinicianId, client);
        return client.readinessSignal.upsert({
          where: {
            clinicianId_type: {
              clinicianId,
              type,
            },
          },
          update: {
            score: computed.score,
            metadata: computed.metadata as Prisma.JsonValue,
            updatedAt: computed.updatedAt,
          },
          create: {
            clinicianId,
            type,
            score: computed.score,
            metadata: computed.metadata as Prisma.JsonValue,
            updatedAt: computed.updatedAt,
          },
        });
      }),
    );

    for (const record of updates) {
      if (isReadinessSignalType(record.type)) {
        latestMap.set(record.type, record);
      }
    }
  }

  const signals = targetTypes
    .map((type) => latestMap.get(type))
    .filter((record): record is ReadinessSignalRecord => Boolean(record));

  return {
    signals,
    previousSignals,
  };
}

async function calcLicenseSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const dimension = await computePsdScore(clinicianId, client);
  const existing = await client.readinessSignal.findUnique({
    where: {
      clinicianId_type: {
        clinicianId,
        type: 'license',
      },
    },
  });
  const lastCheckedRaw = dimension.metadata
    ? (dimension.metadata['lastCheckedAt'] as string | Date | undefined)
    : undefined;
  const lastCheckedAt = parseTimestamp(lastCheckedRaw ?? null);
  const freshnessDays = lastCheckedAt
    ? Math.max(differenceInDays(new Date(), lastCheckedAt), 0)
    : 365;
  const riskScore = clamp01(freshnessDays / 365);

  return {
    type: 'license',
    score: dimension.score,
    metadata: {
      ...dimension.metadata,
      freshnessDays,
      riskScore,
      licenseTasks: extractLicenseTasks(existing?.metadata ?? null),
    },
    updatedAt: lastCheckedAt ?? new Date(),
  };
}

async function calcBoardSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const checks = await client.complianceCheck.findMany({
    where: {
      clinicianId,
      type: { in: ['license', 'board_monitoring'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const mismatches = checks.filter((check) => {
    const payload = check.result as Prisma.JsonObject | null;
    return Boolean((payload as { mismatchDetected?: boolean })?.mismatchDetected);
  }).length;

  const recency = checks[0]?.createdAt ?? null;
  const score = roundScore(Math.max(0.2, 1 - mismatches * 0.2));
  const riskScore = clamp01(1 - score);

  return {
    type: 'board',
    score,
    metadata: {
      totalChecks: checks.length,
      mismatchCount: mismatches,
      lastCheckAt: recency?.toISOString() ?? null,
      riskScore,
    },
    updatedAt: recency ?? new Date(),
  };
}

async function calcSanctionsSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const dimension = await computeSanctionsScore(clinicianId, client);
  const riskScore = clamp01(1 - dimension.score);

  return {
    type: 'sanctions',
    score: dimension.score,
    metadata: {
      ...dimension.metadata,
      riskScore,
    },
    updatedAt: new Date(),
  };
}

async function calcNpdbSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const readiness = await client.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });
  const factors = readiness?.factors as Prisma.JsonObject | null;
  const history = (factors?.npdbHistory as { adverseActions?: number; lastReportAt?: string } | null) ?? null;

  const adverseActions =
    typeof history?.adverseActions === 'number' ? history.adverseActions : 0;
  const lastReportAt = typeof history?.lastReportAt === 'string' ? history.lastReportAt : null;
  const riskScore = clamp01(adverseActions * 0.25);
  const score = roundScore(Math.max(0, 1 - riskScore));

  return {
    type: 'npdb',
    score,
    metadata: {
      adverseActions,
      lastReportAt,
      derivedFrom: readiness ? 'readiness_factors' : 'none',
      riskScore,
    },
    updatedAt: readiness?.updatedAt ?? new Date(),
  };
}

async function calcCompactSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const [dimension, eligibility] = await Promise.all([
    computeCompactScore(clinicianId, client),
    client.compactEligibility.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const updatedAt = eligibility[0]?.updatedAt ?? new Date();
  const riskScore = clamp01(1 - dimension.score);

  return {
    type: 'compact',
    score: dimension.score,
    metadata: {
      ...dimension.metadata,
      eligibilityBreakdown: eligibility.map((record) => ({
        compact: record.compact,
        eligible: record.eligible,
        rationale: record.rationale,
        updatedAt: record.updatedAt.toISOString(),
      })),
      riskScore,
    },
    updatedAt,
  };
}

async function calcDeaSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const credential = await client.dEACredential.findFirst({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) {
    return {
      type: 'dea',
      score: 0.45,
      metadata: {
        credentialPresent: false,
        riskScore: 0.55,
      },
      updatedAt: new Date(0),
    };
  }

  const daysUntilExpiration = differenceInDays(credential.expiration, new Date());
  let score = clamp01(daysUntilExpiration / 365);

  if (daysUntilExpiration < 0) {
    score = 0.05;
  } else if (daysUntilExpiration < 30) {
    score *= 0.5;
  }

  const normalizedScore = roundScore(Math.max(0.2, score));
  const riskScore = clamp01(1 - normalizedScore);

  return {
    type: 'dea',
    score: normalizedScore,
    metadata: {
      credentialPresent: true,
      deaNumber: maskIdentifier(credential.deaNumber),
      expiration: credential.expiration.toISOString(),
      mateHours: credential.mateHours,
      riskScore,
    },
    updatedAt: credential.updatedAt,
  };
}

async function calcPrivilegeSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const signals = await client.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
      resolvedAt: null,
    },
    orderBy: { detectedAt: 'desc' },
    take: 10,
  });

  const severityPenalty: Record<PrivilegeSafetySeverity, number> = {
    LOW: 0.05,
    MED: 0.15,
    HIGH: 0.35,
    CRITICAL: 0.6,
  };

  let penalty = 0;
  const severityCounts: Record<PrivilegeSafetySeverity, number> = {
    LOW: 0,
    MED: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  for (const signal of signals) {
    severityCounts[signal.severity] = (severityCounts[signal.severity] ?? 0) + 1;
    penalty = Math.max(penalty, severityPenalty[signal.severity] ?? 0);
  }

  const score = roundScore(Math.max(0.3, 1 - penalty));

  return {
    type: 'privilege',
    score,
    metadata: {
      activeSignals: signals.length,
      severityCounts,
      privilegeCodes: Array.from(
        new Set(
          signals.flatMap((entry) => Array.isArray(entry.privilegeCodes) ? entry.privilegeCodes : []),
        ),
      ),
      lastDetectedAt: signals[0]?.detectedAt?.toISOString() ?? null,
      riskScore: penalty,
    },
    updatedAt: signals[0]?.detectedAt ?? new Date(),
  };
}

async function calcExperienceSignal(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<SignalComputation> {
  const windowStart = subMonths(new Date(), 18);
  const volumes = await client.procedureVolume.findMany({
    where: {
      clinicianId,
      periodEnd: { gte: windowStart },
    },
    orderBy: { periodEnd: 'desc' },
    take: 50,
  });

  const totalVolume = volumes.reduce((sum, row) => sum + (row.count ?? 0), 0);
  const uniqueProcedures = new Set(volumes.map((row) => row.procedure)).size;
  const mostRecentPeriod = volumes[0]?.periodEnd ?? null;

  const normalizedVolume = clamp01(totalVolume / 180);
  const diversityBoost = clamp01(uniqueProcedures / 10);
  const recencyBoost = mostRecentPeriod
    ? clamp01(1 - differenceInDays(new Date(), mostRecentPeriod) / 365)
    : 0.3;

  const score = roundScore(
    clamp01(normalizedVolume * 0.55 + diversityBoost * 0.25 + recencyBoost * 0.2),
  );

  return {
    type: 'experience',
    score,
    metadata: {
      totalEncounterVolume: totalVolume,
      uniqueProcedures,
      sampleWindowMonths: 18,
      lastPeriodEnd: mostRecentPeriod?.toISOString() ?? null,
      riskScore: clamp01(1 - score),
    },
    updatedAt: mostRecentPeriod ?? new Date(),
  };
}

function extractLicenseTasks(metadata: Prisma.JsonValue | null): unknown[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [];
  }
  const record = metadata as Record<string, unknown>;
  return Array.isArray(record.licenseTasks) ? record.licenseTasks : [];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number, precision = 4): number {
  return Number(clamp01(value).toFixed(precision));
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
}

function maskIdentifier(value: string): string {
  if (!value) return '—';
  const suffix = value.slice(-4);
  return `••••${suffix}`;
}

export function isReadinessSignalType(value: string): value is ReadinessSignalType {
  return (TRACKED_SIGNAL_TYPES as string[]).includes(value);
}

