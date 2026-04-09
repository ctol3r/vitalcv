import { processApplicationBilling } from '../billing/billingEngine';
/**
 * applicationService.ts — Wave 229
 *
 * Clinician ↔ Opportunity application flow.
 *
 * Rules:
 *  - One application per (opportunity, clerkUserId)
 *  - Clinicians can withdraw their own application
 *  - Only the org that owns the opportunity can review/accept/decline
 */

import {
  ApplicationStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { log } from '../../obs/logger';
import { refreshActionRecommendations } from '../actions/actionEngineService';
import {
  buildHiringTimeline,
  extractHiringAutomationMetadata,
  recommendationPreviewFromMetadata,
  type HiringRecommendationPreview,
  type HiringTimelineEvent,
} from '../actions/hiringAutomationService';
import { parseOrganizationRequirementsEnvelope } from '../employers/pilotPolicy';
import {
  computeClinicianTrustState,
  type ClinicianTrustState,
} from '../trust/trustStateEngine';
import { HttpError } from '../../utils/httpError';

const prisma = new PrismaClient();
const NPI_RE = /^\d{10}$/;
const HIRING_AUTOMATION_ACTION_TYPES = [
  'READY_TO_INTERVIEW',
  'REQUEST_CREDENTIAL',
  'RISK_ESCALATED',
  'CONTINUE_REVIEW',
] as const;

const applicationWithOpportunity = Prisma.validator<Prisma.ApplicationDefaultArgs>()({
  include: {
    opportunity: {
      select: {
        id: true,
        organizationId: true,
        title: true,
        specialty: true,
        hiringType: true,
        state: true,
        payRange: true,
        status: true,
        organization: {
          select: {
            name: true,
            organizationProfile: {
              select: {
                requirements: true,
              },
            },
          },
        },
      },
    },
  },
});

const userWithProfile = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    personProfile: true,
  },
});

type ApplicationRecord = Prisma.ApplicationGetPayload<typeof applicationWithOpportunity>;
type ApplicantUserRecord = Prisma.UserGetPayload<typeof userWithProfile>;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApplyInput {
  opportunityId: string;
  clerkUserId: string;
  npi?: string;
  coverNote?: string;
}

export interface ReviewInput {
  applicationId: string;
  /** clerkUserId of the verifier making the decision */
  reviewerClerkUserId: string;
  status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED';
  reviewNote?: string;
}

export interface ApplicationProviderSummary {
  npi: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
}

export interface ApplicationEmployerSummary {
  organizationId: string;
  name: string | null;
}

export interface ApplicationReadinessSummary {
  readinessScore: number;
  readinessLevel: ClinicianTrustState['readiness_level'];
  readinessStatus: string;
  gapSummary: string[];
  keyCredentials: string[];
  trustSignals: string[];
}

export interface MarketplaceApplication {
  id: string;
  opportunityId: string;
  clerkUserId: string;
  npi: string | null;
  coverNote: string | null;
  status: ApplicationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  provider: ApplicationProviderSummary | null;
  employer: ApplicationEmployerSummary;
  readiness: ApplicationReadinessSummary | null;
  latestRecommendation: HiringRecommendationPreview | null;
  timeline: HiringTimelineEvent[];
  systemBehavesAutonomously: boolean;
  opportunity: {
    id: string;
    organizationId: string;
    organizationName: string | null;
    title: string;
    specialty: string;
    hiringType: string;
    state: string;
    payRange: string | null;
    status: string;
  };
}

// ── Create application ────────────────────────────────────────────────────────

