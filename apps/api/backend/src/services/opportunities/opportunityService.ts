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

import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import type { EmployerRequirementSpec } from '../employers/employerCatalog';
import {
  DEFAULT_AUTOMATION_RULES,
  buildOrganizationRequirementsEnvelope,
  parseOrganizationRequirementsEnvelope,
  type AutomationRules,
  type OrganizationAcceptanceRules,
  type TrustAcceptanceContracts,
} from '../employers/pilotPolicy';
import {
  buildClinicianOpportunityProfile,
  buildOpportunityTruth,
  matchesOpportunityTruthFilters,
  type OpportunityTruth,
  type OpportunityTruthFilters,
} from './opportunityTruth';

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

export type OpportunityResult = OpportunityTruth;

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
    requirements?: EmployerRequirementSpec[];
    pilotMode?: boolean;
    organizationAcceptanceRules?: OrganizationAcceptanceRules;
    trustAcceptanceContracts?: TrustAcceptanceContracts;
    automationRules?: AutomationRules;
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
    const existingEnvelope = parseOrganizationRequirementsEnvelope(
      existingMembership.organizationProfile.requirements,
      [],
    );
    const nextEnvelope = buildOrganizationRequirementsEnvelope({
      requirements: input.requirements ?? existingEnvelope.requirements,
      pilotMode: input.pilotMode ?? existingEnvelope.pilotMode,
      organizationAcceptanceRules:
        input.organizationAcceptanceRules ?? existingEnvelope.organizationAcceptanceRules,
      trustAcceptanceContracts:
        input.trustAcceptanceContracts ?? existingEnvelope.trustAcceptanceContracts,
      automationRules:
        input.automationRules ?? existingEnvelope.automationRules,
    });

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
        requirements: nextEnvelope as unknown as Prisma.InputJsonValue,
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
          requirements: buildOrganizationRequirementsEnvelope({
            requirements: input.requirements ?? [],
            pilotMode: input.pilotMode ?? false,
            organizationAcceptanceRules: input.organizationAcceptanceRules ?? {
              acceptL3CredentialsAutomatically: false,
              requirePsvOnlyForGaps: false,
            },
            trustAcceptanceContracts: input.trustAcceptanceContracts ?? {
              triggerDecisionCapsuleOnHire: false,
            },
            automationRules: input.automationRules ?? {
              ...DEFAULT_AUTOMATION_RULES,
              requiredCredentials: [...DEFAULT_AUTOMATION_RULES.requiredCredentials],
            },
          }) as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });

  const orgProfile = await prisma.organizationProfile.findUnique({
    where: { organizationId: org.id },
    select: { id: true },
  });
  if (!orgProfile) {
    throw new HttpError(500, 'Organization profile was not created.');
  }

  await prisma.workspaceMembership.create({
    data: {
      personProfileId: personProfile.id,
      organizationProfileId: orgProfile.id,
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

  const requirementsEnvelope = parseOrganizationRequirementsEnvelope(op.requirements, []);

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
    requirements: requirementsEnvelope.requirements,
    pilotMode: requirementsEnvelope.pilotMode,
    organizationAcceptanceRules: requirementsEnvelope.organizationAcceptanceRules,
    trustAcceptanceContracts: requirementsEnvelope.trustAcceptanceContracts,
    automationRules: requirementsEnvelope.automationRules,
  };
}

/* ── Opportunity CRUD ────────────────────────────────────────── */

async function resolveClinicianNpi(input: {
  clerkUserId?: string | null;
  clinicianNpi?: string | null;
}): Promise<string | null> {
  if (input.clinicianNpi && /^\d{10}$/.test(input.clinicianNpi)) {
    return input.clinicianNpi;
  }

  if (!input.clerkUserId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId: input.clerkUserId },
    select: { id: true },
  });
  if (!user) {
    return null;
  }

  const personProfile = await prisma.personProfile.findUnique({
    where: { userId: user.id },
    select: { npi: true },
  });

  return personProfile?.npi ?? null;
}

async function resolveClinicianProfile(input: {
  clerkUserId?: string | null;
  clinicianNpi?: string | null;
}) {
  const npi = await resolveClinicianNpi(input);
  if (!npi) {
    return null;
  }

  return buildClinicianOpportunityProfile({ npi });
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
    include: {
      organization: {
        include: {
          organizationProfile: true,
        },
      },
    },
  });

  return buildOpportunityTruth({ opportunity: opp });
}

export async function listOpportunitiesForOrg(clerkUserId: string): Promise<OpportunityResult[]> {
  const orgProfileId = await getOrgProfileIdForUser(clerkUserId);
  if (!orgProfileId) return [];

  const orgProfile = await prisma.organizationProfile.findUnique({ where: { id: orgProfileId } });
  if (!orgProfile) return [];

  const opps = await prisma.opportunity.findMany({
    where: { organizationId: orgProfile.organizationId },
    include: {
      organization: {
        include: {
          organizationProfile: true,
        },
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return opps.map((opportunity) => buildOpportunityTruth({ opportunity }));
}

export async function listPublicOpportunities(filters: OpportunityTruthFilters & {
  limit?: number;
  offset?: number;
  clinicianNpi?: string;
  clerkUserId?: string | null;
}): Promise<{ opportunities: OpportunityResult[]; total: number }> {
  const where: Prisma.OpportunityWhereInput = {
    status: 'ACTIVE',
    ...(filters.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' as const } } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.hiringType ? { hiringType: filters.hiringType } : {}),
    ...(filters.organizationSlug ? { organization: { slug: filters.organizationSlug } } : {}),
    ...(filters.remote ? { remote: true } : {}),
  };

  const [clinicianProfile, opportunities] = await Promise.all([
    resolveClinicianProfile({
      clerkUserId: filters.clerkUserId,
      clinicianNpi: filters.clinicianNpi,
    }),
    prisma.opportunity.findMany({
      where,
      include: {
        organization: {
          include: {
            organizationProfile: true,
          },
        },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    }),
  ]);

  const normalized = opportunities
    .map((opportunity) => buildOpportunityTruth({
      opportunity,
      clinicianProfile,
    }))
    .filter((opportunity) => matchesOpportunityTruthFilters(opportunity, filters));

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 20;

  return {
    opportunities: normalized.slice(offset, offset + limit),
    total: normalized.length,
  };
}

export async function getPublicOpportunityById(
  id: string,
  input: {
    clinicianNpi?: string;
    clerkUserId?: string | null;
  } = {},
): Promise<OpportunityResult | null> {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id,
      status: 'ACTIVE',
    },
    include: {
      organization: {
        include: {
          organizationProfile: true,
        },
      },
    },
  });

  if (!opportunity) {
    return null;
  }

  const clinicianProfile = await resolveClinicianProfile({
    clerkUserId: input.clerkUserId,
    clinicianNpi: input.clinicianNpi,
  });

  return buildOpportunityTruth({
    opportunity,
    clinicianProfile,
  });
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
