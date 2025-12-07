import {
  Prisma,
  PrismaClient,
  type MarketplaceProfile as MarketplaceProfileModel,
} from '@prisma/client';
import { anchorMarketplaceProfileUpdate } from '../audit/anchor';

const prisma = new PrismaClient();

const DEFAULT_SPECIALTIES = ['Telehealth', 'Hospitalist', 'Psychiatry', 'Critical Care'];
const DEFAULT_REGIONS = ['National', 'Remote'];
const VISIBILITY_STATES = new Set(['public', 'private', 'invite']);

export interface MarketplaceProfileInput {
  clinicianId: string;
  visibility: string;
  specialties: string[];
  regions: string[];
  orgId?: string;
}

export interface MarketplaceProfileView {
  clinicianId: string;
  visibility: string;
  specialties: string[];
  regions: string[];
  readiness: {
    score: number;
    tier: string;
    updatedAt?: string;
    factors: Record<string, unknown>;
  };
  compactEligibility: {
    eligible: boolean;
    compacts: string[];
  };
  updatedAt: string;
  rank?: {
    score: number;
    breakdown: {
      readinessBoost: number;
      specialtyMatch: number;
      regionMatch: number;
      compactSignal: number;
    };
  };
}

export interface MarketplaceBrowseFilters {
  specialty?: string;
  region?: string;
  readinessScore?: number;
  compactEligible?: boolean;
  limit?: number;
}

export async function getMarketplaceProfile(
  clinicianId: string,
): Promise<MarketplaceProfileView> {
  const [profile, readiness, compacts] = await Promise.all([
    prisma.marketplaceProfile.findUnique({
      where: { clinicianId },
    }),
    prisma.clinicianReadinessScore.findUnique({
      where: { clinicianId },
    }),
    prisma.compactEligibility.findMany({
      where: { clinicianId, eligible: true },
    }),
  ]);
  return buildProfileView(
    profile ?? buildDefaultProfile(clinicianId),
    readiness ?? undefined,
    compacts.map((record) => record.compact),
  );
}

export async function upsertMarketplaceProfile(
  input: MarketplaceProfileInput,
): Promise<MarketplaceProfileView> {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required');
  }
  const visibility = normalizeVisibility(input.visibility);
  const specialties = dedupeStrings(input.specialties);
  const regions = dedupeStrings(input.regions);

  const saved = await prisma.marketplaceProfile.upsert({
    where: { clinicianId: input.clinicianId },
    create: {
      clinicianId: input.clinicianId,
      visibility,
      specialties,
      regions,
    },
    update: {
      visibility,
      specialties,
      regions,
      updatedAt: new Date(),
    },
  });

  const view = await buildProfileView(saved);
  anchorMarketplaceProfileUpdate({
    clinicianId: input.clinicianId,
    visibility,
    specialties,
    regions,
    orgId: input.orgId,
    specialtyFilters: specialties,
  });
  return view;
}

