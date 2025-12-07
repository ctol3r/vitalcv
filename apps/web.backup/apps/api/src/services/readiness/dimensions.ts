import { differenceInDays } from 'date-fns';
import {
  PrismaClient,
  type Prisma,
  type ClinicianReadinessScore,
  type ReadinessDimensionType,
} from '@prisma/client';

const prisma = new PrismaClient();

export interface DimensionScoreResult {
  dimension: ReadinessDimensionType;
  score: number;
  metadata: Record<string, unknown>;
}

type ReadinessFactors = {
  licenseFreshnessDays?: number;
  sanctionsProbability?: number;
  npdbHistory?: {
    adverseActions?: number;
    lastReportAt?: string | null;
  };
  compactEligibility?: string;
  identity?: {
    confidence?: number;
    lastVerifiedAt?: string | null;
  };
};

const DEFAULT_FACTORS: ReadinessFactors = {
  licenseFreshnessDays: 90,
  sanctionsProbability: 0.08,
  npdbHistory: {
    adverseActions: 0,
  },
  compactEligibility: 'PARTIAL',
  identity: {
    confidence: 0.8,
    lastVerifiedAt: null,
  },
};

export async function computePsdScore(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<DimensionScoreResult> {
  const [license, factors] = await Promise.all([
    client.stateLicenseVerification.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    }),
    loadReadinessFactors(client, clinicianId),
  ]);

  const freshnessDays =
    license?.lastCheckedAt ?? license?.updatedAt ?? license?.createdAt ?? null;

  const freshnessScore = freshnessDays
    ? clamp01(1 - differenceInDays(new Date(), freshnessDays) / 240)
    : deriveFreshnessFromFactors(factors);

  const statusScore = normalizeStatus(license?.status) === 'ACTIVE' ? 1 : 0.4;

  const score = roundScore(freshnessScore * 0.7 + statusScore * 0.3);

  return {
    dimension: 'PSD',
    score,
    metadata: {
      licenseId: license?.id ?? null,
      state: license?.state ?? null,
      status: license?.status ?? null,
      lastCheckedAt: freshnessDays?.toISOString() ?? null,
      basis: license ? 'state_license_verification' : 'readiness_factors',
    },
  };
}

export async function computeSanctionsScore(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<DimensionScoreResult> {
  const [factors, activeSignals] = await Promise.all([
    loadReadinessFactors(client, clinicianId),
    client.privilegeSafetySignal.count({
      where: {
        clinicianId,
        signalType: { in: ['NPDB_FLAG', 'LICENSE_RISK'] },
        resolvedAt: null,
      },
    }),
  ]);

  const probability = factors?.sanctionsProbability ?? DEFAULT_FACTORS.sanctionsProbability ?? 0;
  const probabilityComponent = clamp01(1 - probability);
  const signalPenalty = clamp01(activeSignals * 0.15);
  const score = roundScore(Math.max(0, probabilityComponent - signalPenalty));

  return {
    dimension: 'SANCTIONS',
    score,
    metadata: {
      sanctionsProbability: probability,
      activeSignals,
      derivedFrom: factors ? 'readiness_factors' : 'signals_only',
    },
  };
}

export async function computeCompactScore(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<DimensionScoreResult> {
  const [walletEntries, factors] = await Promise.all([
    safeFindCompactWallets(client, clinicianId),
    loadReadinessFactors(client, clinicianId),
  ]);

  if (walletEntries && walletEntries.length > 0) {
    const active = walletEntries.filter((entry) => {
      if (!entry.expiresAt) return true;
      return entry.expiresAt > new Date();
    });

    const score = roundScore(clamp01(active.length / walletEntries.length));
    return {
      dimension: 'COMPACT',
      score,
      metadata: {
        totalCompacts: walletEntries.length,
        activeCompacts: active.length,
        compacts: walletEntries.map((entry) => ({
          type: entry.compactType,
          homeState: entry.homeState,
          expiresAt: entry.expiresAt?.toISOString() ?? null,
        })),
        basis: 'compact_wallet',
      },
    };
  }

  const fallbackEligibility =
    factors?.compactEligibility ?? DEFAULT_FACTORS.compactEligibility ?? 'UNKNOWN';

  return {
    dimension: 'COMPACT',
    score: roundScore(deriveCompactFromEligibility(fallbackEligibility)),
    metadata: {
      compactEligibility: fallbackEligibility,
      basis: 'readiness_factors',
    },
  };
}

export async function computeIdentityScore(
  clinicianId: string,
  client: PrismaClient = prisma,
): Promise<DimensionScoreResult> {
  const profile = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    select: {
      id: true,
      npi: true,
      user: {
        select: {
          id: true,
          name: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          did: true,
        },
      },
    },
  });

  const devices = await client.walletDevice.count({ where: { clinicianId } }).catch(() => 0);
  const verifiedFields = [
    Boolean(profile?.npi),
    Boolean(profile?.user?.did),
    Boolean(profile?.user?.emailVerifiedAt),
    Boolean(profile?.user?.phoneVerifiedAt),
    devices > 0,
  ];

  const completeness =
    verifiedFields.reduce((total, value) => total + (value ? 1 : 0), 0) / verifiedFields.length;

  return {
    dimension: 'IDENTITY',
    score: roundScore(completeness),
    metadata: {
      npiPresent: Boolean(profile?.npi),
      didBound: Boolean(profile?.user?.did),
      emailVerified: Boolean(profile?.user?.emailVerifiedAt),
      phoneVerified: Boolean(profile?.user?.phoneVerifiedAt),
      walletDevices: devices,
      lastVerificationAt: profile?.user?.emailVerifiedAt?.toISOString() ?? null,
    },
  };
}

function deriveFreshnessFromFactors(factors?: ReadinessFactors | null): number {
  const days = factors?.licenseFreshnessDays ?? DEFAULT_FACTORS.licenseFreshnessDays ?? 90;
  return clamp01(1 - days / 240);
}

function deriveCompactFromEligibility(eligibility: string): number {
  switch (eligibility.toUpperCase()) {
    case 'FULL':
      return 1;
    case 'PARTIAL':
      return 0.75;
    case 'PENDING':
      return 0.5;
    case 'NONE':
    default:
      return 0.3;
  }
}

async function loadReadinessFactors(
  client: PrismaClient,
  clinicianId: string,
): Promise<ReadinessFactors | null> {
  const record: ClinicianReadinessScore | null = await client.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  return (record?.factors as Prisma.JsonObject | null) as ReadinessFactors | null;
}

async function safeFindCompactWallets(
  client: PrismaClient,
  clinicianId: string,
): Promise<
  | Array<{
      compactType: string;
      homeState: string;
      expiresAt: Date | null;
    }>
  | null
> {
  if (typeof (client as PrismaClient & { clinicianCompactWallet?: unknown }).clinicianCompactWallet === 'undefined') {
    return null;
  }

  try {
    const records = await (client as PrismaClient & {
      clinicianCompactWallet: PrismaClient['clinicianCompactWallet'];
    }).clinicianCompactWallet.findMany({
      where: { clinicianId },
      select: {
        compactType: true,
        homeState: true,
        expiresAt: true,
      },
    });
    return records;
  } catch (error) {
    console.warn('[readiness][dimensions] compact wallet lookup failed', {
      clinicianId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function normalizeStatus(status?: string | null): string {
  return (status ?? 'UNKNOWN').toUpperCase();
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number, precision = 4): number {
  return Number(clamp01(value).toFixed(precision));
}










