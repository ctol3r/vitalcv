// @ts-nocheck
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

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { seededOrgExclusionFilter } from './launchOpportunitySeed';
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
import {
  buildCanonicalOrganizationIdentity,
  describeOrganizationAuthorityRefusal,
  isPlaceholderOrganizationDomain,
  resolveOrganizationAuthority,
} from '../employers/employerIntegrity';

/* ── Types ─────────────────────────────────────────────────── */

export interface CreateOpportunityInput {
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange?: string;
  payMin?: number;
  payMax?: number;
  employerType?: string;
  startUrgency?: string;
  requirementLevel?: string;
  description?: string;
  remote?: boolean;
}

export type OpportunityStatus = 'ACTIVE' | 'CLOSED';

/**
 * Partial patch for an existing opportunity. Every field is optional — only
 * the keys that are present are written (an omitted key leaves the column
 * untouched). Nullable fields may be cleared by passing `null`. `status` lets
 * an employer close (or reopen) a posting.
 */
export interface UpdateOpportunityInput {
  title?: string;
  specialty?: string;
  hiringType?: string;
  state?: string;
  payRange?: string | null;
  payMin?: number | null;
  payMax?: number | null;
  employerType?: string | null;
  startUrgency?: string | null;
  requirementLevel?: string;
  description?: string | null;
  remote?: boolean;
  status?: OpportunityStatus;
}

const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = ['ACTIVE', 'CLOSED'];

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