export async function applyToOpportunity(input: ApplyInput): Promise<MarketplaceApplication> {
  const { opportunityId, clerkUserId, npi, coverNote } = input;

  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
  });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.status !== 'ACTIVE') {
    throw new HttpError(409, 'This opportunity is no longer accepting applications.');
  }

  const applicant = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { personProfile: true },
  });
  const resolvedNpi = normalizeProvidedNpi(npi) ?? applicant?.personProfile?.npi ?? null;
  if (!resolvedNpi) {
    throw new HttpError(409, 'Complete clinician onboarding before applying with VitalCV.');
  }

  const existing = await prisma.application.findUnique({
    where: { opportunityId_clerkUserId: { opportunityId, clerkUserId } },
    ...applicationWithOpportunity,
  });
  if (existing) {
    if (existing.status === 'WITHDRAWN') {
      const reactivated = await prisma.application.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          coverNote: coverNote ?? existing.coverNote,
          npi: resolvedNpi,
        },
        ...applicationWithOpportunity,
      });
      return hydrateApplication(reactivated, applicant ?? null);
    }

    return hydrateApplication(existing, applicant ?? null);
  }

  const created = await prisma.application.create({
    data: {
      opportunityId,
      clerkUserId,
      npi: resolvedNpi,
      coverNote: coverNote ?? null,
      status: 'PENDING',
    },
    ...applicationWithOpportunity,
  });

  return hydrateApplication(created, applicant ?? null);
}

// ── Clinician: list own applications ─────────────────────────────────────────

export async function listClinicianApplications(
  clerkUserId: string,
): Promise<MarketplaceApplication[]> {
  const applications = await prisma.application.findMany({
    where: { clerkUserId },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'desc' },
  });

  return hydrateApplications(applications);
}

// ── Clinician: withdraw application ──────────────────────────────────────────

export async function withdrawApplication(
  applicationId: string,
  clerkUserId: string,
): Promise<MarketplaceApplication> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.clerkUserId !== clerkUserId) throw new HttpError(403, 'Not your application.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Application is already withdrawn.');
  if (app.status === 'ACCEPTED') throw new HttpError(409, 'Cannot withdraw an accepted application.');

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: 'WITHDRAWN' },
    ...applicationWithOpportunity,
  });

  return hydrateApplication(updated);
}

// ── Verifier: list applications for an opportunity ───────────────────────────

export async function listApplicationsForOpportunity(
  opportunityId: string,
  verifierClerkUserId: string,
): Promise<MarketplaceApplication[]> {
  await assertVerifierOwnsOpportunity(opportunityId, verifierClerkUserId);

  const applications = await prisma.application.findMany({
    where: { opportunityId, status: { not: 'WITHDRAWN' } },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'asc' },
  });

  return hydrateApplications(applications);
}

// ── Verifier: review application ─────────────────────────────────────────────

export async function reviewApplication(input: ReviewInput): Promise<MarketplaceApplication> {
  const { applicationId, reviewerClerkUserId, status, reviewNote } = input;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { opportunity: true },
  });
  if (!app) throw new HttpError(404, 'Application not found.');
  if (app.status === 'WITHDRAWN') throw new HttpError(409, 'Cannot review a withdrawn application.');

  await assertVerifierOwnsOpportunity(app.opportunityId, reviewerClerkUserId);

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: status as ApplicationStatus,
      reviewedBy: reviewerClerkUserId,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
    ...applicationWithOpportunity,
  });

  return hydrateApplication(updated);
}

// ── Verifier: list all applications across org's opportunities ────────────────