export async function browseMarketplaceProfiles(filters: MarketplaceBrowseFilters) {
  const where: Prisma.MarketplaceProfileWhereInput = {
    visibility: 'public',
  };
  if (filters.specialty) {
    where.specialties = { has: filters.specialty };
  }
  if (filters.region) {
    where.regions = { has: filters.region };
  }

  const take = Math.min(Math.max(filters.limit ?? 50, 5), 200);
  const profiles = await prisma.marketplaceProfile.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take,
  });

  if (profiles.length === 0) {
    return {
      filters,
      total: 0,
      profiles: [],
    };
  }

  const clinicianIds = profiles.map((entry) => entry.clinicianId);

  const [readinessRecords, compactRecords] = await Promise.all([
    prisma.clinicianReadinessScore.findMany({
      where: { clinicianId: { in: clinicianIds } },
    }),
    prisma.compactEligibility.findMany({
      where: { clinicianId: { in: clinicianIds }, eligible: true },
    }),
  ]);

  const readinessMap = new Map(
    readinessRecords.map((record) => [record.clinicianId, record]),
  );
  const compactMap = new Map<string, string[]>();
  for (const record of compactRecords) {
    const existing = compactMap.get(record.clinicianId) ?? [];
    existing.push(record.compact);
    compactMap.set(record.clinicianId, existing);
  }

  const ranked = profiles
    .map((profile) => {
      const readiness = readinessMap.get(profile.clinicianId);
      const compacts = compactMap.get(profile.clinicianId) ?? [];
      const view = buildProfileView(profile, readiness, compacts);
      const ranking = rankProfile(view, filters);
      view.rank = ranking;
      return view;
    })
    .filter((profile) => {
      if (typeof filters.readinessScore === 'number') {
        return profile.readiness.score >= filters.readinessScore;
      }
      if (filters.compactEligible) {
        return profile.compactEligibility.eligible;
      }
      return true;
    })
    .sort((a, b) => (b.rank?.score ?? 0) - (a.rank?.score ?? 0));

  return {
    filters,
    total: ranked.length,
    profiles: ranked,
  };
}

function buildDefaultProfile(clinicianId: string): MarketplaceProfileModel {
  return {
    id: clinicianId,
    clinicianId,
    visibility: 'invite',
    specialties: DEFAULT_SPECIALTIES,
    regions: DEFAULT_REGIONS,
    updatedAt: new Date(),
  } as MarketplaceProfileModel;
}

function buildProfileView(
  profile: MarketplaceProfileModel,
  readinessRecord?: { score: number; factors: unknown; updatedAt: Date },
  compacts?: string[],
): MarketplaceProfileView {
  const readinessScore = readinessRecord?.score ?? 0.62;
  return {
    clinicianId: profile.clinicianId,
    visibility: profile.visibility,
    specialties: profile.specialties ?? DEFAULT_SPECIALTIES,
    regions: profile.regions ?? DEFAULT_REGIONS,
    readiness: {
      score: Number(readinessScore.toFixed(3)),
      tier: mapReadinessTier(readinessScore),
      updatedAt: readinessRecord?.updatedAt?.toISOString(),
      factors:
        (readinessRecord?.factors as Record<string, unknown> | undefined) ?? {},
    },
    compactEligibility: {
      eligible: Boolean(compacts?.length),
      compacts: compacts ?? [],
    },
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function normalizeVisibility(value: string): string {
  if (VISIBILITY_STATES.has(value)) {
    return value;
  }
  return 'invite';
}

function dedupeStrings(values: string[] = []): string[] {
  const normalized = values.map((value) =>
    value.trim(),
  ).filter(Boolean);
  return Array.from(new Set(normalized));
}

function mapReadinessTier(score: number): string {
  if (score >= 0.9) return 'Ready in 48h';
  if (score >= 0.8) return 'Fast Track';
  if (score >= 0.7) return 'Warm';
  return 'Emerging';
}

function rankProfile(
  view: MarketplaceProfileView,
  filters: MarketplaceBrowseFilters,
): MarketplaceProfileView['rank'] {
  const readinessBoost = view.readiness.score * 0.6;
  const specialtyMatch = filters.specialty
    ? view.specialties.includes(filters.specialty)
      ? 0.25
      : 0
    : 0.15;
  const regionMatch = filters.region
    ? view.regions.includes(filters.region)
      ? 0.1
      : 0
    : 0.05;
  const compactSignal =
    filters.compactEligible || view.compactEligibility.eligible
      ? view.compactEligibility.eligible
        ? 0.05
        : 0
      : 0.02;

  const score = Number(
    Math.min(1, readinessBoost + specialtyMatch + regionMatch + compactSignal).toFixed(4),
  );
  return {
    score,
    breakdown: {
      readinessBoost: Number(readinessBoost.toFixed(3)),
      specialtyMatch,
      regionMatch,
      compactSignal,
    },
  };
}