const NPI_RE = /^\d{10}$/;

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
    npi?: string;
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
  const canonicalIdentity = buildCanonicalOrganizationIdentity({
    name: input.name,
    website: input.website,
  });
  const normalizedNpi = typeof input.npi === 'string' ? input.npi.trim() : '';

  if (canonicalIdentity.domain && isPlaceholderOrganizationDomain(canonicalIdentity.domain)) {
    throw new HttpError(400, 'Public employer profiles must use a real employer domain.');
  }

  if (normalizedNpi && !NPI_RE.test(normalizedNpi)) {
    throw new HttpError(400, 'Organization NPI must be exactly 10 digits.');
  }

  // Ensure PersonProfile exists (verifiers may not have NPI yet)
  const personProfile = existingProfile ?? await prisma.personProfile.create({
    data: { userId: user.id, completeness: 0 },
  });

  // Check for existing membership. WorkspaceMembership has NO Prisma
  // relation to OrganizationProfile (plain FK column) — an include here
  // throws P2009 at runtime; fetch the profile by FK and stitch instead.
  const existingMembership = await prisma.workspaceMembership.findFirst({
    where: { personProfileId: personProfile.id, active: true },
  });
  const membershipOrgProfile = existingMembership
    ? await prisma.organizationProfile.findUnique({
        where: { id: existingMembership.organizationProfileId },
      })
    : null;

  if (existingMembership) {
    if (!membershipOrgProfile) {
      throw new HttpError(500, 'Workspace membership references a missing organization profile.');
    }
    const conflictingOrg = await prisma.organization.findUnique({
      where: { slug: canonicalIdentity.slug },
      select: { id: true },
    });
    if (conflictingOrg && conflictingOrg.id !== membershipOrgProfile.organizationId) {
      throw new HttpError(409, 'An organization with this canonical identity already exists.');
    }

    const existingEnvelope = parseOrganizationRequirementsEnvelope(
      membershipOrgProfile.requirements,
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
      where: { id: membershipOrgProfile.organizationId },
      data: {
        name: canonicalIdentity.displayName,
        slug: canonicalIdentity.slug,
      },
    });
    await prisma.organizationProfile.update({
      where: { id: existingMembership.organizationProfileId },
      data: {
        ...(normalizedNpi ? { npi: normalizedNpi } : {}),
        facilityType: input.facilityType,
        specialties: input.specialties ?? [],
        statesCovered: input.statesCovered ?? [],
        tagline: input.tagline,
        description: input.description,
        website: canonicalIdentity.website,
        hiringTypes: input.hiringTypes ?? [],
        requirements: nextEnvelope as unknown as Prisma.InputJsonValue,
      },
    });
    return { organizationId: membershipOrgProfile.organizationId };
  }

  // ── Authority gate ───────────────────────────────────────────────────────
  // Creating an organization GRANTS the caller administrative membership over
  // it, so it needs an authority signal. Previously this path required only a
  // signed-in account plus a self-typed name: an NPPES lookup proves the
  // organization EXISTS, never that this person may act for it, so anyone could
  // take over any employer name. Self-serve now requires a work email at the
  // organization's own domain; everything else routes to manual review.
  const authority = resolveOrganizationAuthority({
    accountEmail: user.email,
    organizationDomain: canonicalIdentity.domain,
  });
  if (!authority.authorized) {
    throw new HttpError(403, describeOrganizationAuthorityRefusal(authority.reason));
  }

  // An organization NPI identifies exactly one organization. Without this, the
  // NPI was a decorative attribute and the same NPI could back several orgs.
  if (normalizedNpi) {
    const npiOwner = await prisma.organizationProfile.findFirst({
      where: { npi: normalizedNpi },
      select: { organizationId: true },
    });
    if (npiOwner) {
      throw new HttpError(
        409,
        'That organization NPI is already registered to a VitalCV organization. Request access instead of registering it again.',
      );
    }
  }

  // Create new org + profile + membership
  const existingOrganization = await prisma.organization.findUnique({
    where: { slug: canonicalIdentity.slug },
    select: { id: true },
  });
  if (existingOrganization) {
    throw new HttpError(409, 'An organization with this canonical identity already exists.');
  }

  const org = await prisma.organization.create({
    data: {
      name: canonicalIdentity.displayName,
      slug: canonicalIdentity.slug,
      organizationProfile: {
        create: {
          ...(normalizedNpi ? { npi: normalizedNpi } : {}),
          facilityType: input.facilityType ?? 'hospital',
          specialties: input.specialties ?? [],
          statesCovered: input.statesCovered ?? [],
          tagline: input.tagline,
          description: input.description,
          website: canonicalIdentity.website,
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
      // workspace_memberships.id has no DB default despite the schema's
      // dbgenerated(gen_random_uuid()) (verified in prod 2026-07-05) —
      // supply the id client-side or the insert throws P2011.
      id: randomUUID(),
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
      payMin: input.payMin ?? null,
      payMax: input.payMax ?? null,
      employerType: input.employerType ?? null,
      startUrgency: input.startUrgency ?? null,
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

export async function updateOpportunity(
  clerkUserId: string,
  id: string,
  fields: UpdateOpportunityInput,
): Promise<OpportunityResult> {
  const orgProfileId = await getOrgProfileIdForUser(clerkUserId);
  if (!orgProfileId) throw new HttpError(404, 'No organization found. Complete your organization setup first.');

  const orgProfile = await prisma.organizationProfile.findUnique({ where: { id: orgProfileId } });
  if (!orgProfile) throw new HttpError(404, 'Organization profile not found.');

  // Ownership gate: an employer may only edit opportunities posted under their
  // own organization. Fetch the row's owner first, then 404 (missing) / 403
  // (someone else's posting) before any write.
  const existing = await prisma.opportunity.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!existing) throw new HttpError(404, 'Opportunity not found.');
  if (existing.organizationId !== orgProfile.organizationId) {
    throw new HttpError(403, 'You can only edit opportunities posted by your organization.');
  }

  if (fields.status !== undefined && !OPPORTUNITY_STATUSES.includes(fields.status)) {
    throw new HttpError(400, "status must be 'ACTIVE' or 'CLOSED'.");
  }

  // Only write the fields that were actually provided (partial patch).
  const data: Prisma.OpportunityUpdateInput = {};
  if (fields.title !== undefined) data.title = fields.title;
  if (fields.specialty !== undefined) data.specialty = fields.specialty;
  if (fields.hiringType !== undefined) data.hiringType = fields.hiringType;
  if (fields.state !== undefined) data.state = fields.state;
  if (fields.payRange !== undefined) data.payRange = fields.payRange;
  if (fields.payMin !== undefined) data.payMin = fields.payMin;
  if (fields.payMax !== undefined) data.payMax = fields.payMax;
  if (fields.employerType !== undefined) data.employerType = fields.employerType;
  if (fields.startUrgency !== undefined) data.startUrgency = fields.startUrgency;
  if (fields.requirementLevel !== undefined) data.requirementLevel = fields.requirementLevel;
  if (fields.description !== undefined) data.description = fields.description;
  if (fields.remote !== undefined) data.remote = fields.remote;
  if (fields.status !== undefined) data.status = fields.status;

  const opp = await prisma.opportunity.update({
    where: { id },
    data,
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

  // Keep seeded demo employers off the live public list in prod (flag off).
  // Combine via AND so it doesn't clobber an organizationSlug filter above.
  const listSeedExclusion = seededOrgExclusionFilter();
  if (listSeedExclusion.organization) {
    where.AND = [listSeedExclusion];
  }

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
      // A seeded demo posting is not a real opening — hide it in prod (flag off).
      ...seededOrgExclusionFilter(),
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
