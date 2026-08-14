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
  isPlaceholderOrganizationDomain,
} from '../employers/employerIntegrity';
import {
  attachOrganizationToAccessRequest,
  recordOrganizationAccessRequest,
} from '../employers/organizationAccessGovernance';

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
    // Realign the tenancy binding with the membership that already governs
    // this user. An employer whose organization predates the binding below
    // holds a valid ADMIN membership and a null `User.organizationId`; without
    // this, re-running setup would leave them just as unable to open their own
    // applications as before. The target is read from their OWN active
    // membership, so this can only ever bind a user to an organization they are
    // already a member of — never move them into someone else's.
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: membershipOrgProfile.organizationId },
    });

    return { organizationId: membershipOrgProfile.organizationId };
  }

  // ── Authority gate ───────────────────────────────────────────────────────
  // Creating an organization GRANTS the caller administrative membership over
  // it, so it needs an authority signal. This path once required only a
  // signed-in account plus a self-typed name: an NPPES lookup proves the
  // organization EXISTS, never that this person may act for it, so anyone could
  // take over any employer name. Self-serve requires a work email at the
  // organization's own domain; everything else routes to manual review.
  //
  // The decision is server-side and reads server-held facts: `user.email` comes
  // from the User row keyed by the Clerk id, never from the request body.
  //
  // Every outcome is now DURABLE. A refusal used to throw a 403 and vanish,
  // which made the refusal copy ("a VitalCV reviewer will verify your
  // authority") a promise nothing kept — there was no queue to land in and no
  // route to access for a legitimate operator at a different domain. Refusals
  // become PENDING_REVIEW rows; grants are recorded with the basis they were
  // granted on. Both emit an audit event and an outbox event.
  const decision = await recordOrganizationAccessRequest({
    clerkUserId,
    accountEmail: user.email,
    requestedName: canonicalIdentity.displayName,
    requestedNpi: normalizedNpi || null,
    requestedWebsite: canonicalIdentity.website,
    organizationDomain: canonicalIdentity.domain,
  });
  if (!decision.authorized) {
    throw new HttpError(403, decision.refusal ?? 'Access request submitted for review.');
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

  // The website is caller-supplied, so a domain match proves the caller
  // controls an address at a domain THEY named. That is a real signal about
  // the domain and none at all about a Type 2 NPI — otherwise anyone with a
  // work address at their own domain could send a hospital's real NPI and walk
  // away with the hospital's federal identifier bound to their organization.
  // The automatic grant therefore creates the organization WITHOUT the NPI;
  // binding it is a separate reviewed decision (npiBindingGranted).
  const npiToBind = decision.npiBindingGranted ? normalizedNpi : '';

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
          ...(npiToBind ? { npi: npiToBind } : {}),
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

  // Membership and tenancy binding are ONE fact, so they commit together.
  //
  // `User.organizationId` is the membership store the employer decision path
  // reads — `applicationService#getOrgForVerifier` and
  // `middleware/organizationContext#resolveVerifiedOrganizationId` both resolve
  // the caller's organization from this column and from nothing else. Creating
  // the workspace membership without it left a self-serve employer resolving to
  // no organization at all: `listAllOrgApplications` returned [], the
  // application was absent from the workflow map, and the employer got a 404
  // "Application not found." on their own application. Only
  // `prisma/seed-demo-accounts.ts` had ever written the column, which is why
  // seeded employers worked and every self-serve one was silently broken.
  await prisma.$transaction([
    prisma.workspaceMembership.create({
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
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { organizationId: org.id },
    }),
  ]);

  // Close the loop: the access request now points at the organization it
  // produced, so the record is a usable history rather than a loose intent.
  await attachOrganizationToAccessRequest(decision.requestId, org.id);

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

/**
 * Ceiling on rows pulled into memory when a request needs work SQL cannot do —
 * a keyword rank set, or a filter still derived at read time. It exists so one
 * request can never scan the whole table; when it bites, `truncated` says so
 * rather than letting a partial count read as a total.
 */
const SCAN_CAP = 500;

/** Filters computed by buildOpportunityTruth, so they cannot be a SQL predicate. */
function usesDerivedFilters(filters: OpportunityTruthFilters): boolean {
  return Boolean(
    filters.payModel
    || filters.profession
    || filters.schedule
    || filters.payMin !== undefined
    || filters.payMax !== undefined
    || filters.visaSponsorship
    || filters.benefits
    || filters.employerType
    || filters.startUrgency
    || filters.readinessStatus
    || filters.missingRequirement,
  );
}

/**
 * Keyword match, ranked, straight off the GIN index.
 *
 * websearch_to_tsquery is deliberate: it accepts what people already type into
 * a search box — "quoted phrases", OR, and -exclusion — and it never throws on
 * malformed input, unlike to_tsquery. The query text is parameterised, so it is
 * a value and not SQL.
 */
async function keywordRankedIds(query: string, cap: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Opportunity"
    WHERE "status" = 'ACTIVE'
      AND "search_vector" @@ websearch_to_tsquery('english', ${query})
    ORDER BY
      ts_rank("search_vector", websearch_to_tsquery('english', ${query})) DESC,
      "updated_at" DESC
    LIMIT ${cap}
  `;
  return rows.map((row) => row.id);
}

export async function listPublicOpportunities(filters: OpportunityTruthFilters & {
  q?: string;
  limit?: number;
  offset?: number;
  clinicianNpi?: string;
  clerkUserId?: string | null;
}): Promise<{ opportunities: OpportunityResult[]; total: number; truncated: boolean }> {
  const where: Prisma.OpportunityWhereInput = {
    status: 'ACTIVE',
    ...(filters.specialty ? { specialty: { contains: filters.specialty, mode: 'insensitive' as const } } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.hiringType ? { hiringType: filters.hiringType } : {}),
    ...(filters.organizationSlug ? { organization: { slug: filters.organizationSlug } } : {}),
    ...(typeof filters.remote === 'boolean' ? { remote: filters.remote } : {}),
  };

  // Keep seeded demo employers off the live public list in prod (flag off).
  // Combine via AND so it doesn't clobber an organizationSlug filter above.
  const listSeedExclusion = seededOrgExclusionFilter();
  if (listSeedExclusion.organization) {
    where.AND = [listSeedExclusion];
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 20;
  const query = filters.q?.trim() ?? '';

  const include = {
    organization: {
      include: {
        organizationProfile: true,
      },
    },
  } as const;
  const orderBy = [
    { updatedAt: 'desc' as const },
    { createdAt: 'desc' as const },
  ];

  let rankedIds: string[] | null = null;
  if (query) {
    rankedIds = await keywordRankedIds(query, SCAN_CAP);
    if (rankedIds.length === 0) {
      return { opportunities: [], total: 0, truncated: false };
    }
    where.id = { in: rankedIds };
  }

  const clinicianProfile = await resolveClinicianProfile({
    clerkUserId: filters.clerkUserId,
    clinicianNpi: filters.clinicianNpi,
  });

  // ── Fast path ──────────────────────────────────────────────────────────────
  // No keyword and no derived filter: every predicate is a SQL predicate, so
  // the database does the paging and the counting. This is the path that has to
  // hold up when ingestion takes this table past 100k rows — nothing is read
  // into memory beyond the page being returned.
  if (!rankedIds && !usesDerivedFilters(filters)) {
    const [total, rows] = await Promise.all([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({ where, include, orderBy, skip: offset, take: limit }),
    ]);

    return {
      opportunities: rows.map((opportunity) => buildOpportunityTruth({ opportunity, clinicianProfile })),
      total,
      truncated: false,
    };
  }

  // ── Bounded path ───────────────────────────────────────────────────────────
  // Either the ordering comes from ts_rank, or a filter is still derived at read
  // time (pay model, benefits, visa, readiness…). Both need rows in memory, so
  // the read is capped and the caller is told when the cap bit.
  const rows = await prisma.opportunity.findMany({
    where,
    include,
    orderBy,
    take: SCAN_CAP,
  });

  let normalized = rows
    .map((opportunity) => buildOpportunityTruth({ opportunity, clinicianProfile }))
    .filter((opportunity) => matchesOpportunityTruthFilters(opportunity, filters));

  if (rankedIds) {
    // findMany returned the rows in updatedAt order; restore relevance order.
    const rankPosition = new Map(rankedIds.map((id, index) => [id, index]));
    normalized = normalized.sort(
      (left, right) => (rankPosition.get(left.id) ?? Number.MAX_SAFE_INTEGER)
        - (rankPosition.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  return {
    opportunities: normalized.slice(offset, offset + limit),
    total: normalized.length,
    // The cap bit, so `total` is a floor rather than a count.
    truncated: rows.length >= SCAN_CAP,
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
