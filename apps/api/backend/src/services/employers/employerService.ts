/**
 * Wave 186 — Employer Knowledge Layer
 * employerService.ts
 *
 * DB-first employer profile retrieval with seeded fallback overlays keyed by
 * canonical Organization.slug. Public-facing responses only expose verified
 * org profiles or known seeded employers.
 */

import {
  EmployerHiringStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  type EmployerRequirementSpec,
  type EmployerSeedRecord,
  EMPLOYER_KNOWLEDGE_SEEDS,
  getEmployerSeedBySlug,
} from './employerCatalog';
import { parseOrganizationRequirementsEnvelope } from './pilotPolicy';

type EmployerProfileRecord = Prisma.OrganizationProfileGetPayload<{
  include: typeof EMPLOYER_PROFILE_INCLUDE;
}>;

export interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: EmployerHiringStatus;
  timeToStart: string;
  verified: boolean;
  trustIndicators: string[];
}

export interface EmployerOverviewPayload {
  description: string;
  website: string | null;
  facilityType: string;
  states: string[];
}

export interface EmployerDetail extends EmployerSummary {
  description: string;
  hiringTypes: string[];
  timeToOnboard: string;
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange: string | null;
  requirements: EmployerRequirementSpec[];
  recentHires: number;
  website: string | null;
  verifiedSince: string | null;
  overview: EmployerOverviewPayload;
  specialtiesHired: string[];
  requirementsSummary: string;
  startSpeed: string;
  onboardingSpeed: string;
}

export interface EmployerListOptions {
  specialty?: string;
  state?: string;
  hiringStatus?: string;
  hiringType?: string;
  limit?: number;
  offset?: number;
}

