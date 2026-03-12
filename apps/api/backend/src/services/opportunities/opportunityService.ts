/**
 * opportunityService.ts — Wave 227
 *
 * CRUD for employer-posted Opportunities.
 * Also provides the candidate list (PersonProfiles with NPI) for verifiers.
 *
 * WorkspaceMembership links PersonProfile ↔ OrganizationProfile.
 * Flow to find org for a user:
 *   clerkUserId → User → PersonProfile → WorkspaceMembership → OrganizationProfile → Organization
 */

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';

/* ── Types ─────────────────────────────────────────────────── */

export interface CreateOpportunityInput {
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange?: string;
  requirementLevel?: string;
  description?: string;
  remote?: boolean;
}

export interface OpportunityResult {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: string;
}

export interface CandidateResult {
  userId: string;
  npi: string;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
  completeness: number;
}

/* ── Internal helpers ────────────────────────────────────────── */

async function getPersonProfile(clerkUserId: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) throw new HttpError(401, 'User not found.');

  const profile = await prisma.personProfile.findUnique({ where: { userId: user.id } });
  return { user, profile };
}

async function getOrgProfileIdForUser(clerkUserId: string): Promise<string | null> {
  const { profile } = await getPersonProfile(clerkUserId);
  if (!profile) return null;

  const membership = await prisma.workspaceMembership.findFirst({
    where: { personProfileId: profile.id, active: true },
  });
  return membership?.organizationProfileId ?? null;
}

/* ── Org setup ───────────────────────────────────────────────── */

export async function upsertOrgProfile(
  clerkUserId: string,
  input: {
    name: string;
    facilityType?: string;
    specialties?: string[];
    statesCovered?: string[];
    tagline?: string;
    description?: string;
    website?: string;
    hiringTypes?: string[];
  },
): Promise<{ organizationId: string }> {
  const { user, profile: existingProfile } = await getPersonProfile(clerkUserId);

  // Ensure PersonProfile exists (verifiers may not have NPI yet)
  const personProfile = existingProfile ?? await prisma.personProfile.create({
    data: { userId: user.id, completeness: 0 },
  });

  // Check for existing membership
  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: { personProfileId: personProfile.id, active: true },
    include: { organizationProfile: { include: { organization: true } } },
  });

  if (existingMembership) {
    // Update existing org profile
    await prisma.organization.update({
      where: { id: existingMembership.organizationProfile.organizationId },
      data: { name: input.name },
    });
    await prisma.organizationProfile.update({
      where: { id: existingMembership.organizationProfileId },
      data: {
        facilityType: input.facilityType,
        specialties: input.specialties ?? [],
        statesCovered: input.statesCovered ?? [],
        tagline: input.tagline,
        description: input.description,
        website: input.website,
        hiringTypes: input.hiringTypes ?? [],
      },
    });
    return { organizationId: existingMembership.organizationProfile.organizationId };
  }

  // Create new org + profile + membership
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;

  const org = await prisma.organization.create({
    data: {
      name: input.name,
      slug,
      organizationProfile: {
        create: {
          facilityType: input.facilityType ?? 'hospital',
          specialties: input.specialties ?? [],
          statesCovered: input.statesCovered ?? [],
          tagline: input.tagline,
          description: input.description,
          website: input.website,
          hiringTypes: input.hiringTypes ?? [],
        },
      },
    },
    include: { organizationProfile: true },
  });

  await prisma.workspaceMembership.create({
    data: {
      personProfileId: personProfile.id,
      organizationProfileId: org.organizationProfile!.id,
      role: 'ADMIN',
      active: true,
    },
  });

  return { organizationId: org.id };
}