export async function listAllOrgApplications(
  verifierClerkUserId: string,
): Promise<MarketplaceApplication[]> {
  const org = await getOrgForVerifier(verifierClerkUserId);
  if (!org) return [];

  const applications = await prisma.application.findMany({
    where: {
      opportunity: { organizationId: org.id },
      status: { not: 'WITHDRAWN' },
    },
    ...applicationWithOpportunity,
    orderBy: { createdAt: 'desc' },
  });

  return hydrateApplications(applications);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeProvidedNpi(npi?: string): string | null {
  if (!npi) {
    return null;
  }

  const normalized = npi.trim();
  if (!normalized) {
    return null;
  }

  if (!NPI_RE.test(normalized)) {
    throw new HttpError(400, 'npi must be exactly 10 digits.');
  }

  return normalized;
}

function formatFactLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function buildProviderSummary(
  application: ApplicationRecord,
  applicant: ApplicantUserRecord | null,
): ApplicationProviderSummary | null {
  const profile = applicant?.personProfile;
  const providerNpi = application.npi ?? profile?.npi ?? null;
  if (!providerNpi && !profile) {
    return null;
  }

  const firstName = profile?.firstName ?? null;
  const lastName = profile?.lastName ?? null;
  const fullName = [firstName, lastName].filter((part): part is string => Boolean(part)).join(' ').trim() || null;

  return {
    npi: providerNpi,
    fullName,
    firstName,
    lastName,
    specialty: profile?.specialty ?? null,
    stateOfPractice: profile?.stateOfPractice ?? null,
  };
}

function buildReadinessSummary(
  trustState: ClinicianTrustState,
): ApplicationReadinessSummary {
  const keyCredentials = trustState.facts
    .filter((fact) => {
      const normalizedStatus = fact.status.toLowerCase();
      return normalizedStatus === 'verified'
        || normalizedStatus === 'active'
        || normalizedStatus === 'clear';
    })
    .map((fact) => formatFactLabel(fact.factType))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);

  const trustSignals = [
    trustState.identityVerified ? 'NPI identity verified' : null,
    trustState.licensureStatus === 'verified' ? 'State licensure verified' : null,
    trustState.exclusionClear ? 'Sanctions clear' : null,
    trustState.credentialCount > 0 ? `${trustState.credentialCount} credential artifacts on file` : null,
    trustState.gap_summary[0] ?? null,
  ].filter((signal): signal is string => Boolean(signal)).slice(0, 4);

  return {
    readinessScore: trustState.readiness_score,
    readinessLevel: trustState.readiness_level,
    readinessStatus: trustState.readiness_status,
    gapSummary: trustState.gap_summary,
    keyCredentials,
    trustSignals,
  };
}

function employerAcceptanceKey(organizationId: string, clinicianNpi: string): string {
  return `${organizationId}:${clinicianNpi}`;
}

function automationEnabledForApplication(application: ApplicationRecord): boolean {
  const requirements = application.opportunity.organization.organizationProfile?.requirements;
  const envelope = parseOrganizationRequirementsEnvelope(requirements, []);
  return envelope.automationRules.enabled;
}

function systemBehavesAutonomously(
  application: ApplicationRecord,
  latestRecommendation: HiringRecommendationPreview | null,
): boolean {
  if (!automationEnabledForApplication(application) || !latestRecommendation) {
    return false;
  }

  return latestRecommendation.autoGenerated
    || latestRecommendation.workflowEffects.employerNotification
    || latestRecommendation.workflowEffects.clinicianRequest
    || latestRecommendation.workflowEffects.webhookEligible
    || latestRecommendation.workflowEffects.webhookQueued;
}