export interface EmployerListResult {
  employers: EmployerSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface EmployerCompareResult {
  employers: EmployerDetail[];
  differentiators: string[];
  comparedAt: string;
}

const EMPLOYER_PROFILE_INCLUDE = {
  organization: {
    include: {
      _count: {
        select: {
          opportunities: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  },
} satisfies Prisma.OrganizationProfileInclude;

function normalizeText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeArray(value: string[] | null | undefined, fallback: string[]): string[] {
  const normalized = value?.map((item) => item.trim()).filter(Boolean) ?? [];
  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

function normalizeCount(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && value > 0 ? value : fallback;
}

function normalizeRequirements(
  value: Prisma.JsonValue | null | undefined,
  fallback: EmployerRequirementSpec[],
): EmployerRequirementSpec[] {
  const envelope = parseOrganizationRequirementsEnvelope(value, fallback);
  return envelope.requirements.length > 0 ? envelope.requirements : fallback;
}

function buildTrustIndicators(detail: {
  verified: boolean;
  trustScore: number;
  verifiedSince: string | null;
  requirements: EmployerRequirementSpec[];
}): string[] {
  const indicators: string[] = [];

  if (detail.verified) {
    indicators.push(detail.verifiedSince ? `Verified since ${detail.verifiedSince.slice(0, 10)}` : 'Verified employer');
  }

  if (detail.trustScore > 0) {
    indicators.push(`Trust score ${detail.trustScore}`);
  }

  if (detail.requirements.some((requirement) => requirement.level === 'L3')) {
    indicators.push('Requires primary-source verified credentials');
  }

  return indicators;
}

function buildRequirementsSummary(
  threshold: string,
  requirements: EmployerRequirementSpec[],
): string {
  if (threshold.trim().length > 0) {
    return threshold;
  }

  return requirements
    .slice(0, 4)
    .map((requirement) => requirement.label)
    .join(', ');
}

function buildEmployerDetail(
  slug: string,
  seed: EmployerSeedRecord | undefined,
  profile?: EmployerProfileRecord,
): EmployerDetail {
  const verifiedSince = profile?.verifiedSince?.toISOString() ?? seed?.verifiedSince ?? null;
  const requirements = normalizeRequirements(profile?.requirements, seed?.requirements ?? []);
  const verified = Boolean(profile?.verified) || Boolean(seed);
  const trustScore = normalizeCount(profile?.trustScore, seed?.trustScore ?? 0);

  const detailBase = {
    id: profile?.organizationId ?? slug,
    slug,
    name: normalizeText(profile?.organization.name, seed?.name ?? slug),
    facilityType: normalizeText(profile?.facilityType, seed?.facilityType ?? 'Employer'),
    tagline: normalizeText(profile?.tagline, seed?.tagline ?? ''),
    specialties: normalizeArray(profile?.specialties, seed?.specialties ?? []),
    states: normalizeArray(profile?.statesCovered, seed?.states ?? []),
    openRoles: normalizeCount(
      profile?.organization?._count?.opportunities ?? profile?.openRoles,
      seed?.openRoles ?? 0,
    ),
    trustScore,
    hiringStatus: profile?.hiringStatus ?? seed?.hiringStatus ?? EmployerHiringStatus.NOT_HIRING,
    timeToStart: normalizeText(profile?.timeToStart, seed?.timeToStart ?? 'Not disclosed'),
    verified,
    description: normalizeText(profile?.description, seed?.description ?? ''),
    hiringTypes: normalizeArray(profile?.hiringTypes, seed?.hiringTypes ?? []),
    timeToOnboard: normalizeText(profile?.timeToOnboard, seed?.timeToOnboard ?? 'Not disclosed'),
    clearToStartThreshold: normalizeText(
      profile?.clearToStartThreshold,
      seed?.clearToStartThreshold ?? '',
    ),
    payTransparency: profile?.payTransparency ?? seed?.payTransparency ?? false,
    payRange: profile?.payRange ?? seed?.payRange ?? null,
    requirements,
    recentHires: normalizeCount(profile?.recentHires, seed?.recentHires ?? 0),
    website: profile?.website ?? seed?.website ?? null,
    verifiedSince,
  };

  const trustIndicators = buildTrustIndicators({
    verified: detailBase.verified,
    trustScore: detailBase.trustScore,
    verifiedSince: detailBase.verifiedSince,
    requirements: detailBase.requirements,
  });

  return {
    ...detailBase,
    trustIndicators,
    overview: {
      description: detailBase.description,
      website: detailBase.website,
      facilityType: detailBase.facilityType,
      states: detailBase.states,
    },
    specialtiesHired: detailBase.specialties,
    requirementsSummary: buildRequirementsSummary(
      detailBase.clearToStartThreshold,
      detailBase.requirements,
    ),
    startSpeed: detailBase.timeToStart,
    onboardingSpeed: detailBase.timeToOnboard,
  };
}

function toSummary(detail: EmployerDetail): EmployerSummary {
  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    facilityType: detail.facilityType,
    tagline: detail.tagline,
    specialties: detail.specialties,
    states: detail.states,
    openRoles: detail.openRoles,
    trustScore: detail.trustScore,
    hiringStatus: detail.hiringStatus,
    timeToStart: detail.timeToStart,
    verified: detail.verified,
    trustIndicators: detail.trustIndicators,
  };
}

function isPublicEmployer(profile: EmployerProfileRecord | undefined, seed: EmployerSeedRecord | undefined): boolean {
  const verified = seed ? true : Boolean(profile?.verified);
  if (!verified) {
    return false;
  }
  
  // validation rule: employer must have a real domain OR not be public
  const website = profile?.website ?? seed?.website;
  if (!website || website.trim() === '') {
    return false;
  }
  
  // reject placeholder domains from being public
  const cleanDomain = website.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (
    cleanDomain.includes('example.com') ||
    cleanDomain.includes('example.org') ||
    cleanDomain.includes('example.net') ||
    cleanDomain.includes('test.') ||
    cleanDomain.includes('localhost') ||
    cleanDomain.includes('placeholder.com') ||
    cleanDomain.includes('fake.com') ||
    cleanDomain.includes('domain.com')
  ) {
    return false;
  }

  return true;
}

function applyListFilters(detail: EmployerDetail, opts: EmployerListOptions): boolean {
  if (opts.specialty) {
    const specialty = opts.specialty.toLowerCase();
    if (!detail.specialties.some((value) => value.toLowerCase().includes(specialty))) {
      return false;
    }
  }

  if (opts.state) {
    const state = opts.state.toUpperCase();
    if (!detail.states.includes(state)) {
      return false;
    }
  }

  if (opts.hiringStatus && detail.hiringStatus !== opts.hiringStatus) {
    return false;
  }

  if (opts.hiringType) {
    const hiringType = opts.hiringType.toLowerCase();
    if (!detail.hiringTypes.some((value) => value.toLowerCase() === hiringType)) {
      return false;
    }
  }

  return true;
}

async function getPublicProfilesBySlug(): Promise<Map<string, EmployerProfileRecord>> {
  const profiles = await prisma.organizationProfile.findMany({
    where: {
      OR: [
        { verified: true },
        {
          organization: {
            slug: { in: EMPLOYER_KNOWLEDGE_SEEDS.map((seed) => seed.slug) },
          },
        },
      ],
    },
    include: EMPLOYER_PROFILE_INCLUDE,
  });

  return new Map(
    profiles.map((profile) => [profile.organization.slug, profile]),
  );
}

export async function listEmployers(opts: EmployerListOptions = {}): Promise<EmployerListResult> {
  const [profilesBySlug] = await Promise.all([getPublicProfilesBySlug()]);
  const slugs = new Set<string>([
    ...EMPLOYER_KNOWLEDGE_SEEDS.map((seed) => seed.slug),
    ...profilesBySlug.keys(),
  ]);

  const allEmployers = [...slugs]
    .map((slug) => {
      const seed = getEmployerSeedBySlug(slug);
      const profile = profilesBySlug.get(slug);
      if (!isPublicEmployer(profile, seed)) {
        return null;
      }

      return buildEmployerDetail(slug, seed, profile);
    })
    .filter((detail): detail is EmployerDetail => Boolean(detail))
    .filter((detail) => applyListFilters(detail, opts))
    .sort((left, right) => {
      if (right.trustScore !== left.trustScore) {
        return right.trustScore - left.trustScore;
      }
      return right.openRoles - left.openRoles;
    });

  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 50));
  const employers = allEmployers.slice(offset, offset + limit).map(toSummary);

  log('info', 'employer.list', { count: employers.length, total: allEmployers.length, opts });

  return {
    employers,
    total: allEmployers.length,
    limit,
    offset,
  };
}

export async function getEmployerBySlug(slug: string): Promise<EmployerDetail | null> {
  const normalizedSlug = slug.trim();
  const [profile, seed] = await Promise.all([
    prisma.organizationProfile.findFirst({
      where: {
        organization: {
          slug: normalizedSlug,
        },
      },
      include: EMPLOYER_PROFILE_INCLUDE,
    }),
    Promise.resolve(getEmployerSeedBySlug(normalizedSlug)),
  ]);

  if (!isPublicEmployer(profile ?? undefined, seed)) {
    return null;
  }

  const employer = buildEmployerDetail(normalizedSlug, seed, profile ?? undefined);
  log('info', 'employer.view', { slug: normalizedSlug, source: profile ? 'db' : 'seed' });
  return employer;
}

export async function compareEmployers(slugs: string[]): Promise<EmployerCompareResult> {
  const employers = (
    await Promise.all(slugs.slice(0, 4).map((slug) => getEmployerBySlug(slug)))
  ).filter((detail): detail is EmployerDetail => Boolean(detail));

  const differentiators = computeDifferentiators(employers);
  log('info', 'employer.compare', { slugs, count: employers.length });

  return {
    employers,
    differentiators,
    comparedAt: new Date().toISOString(),
  };
}

export async function searchEmployers(query: string): Promise<EmployerSummary[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const result = await listEmployers({ limit: 100, offset: 0 });
  const employers = result.employers.filter((employer) =>
    employer.name.toLowerCase().includes(q) ||
    employer.facilityType.toLowerCase().includes(q) ||
    employer.specialties.some((specialty) => specialty.toLowerCase().includes(q)) ||
    employer.tagline.toLowerCase().includes(q) ||
    employer.states.some((state) => state.toLowerCase() === q),
  );

  log('info', 'employer.search', { query, count: employers.length });
  return employers;
}

function computeDifferentiators(employers: EmployerDetail[]): string[] {
  if (employers.length < 2) {
    return [];
  }

  const differentiators: string[] = [];
  const highestTrust = employers.reduce((best, current) => (
    current.trustScore > best.trustScore ? current : best
  ));
  const fastestStart = employers.reduce((best, current) => (
    parseStartDays(current.timeToStart) < parseStartDays(best.timeToStart) ? current : best
  ));

  if (highestTrust.trustScore > 0) {
    differentiators.push(`${highestTrust.name} has the highest trust score (${highestTrust.trustScore}).`);
  }

  const payTransparent = employers.filter((employer) => employer.payTransparency);
  if (payTransparent.length > 0 && payTransparent.length < employers.length) {
    differentiators.push(`${payTransparent.map((employer) => employer.name).join(', ')} publish pay ranges.`);
  }

  differentiators.push(`${fastestStart.name} offers the fastest start time (${fastestStart.timeToStart}).`);

  return differentiators;
}

function parseStartDays(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 99;
}