export async function getOrgProfile(clerkUserId: string) {
  const orgProfileId = await getOrgProfileIdForUser(clerkUserId);
  if (!orgProfileId) return null;

  const op = await prisma.organizationProfile.findUnique({
    where: { id: orgProfileId },
    include: { organization: true },
  });
  if (!op) return null;

  return {
    organizationId: op.organizationId,
    name: op.organization.name,
    facilityType: op.facilityType,
    specialties: op.specialties,
    statesCovered: op.statesCovered,
    tagline: op.tagline,
    description: op.description,
    website: op.website,
    hiringTypes: op.hiringTypes,
  };
}

/* ── Opportunity CRUD ────────────────────────────────────────── */

function formatOpp(opp: {
  id: string;
  organizationId: string;
  organization: { name: string };
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: Date;
}): OpportunityResult {
  return {
    id: opp.id,
    organizationId: opp.organizationId,
    organizationName: opp.organization.name,
    title: opp.title,
    specialty: opp.specialty,
    hiringType: opp.hiringType,
    state: opp.state,
    payRange: opp.payRange,
    requirementLevel: opp.requirementLevel,
    description: opp.description,
    remote: opp.remote,
    status: opp.status,
    createdAt: opp.createdAt.toISOString(),
  };
}

export async function createOpportunity(
  clerkUserId: string,
  input: CreateOpportunityInput,
): Promise<OpportunityResult> {
  const orgProfileId = await getOrgProfileIdForUser(clerkUserId);
  if (!orgProfileId) throw new HttpError(404, 'No organization found. Complete your organization setup first.');

  const orgProfile = await prisma.organizationProfile.findUnique({ where: { id: orgProfileId } });
  if (!orgProfile) throw new HttpError(404, 'Organization profile not found.');

  const opp = await prisma.opportunity.create({
    data: {
      organizationId: orgProfile.organizationId,
      title: input.title,
      specialty: input.specialty,
      hiringType: input.hiringType,
      state: input.state,
      payRange: input.payRange ?? null,
      requirementLevel: input.requirementLevel ?? 'L1',
      description: input.description ?? null,
      remote: input.remote ?? false,
      status: 'ACTIVE',
    },
    include: { organization: true },
  });

  return formatOpp(opp);
}

export async function listOpportunitiesForOrg(clerkUserId: string): Promise<OpportunityResult[]> {
  const orgProfileId = await getOrgProfileIdForUser(clerkUserId);
  if (!orgProfileId) return [];

  const orgProfile = await prisma.organizationProfile.findUnique({ where: { id: orgProfileId } });
  if (!orgProfile) return [];

  const opps = await prisma.opportunity.findMany({
    where: { organizationId: orgProfile.organizationId },
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
  });

  return opps.map(formatOpp);
}

export async function listPublicOpportunities(filters: {
  specialty?: string;
  state?: string;
  hiringType?: string;
  limit?: number;
  offset?: number;
}): Promise<{ opportunities: OpportunityResult[]; total: number }> {
  const where = {
    status: 'ACTIVE',
    ...(filters.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' as const } } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.hiringType ? { hiringType: filters.hiringType } : {}),
  };

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 20,
      skip: filters.offset ?? 0,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { opportunities: opportunities.map(formatOpp), total };
}

/* ── Candidates ─────────────────────────────────────────────── */

export async function listCandidates(filters: {
  specialty?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<{ candidates: CandidateResult[]; total: number }> {
  const where = {
    npi: { not: null as null },
    ...(filters.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' as const } } : {}),
    ...(filters.state ? { stateOfPractice: filters.state } : {}),
  };

  const [profiles, total] = await Promise.all([
    prisma.personProfile.findMany({
      where,
      orderBy: { completeness: 'desc' },
      take: filters.limit ?? 20,
      skip: filters.offset ?? 0,
    }),
    prisma.personProfile.count({ where }),
  ]);

  return {
    candidates: profiles.map((p) => ({
      userId: p.userId,
      npi: p.npi!,
      firstName: p.firstName,
      lastName: p.lastName,
      specialty: p.specialty,
      stateOfPractice: p.stateOfPractice,
      completeness: p.completeness,
    })),
    total,
  };
}