async function refreshHiringAutonomyState(): Promise<void> {
  try {
    await refreshActionRecommendations(new Date().toISOString(), prisma);
  } catch (error) {
    log('warn', 'applications: hiring_action_refresh_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function loadLatestRecommendationMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, HiringRecommendationPreview>> {
  const applicationIds = new Set(applications.map((application) => application.id));
  const providerNpis = [...new Set(applications
    .map((application) => application.npi)
    .filter((npi): npi is string => Boolean(npi)))];

  if (applicationIds.size === 0 || providerNpis.length === 0) {
    return new Map();
  }

  const rows = await prisma.actionRecommendation.findMany({
    where: {
      actionType: {
        in: [...HIRING_AUTOMATION_ACTION_TYPES],
      },
      targetEntityId: {
        in: providerNpis,
      },
    },
    select: {
      actionType: true,
      explanation: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const latestByApplicationId = new Map<string, HiringRecommendationPreview>();
  for (const row of rows) {
    const automationMetadata = extractHiringAutomationMetadata(row.metadata);
    if (!automationMetadata || !applicationIds.has(automationMetadata.applicationId)) {
      continue;
    }

    if (latestByApplicationId.has(automationMetadata.applicationId)) {
      continue;
    }

    const preview = recommendationPreviewFromMetadata(
      row.metadata,
      row.actionType,
      row.explanation,
      row.updatedAt.toISOString(),
    );
    if (!preview) {
      continue;
    }

    latestByApplicationId.set(automationMetadata.applicationId, preview);
  }

  return latestByApplicationId;
}

async function loadEmployerAcceptanceMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, string>> {
  const providerNpis = [...new Set(applications
    .map((application) => application.npi)
    .filter((npi): npi is string => Boolean(npi)))];
  const organizationIds = [...new Set(applications.map((application) => application.opportunity.organizationId))];

  if (providerNpis.length === 0 || organizationIds.length === 0) {
    return new Map();
  }

  const acceptances = await prisma.employerAcceptance.findMany({
    where: {
      employerId: {
        in: organizationIds,
      },
      clinicianNpi: {
        in: providerNpis,
      },
      status: 'ACCEPTED',
    },
    select: {
      employerId: true,
      clinicianNpi: true,
      acceptedAt: true,
    },
    orderBy: {
      acceptedAt: 'desc',
    },
  });

  const acceptanceMap = new Map<string, string>();
  for (const acceptance of acceptances) {
    const key = employerAcceptanceKey(acceptance.employerId, acceptance.clinicianNpi);
    if (!acceptanceMap.has(key)) {
      acceptanceMap.set(key, acceptance.acceptedAt.toISOString());
    }
  }

  return acceptanceMap;
}

async function loadApplicantMap(
  applications: readonly ApplicationRecord[],
): Promise<Map<string, ApplicantUserRecord>> {
  const clerkUserIds = [...new Set(applications.map((application) => application.clerkUserId))];
  if (clerkUserIds.length === 0) {
    return new Map();
  }

  const applicants = await prisma.user.findMany({
    where: {
      clerkUserId: {
        in: clerkUserIds,
      },
    },
    include: userWithProfile.include,
  });

  return new Map(applicants.map((applicant) => [applicant.clerkUserId, applicant]));
}

async function loadTrustStateMap(
  applications: readonly ApplicationRecord[],
  applicants: Map<string, ApplicantUserRecord>,
): Promise<Map<string, ClinicianTrustState | null>> {
  const npis = [...new Set(applications
    .map((application) => application.npi ?? applicants.get(application.clerkUserId)?.personProfile?.npi ?? null)
    .filter((npi): npi is string => Boolean(npi)))];

  const entries = await Promise.all(npis.map(async (npi) => {
    try {
      const trustState = await computeClinicianTrustState(npi);
      return [npi, trustState] as const;
    } catch {
      return [npi, null] as const;
    }
  }));

  return new Map(entries);
}

async function hydrateApplications(
  applications: readonly ApplicationRecord[],
): Promise<MarketplaceApplication[]> {
  await refreshHiringAutonomyState();
  const applicants = await loadApplicantMap(applications);
  const [trustStates, latestRecommendations, employerAcceptances] = await Promise.all([
    loadTrustStateMap(applications, applicants),
    loadLatestRecommendationMap(applications),
    loadEmployerAcceptanceMap(applications),
  ]);

  return applications.map((application) => {
    const applicant = applicants.get(application.clerkUserId) ?? null;
    const provider = buildProviderSummary(application, applicant);
    const providerNpi = provider?.npi ?? null;
    const readiness = providerNpi
      ? trustStates.get(providerNpi)
      : null;
    const latestRecommendation = latestRecommendations.get(application.id) ?? null;
    const acceptedAt = providerNpi
      ? employerAcceptances.get(employerAcceptanceKey(application.opportunity.organizationId, providerNpi)) ?? null
      : null;

    return {
      id: application.id,
      opportunityId: application.opportunityId,
      clerkUserId: application.clerkUserId,
      npi: application.npi ?? providerNpi,
      coverNote: application.coverNote ?? null,
      status: application.status,
      reviewedBy: application.reviewedBy ?? null,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewNote: application.reviewNote ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      provider,
      employer: {
        organizationId: application.opportunity.organizationId,
        name: application.opportunity.organization.name ?? null,
      },
      readiness: readiness ? buildReadinessSummary(readiness) : null,
      latestRecommendation,
      timeline: buildHiringTimeline({
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        updatedAt: application.updatedAt.toISOString(),
        latestRecommendation,
        acceptedAt,
      }),
      systemBehavesAutonomously: systemBehavesAutonomously(application, latestRecommendation),
      opportunity: {
        id: application.opportunity.id,
        organizationId: application.opportunity.organizationId,
        organizationName: application.opportunity.organization.name ?? null,
        title: application.opportunity.title,
        specialty: application.opportunity.specialty,
        hiringType: application.opportunity.hiringType,
        state: application.opportunity.state,
        payRange: application.opportunity.payRange ?? null,
        status: application.opportunity.status,
      },
    };
  });
}

async function hydrateApplication(
  application: ApplicationRecord,
  applicant?: ApplicantUserRecord | null,
): Promise<MarketplaceApplication> {
  if (applicant) {
    await refreshHiringAutonomyState();
    const [trustStates, latestRecommendations, employerAcceptances] = await Promise.all([
      loadTrustStateMap([application], new Map([[application.clerkUserId, applicant]])),
      loadLatestRecommendationMap([application]),
      loadEmployerAcceptanceMap([application]),
    ]);
    const provider = buildProviderSummary(application, applicant);
    const readiness = provider?.npi ? trustStates.get(provider.npi) ?? null : null;
    const latestRecommendation = latestRecommendations.get(application.id) ?? null;
    const acceptedAt = provider?.npi
      ? employerAcceptances.get(employerAcceptanceKey(application.opportunity.organizationId, provider.npi)) ?? null
      : null;

    return {
      id: application.id,
      opportunityId: application.opportunityId,
      clerkUserId: application.clerkUserId,
      npi: application.npi ?? provider?.npi ?? null,
      coverNote: application.coverNote ?? null,
      status: application.status,
      reviewedBy: application.reviewedBy ?? null,
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      reviewNote: application.reviewNote ?? null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
      provider,
      employer: {
        organizationId: application.opportunity.organizationId,
        name: application.opportunity.organization.name ?? null,
      },
      readiness: readiness ? buildReadinessSummary(readiness) : null,
      latestRecommendation,
      timeline: buildHiringTimeline({
        status: application.status,
        createdAt: application.createdAt.toISOString(),
        reviewedAt: application.reviewedAt?.toISOString() ?? null,
        updatedAt: application.updatedAt.toISOString(),
        latestRecommendation,
        acceptedAt,
      }),
      systemBehavesAutonomously: systemBehavesAutonomously(application, latestRecommendation),
      opportunity: {
        id: application.opportunity.id,
        organizationId: application.opportunity.organizationId,
        organizationName: application.opportunity.organization.name ?? null,
        title: application.opportunity.title,
        specialty: application.opportunity.specialty,
        hiringType: application.opportunity.hiringType,
        state: application.opportunity.state,
        payRange: application.opportunity.payRange ?? null,
        status: application.opportunity.status,
      },
    };
  }

  const [hydrated] = await hydrateApplications([application]);
  return hydrated;
}

async function getOrgForVerifier(clerkUserId: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user?.organizationId) return null;
  return prisma.organization.findUnique({ where: { id: user.organizationId } });
}

async function assertVerifierOwnsOpportunity(opportunityId: string, clerkUserId: string) {
  const org = await getOrgForVerifier(clerkUserId);
  if (!org) throw new HttpError(403, 'No organization associated with this user.');

  const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  if (!opp) throw new HttpError(404, 'Opportunity not found.');
  if (opp.organizationId !== org.id) {
    throw new HttpError(403, 'This opportunity does not belong to your organization.');
  }
}
