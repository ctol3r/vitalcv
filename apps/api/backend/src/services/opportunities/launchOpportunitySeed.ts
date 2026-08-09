// @ts-nocheck
import { EmployerHiringStatus, type Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

type SeedLogger = (
  level: 'info' | 'warn' | 'error',
  message: string,
  fields?: Record<string, unknown>,
) => void;

interface SeedOrganization {
  slug: string;
  name: string;
  facilityType: string;
  specialties: string[];
  statesCovered: string[];
  tagline: string;
  description: string;
  trustScore: number;
  recentHires: number;
  hiringTypes: string[];
  timeToStart: string;
  timeToOnboard: string;
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange: string | null;
  requirements: Array<{
    label: string;
    level: 'L1' | 'L2' | 'L3';
    note?: string;
    key?: string;
    priority?: 'required' | 'preferred';
    state?: string;
    specialty?: string;
  }>;
  verifiedSince: string;
}

interface SeedOpportunity {
  organizationSlug: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: 'L1' | 'L2' | 'L3';
  description: string;
  remote: boolean;
  status: 'ACTIVE';
}

export const SEEDED_ORGANIZATIONS: readonly SeedOrganization[] = [
  {
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    facilityType: 'specialty_practice',
    specialties: ['Cardiology'],
    statesCovered: ['CA'],
    tagline: 'Rapid credentialing for interventional cardiology and electrophysiology coverage.',
    description:
      'Bay Area Cardiac Group places board-certified cardiologists across San Francisco and the East Bay with a credentialing desk that turns files in under one week.',
    trustScore: 94,
    recentHires: 6,
    hiringTypes: ['locums', 'perm'],
    timeToStart: '2-3 weeks',
    timeToOnboard: '5 business days',
    clearToStartThreshold: 'Active CA medical license, ABIM board certification, active DEA, and sanctions-clear profile.',
    payTransparency: true,
    payRange: '$310-$380/hr',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active and unrestricted', key: 'state_license', priority: 'required', state: 'CA' },
      { label: 'ABIM Cardiology Board Certification', level: 'L3', key: 'board_cert', priority: 'required', specialty: 'Cardiology' },
      { label: 'DEA Registration', level: 'L2', note: 'California active registration', key: 'dea', priority: 'required', state: 'CA' },
      { label: 'Sanctions Clearance', level: 'L3', key: 'sanctions_clear', priority: 'required' },
    ],
    verifiedSince: '2023-06-01T00:00:00.000Z',
  },
  {
    slug: 'mindbridge-health',
    name: 'MindBridge Health',
    facilityType: 'telehealth_platform',
    specialties: ['Psychiatry', 'Behavioral Health'],
    statesCovered: ['CA', 'TX', 'FL', 'WA'],
    tagline: 'Multi-state behavioral health coverage with telepsychiatry-first ops.',
    description:
      'MindBridge Health hires psychiatrists into a multi-state telehealth network with payer enrollment and credentialing support handled centrally.',
    trustScore: 91,
    recentHires: 23,
    hiringTypes: ['telehealth', 'part-time', 'locums'],
    timeToStart: 'Flexible',
    timeToOnboard: '3-7 business days',
    clearToStartThreshold: 'Active state license in target state, active NPI, and controlled-substance registration when required.',
    payTransparency: true,
    payRange: '$200-$270/hr',
    requirements: [
      { label: 'State Medical License', level: 'L3', note: 'Active in target state', key: 'state_license', priority: 'required' },
      { label: 'DEA Registration', level: 'L2', note: 'Required for controlled-substance workflows', key: 'dea', priority: 'required' },
      { label: 'NPI Verified', level: 'L3', key: 'npi', priority: 'required' },
      { label: 'Board Certification', level: 'L2', note: 'Preferred but not mandatory', key: 'board_cert', priority: 'preferred', specialty: 'Psychiatry' },
    ],
    verifiedSince: '2023-09-15T00:00:00.000Z',
  },
  {
    slug: 'sacramento-medical-center',
    name: 'Sacramento Medical Center',
    facilityType: 'hospital_system',
    specialties: ['Critical Care', 'Internal Medicine'],
    statesCovered: ['CA'],
    tagline: 'Hospital-based critical care and hospitalist coverage with expedited privileging.',
    description:
      'Sacramento Medical Center operates a live ICU and hospitalist staffing pipeline with dedicated privileging staff and VitalCV-backed trust review.',
    trustScore: 88,
    recentHires: 11,
    hiringTypes: ['locums', 'perm', 'prn'],
    timeToStart: 'Immediate',
    timeToOnboard: '5-10 business days',
    clearToStartThreshold: 'Active CA license, board certification, BLS/ACLS, and a full credentialing packet.',
    payTransparency: false,
    payRange: null,
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active and unrestricted', key: 'state_license', priority: 'required', state: 'CA' },
      { label: 'Board Certification', level: 'L3', key: 'board_cert', priority: 'required', specialty: 'Critical Care' },
      { label: 'BLS / ACLS', level: 'L3', key: 'acls', priority: 'required' },
      { label: 'Hospital Credentialing File', level: 'L3', key: 'hospital_privileges', priority: 'required' },
    ],
    verifiedSince: '2022-11-01T00:00:00.000Z',
  },
  {
    slug: 'northwest-locums-alliance',
    name: 'Northwest Locums Alliance',
    facilityType: 'staffing_agency',
    specialties: ['Family Medicine'],
    statesCovered: ['WA', 'OR'],
    tagline: 'Pacific Northwest locums coverage with fast placement and clean credential packets.',
    description:
      'Northwest Locums Alliance fills rural and urban family medicine shifts across Washington and Oregon with credentialing coordination handled in-house.',
    trustScore: 86,
    recentHires: 18,
    hiringTypes: ['locums', 'contract'],
    timeToStart: '7-10 days',
    timeToOnboard: '4-6 business days',
    clearToStartThreshold: 'Active state license, recent references, and current malpractice coverage.',
    payTransparency: true,
    payRange: '$180-$220/hr',
    requirements: [
      { label: 'WA or OR Medical License', level: 'L3', key: 'state_license', priority: 'required' },
      { label: 'Current Malpractice Coverage', level: 'L2', key: 'malpractice', priority: 'required' },
      { label: 'Recent Clinical References', level: 'L2', priority: 'required' },
    ],
    verifiedSince: '2023-02-10T00:00:00.000Z',
  },
  {
    // Named fictionally on purpose. This entry used to carry a real health
    // system's name ("Kaiser Permanente NorCal"), which put a real company's
    // brand on a job that does not exist — and the row reached production.
    // Demo fixtures never borrow a real organization's identity.
    slug: 'northgate-valley-health',
    name: 'Northgate Valley Health (demo)',
    facilityType: 'health_system',
    specialties: ['Internal Medicine'],
    statesCovered: ['CA'],
    tagline: 'Integrated regional health system hiring into permanent medicine teams.',
    description:
      'Northgate Valley Health runs permanent internal medicine hiring with structured onboarding, privileged access workflows, and standardized trust thresholds.',
    trustScore: 95,
    recentHires: 14,
    hiringTypes: ['perm'],
    timeToStart: '4-6 weeks',
    timeToOnboard: '7-10 business days',
    clearToStartThreshold: 'Active CA license, board certification, active NPI, and complete primary source verification.',
    payTransparency: false,
    payRange: null,
    requirements: [
      { label: 'CA Medical License', level: 'L3', key: 'state_license', priority: 'required', state: 'CA' },
      { label: 'Board Certification', level: 'L3', key: 'board_cert', priority: 'required', specialty: 'Internal Medicine' },
      { label: 'Primary Source Verification Packet', level: 'L3', priority: 'required' },
      { label: 'NPI Verified', level: 'L3', key: 'npi', priority: 'required' },
    ],
    verifiedSince: '2023-01-09T00:00:00.000Z',
  },
] as const;

/**
 * Slugs this fixture has USED IN THE PAST but no longer emits.
 *
 * Deriving the exclusion list from SEEDED_ORGANIZATIONS alone looks airtight
 * and is not: a seeded row keeps the slug it was written with, so renaming an
 * entry here silently un-protects every database that already has the old row.
 * That is not hypothetical — production served a demo posting under
 * `kaiser-permanente-norcal` for weeks while the exclusion list named
 * `kaiser-permanente-northern-california`, so `notIn` never matched the one org
 * the filter's own comment claimed to cover.
 *
 * Every slug retired from the fixture above belongs here, permanently. The list
 * only grows.
 */
export const LEGACY_SEEDED_ORG_SLUGS: readonly string[] = [
  'kaiser-permanente-norcal',
  'kaiser-permanente-northern-california',
];

/**
 * Slugs of the demo/launch seed organizations. Exposed so live matching can
 * EXCLUDE already-seeded demo rows (which may still exist in production from
 * earlier seeding) without deleting any data. Derived from SEEDED_ORGANIZATIONS
 * so the two never drift, and unioned with the slugs this fixture used to emit
 * so a rename cannot strand a live row.
 */
export const SEEDED_ORG_SLUGS: readonly string[] = [
  ...new Set([
    ...SEEDED_ORGANIZATIONS.map((organization) => organization.slug),
    ...LEGACY_SEEDED_ORG_SLUGS,
  ]),
];

/**
 * Demo/launch opportunity seeding is OFF by default. Production leaves
 * SEED_DEMO_OPPORTUNITIES unset so it never auto-seeds demo data; dev/demo sets
 * SEED_DEMO_OPPORTUNITIES=1 (also accepts true/yes/on) to auto-seed on startup
 * and to include seeded rows in live matching. Explicit seed scripts
 * (`pnpm seed:opportunities`) call seedLaunchOpportunities directly and are
 * intentionally NOT gated by this flag.
 */
export function isDemoOpportunitySeedEnabled(): boolean {
  const raw = process.env.SEED_DEMO_OPPORTUNITIES;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

/**
 * Shared Prisma `where` fragment that keeps seeded demo employers out of live
 * surfaces in production (flag off) while including them in dev (flag on). Used
 * by the MATCHA match feed AND the public opportunity list/detail so nothing
 * demo-branded reaches real clinicians.
 *
 * This is defence in depth, NOT the primary control: it only suppresses rows at
 * read time, so any read path that forgets it republishes the data. Rows that
 * should not exist are closed by `retireSeededLaunchOpportunities` at boot.
 *
 * Empty object when the demo flag is on. Combine via `AND` when the caller also
 * filters by organization slug, so the two organization clauses don't clobber.
 */
export function seededOrgExclusionFilter(): { organization?: { slug: { notIn: string[] } } } {
  return isDemoOpportunitySeedEnabled()
    ? {}
    : { organization: { slug: { notIn: [...SEEDED_ORG_SLUGS] } } };
}

/**
 * Close every ACTIVE demo/launch posting, so a database that was seeded before
 * the flag gate existed does not keep publishing invented jobs.
 *
 * Retiring beats filtering. A read-time exclusion has to be remembered by every
 * current and future query; a CLOSED row is gone from all of them at once,
 * including any surface written after this. The rows are closed rather than
 * deleted so an operator can still see what was published and when.
 *
 * No-ops when demo seeding is explicitly enabled — that environment wants the
 * fixtures.
 */
export async function retireSeededLaunchOpportunities(options: {
  prismaClient?: PrismaClient;
  logger?: SeedLogger;
} = {}): Promise<{ retiredOpportunityCount: number; skipped: boolean }> {
  const prismaClient = options.prismaClient ?? prisma;
  const logger = options.logger;

  if (isDemoOpportunitySeedEnabled()) {
    logger?.('info', 'launch_opportunity_retire.skipped_demo_enabled');
    return { retiredOpportunityCount: 0, skipped: true };
  }

  const { count } = await prismaClient.opportunity.updateMany({
    where: {
      status: 'ACTIVE',
      organization: { slug: { in: [...SEEDED_ORG_SLUGS] } },
    },
    data: { status: 'CLOSED' },
  });

  logger?.(count > 0 ? 'warn' : 'info', 'launch_opportunity_retire.completed', {
    retiredOpportunityCount: count,
    slugs: [...SEEDED_ORG_SLUGS],
  });

  return { retiredOpportunityCount: count, skipped: false };
}

export const SEEDED_LAUNCH_OPPORTUNITIES: readonly SeedOpportunity[] = [
  {
    organizationSlug: 'bay-area-cardiac-group',
    title: 'Locums Interventional Cardiologist',
    specialty: 'Cardiology',
    hiringType: 'locums',
    state: 'CA',
    payRange: '$310-$380/hr',
    requirementLevel: 'L3',
    description:
      'Seven-on, seven-off interventional cardiology coverage across two Bay Area hospitals with cath lab privileges and existing support staff in place.',
    remote: false,
    status: 'ACTIVE',
  },
  {
    organizationSlug: 'mindbridge-health',
    title: 'Telehealth Psychiatrist - Multi-State Licensure Preferred',
    specialty: 'Psychiatry',
    hiringType: 'telehealth',
    state: 'CA',
    payRange: '$200-$270/hr',
    requirementLevel: 'L2',
    description:
      'Remote adult psychiatry panel with multi-state expansion support, centralized scheduling, and credentialing coordination handled by MindBridge.',
    remote: true,
    status: 'ACTIVE',
  },
  {
    organizationSlug: 'sacramento-medical-center',
    title: 'Critical Care Nurse Practitioner - ICU Nights',
    specialty: 'Critical Care',
    hiringType: 'locums',
    state: 'CA',
    payRange: '$120-$145/hr',
    requirementLevel: 'L3',
    description:
      'Level II trauma center ICU coverage on a 13-week assignment with immediate privileging review and night shift differential.',
    remote: false,
    status: 'ACTIVE',
  },
  {
    organizationSlug: 'northwest-locums-alliance',
    title: 'Family Medicine Physician - Rural Washington Coverage',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    state: 'WA',
    payRange: '$180-$220/hr',
    requirementLevel: 'L2',
    description:
      'Rural access clinic assignment with housing stipend, predictable 4x10 schedule, and a pre-cleared onboarding packet.',
    remote: false,
    status: 'ACTIVE',
  },
  {
    organizationSlug: 'northgate-valley-health',
    title: 'Staff Internist - East Bay Access Clinics',
    specialty: 'Internal Medicine',
    hiringType: 'perm',
    state: 'CA',
    payRange: null,
    requirementLevel: 'L3',
    description:
      'Permanent outpatient internal medicine role covering two East Bay access clinics with shared call and full onboarding support.',
    remote: false,
    status: 'ACTIVE',
  },
] as const;

export interface LaunchOpportunitySeedSummary {
  activeOpportunityCount: number;
  seededOpportunityCount: number;
  createdOrganizationCount: number;
  skipped: boolean;
}

function requirementsAsJson(
  requirements: SeedOrganization['requirements'],
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(requirements)) as Prisma.InputJsonValue;
}

export async function seedLaunchOpportunities(
  prismaClient: PrismaClient = prisma,
  logger?: SeedLogger,
): Promise<LaunchOpportunitySeedSummary> {
  const organizationIdsBySlug = new Map<string, string>();
  let createdOrganizationCount = 0;

  for (const organization of SEEDED_ORGANIZATIONS) {
    const existing = await prismaClient.organization.findUnique({
      where: { slug: organization.slug },
      select: {
        id: true,
        organizationProfile: {
          select: { id: true },
        },
      },
    });

    if (existing) {
      organizationIdsBySlug.set(organization.slug, existing.id);

      await prismaClient.organization.update({
        where: { id: existing.id },
        data: {
          name: organization.name,
        },
      });

      const profileUpdateData: Prisma.OrganizationProfileUncheckedUpdateInput = {
        facilityType: organization.facilityType,
        specialties: [...organization.specialties],
        statesCovered: [...organization.statesCovered],
        tagline: organization.tagline,
        description: organization.description,
        trustScore: organization.trustScore,
        recentHires: organization.recentHires,
        hiringStatus: EmployerHiringStatus.HIRING_NOW,
        hiringTypes: [...organization.hiringTypes],
        timeToStart: organization.timeToStart,
        timeToOnboard: organization.timeToOnboard,
        clearToStartThreshold: organization.clearToStartThreshold,
        payTransparency: organization.payTransparency,
        payRange: organization.payRange,
        requirements: requirementsAsJson(organization.requirements),
        verifiedSince: new Date(organization.verifiedSince),
        verified: true,
        openRoles: SEEDED_LAUNCH_OPPORTUNITIES.filter(
          (opportunity) => opportunity.organizationSlug === organization.slug,
        ).length,
      };

      if (!existing.organizationProfile) {
        const profileCreateData: Prisma.OrganizationProfileUncheckedCreateInput = {
          organizationId: existing.id,
          facilityType: organization.facilityType,
          specialties: [...organization.specialties],
          statesCovered: [...organization.statesCovered],
          tagline: organization.tagline,
          description: organization.description,
          trustScore: organization.trustScore,
          recentHires: organization.recentHires,
          hiringStatus: EmployerHiringStatus.HIRING_NOW,
          hiringTypes: [...organization.hiringTypes],
          timeToStart: organization.timeToStart,
          timeToOnboard: organization.timeToOnboard,
          clearToStartThreshold: organization.clearToStartThreshold,
          payTransparency: organization.payTransparency,
          payRange: organization.payRange,
          requirements: requirementsAsJson(organization.requirements),
          verifiedSince: new Date(organization.verifiedSince),
          verified: true,
          openRoles: SEEDED_LAUNCH_OPPORTUNITIES.filter(
            (opportunity) => opportunity.organizationSlug === organization.slug,
          ).length,
        };

        await prismaClient.organizationProfile.create({
          data: profileCreateData,
        });
      } else {
        await prismaClient.organizationProfile.update({
          where: { organizationId: existing.id },
          data: profileUpdateData,
        });
      }

      continue;
    }

    const created = await prismaClient.organization.create({
      data: {
        name: organization.name,
        slug: organization.slug,
        organizationProfile: {
          create: {
            facilityType: organization.facilityType,
            specialties: [...organization.specialties],
            statesCovered: [...organization.statesCovered],
            tagline: organization.tagline,
            description: organization.description,
            trustScore: organization.trustScore,
            recentHires: organization.recentHires,
            hiringStatus: EmployerHiringStatus.HIRING_NOW,
            hiringTypes: [...organization.hiringTypes],
            timeToStart: organization.timeToStart,
            timeToOnboard: organization.timeToOnboard,
            clearToStartThreshold: organization.clearToStartThreshold,
            payTransparency: organization.payTransparency,
            payRange: organization.payRange,
            requirements: requirementsAsJson(organization.requirements),
            verifiedSince: new Date(organization.verifiedSince),
            verified: true,
            openRoles: SEEDED_LAUNCH_OPPORTUNITIES.filter(
              (opportunity) => opportunity.organizationSlug === organization.slug,
            ).length,
          },
        },
      },
      select: { id: true },
    });

    organizationIdsBySlug.set(organization.slug, created.id);
    createdOrganizationCount += 1;
  }

  let seededOpportunityCount = 0;
  for (const opportunity of SEEDED_LAUNCH_OPPORTUNITIES) {
    const organizationId = organizationIdsBySlug.get(opportunity.organizationSlug);
    if (!organizationId) {
      logger?.('warn', 'launch_opportunity_seed.organization_missing', {
        organizationSlug: opportunity.organizationSlug,
        title: opportunity.title,
      });
      continue;
    }

    const existing = await prismaClient.opportunity.findFirst({
      where: {
        organizationId,
        title: opportunity.title,
      },
      select: { id: true },
    });

    const opportunityUpdateData: Prisma.OpportunityUncheckedUpdateInput = {
      title: opportunity.title,
      specialty: opportunity.specialty,
      hiringType: opportunity.hiringType,
      state: opportunity.state,
      payRange: opportunity.payRange,
      requirementLevel: opportunity.requirementLevel,
      description: opportunity.description,
      remote: opportunity.remote,
      status: opportunity.status,
    };

    if (existing) {
      await prismaClient.opportunity.update({
        where: { id: existing.id },
        data: opportunityUpdateData,
      });
      continue;
    }

    const opportunityCreateData: Prisma.OpportunityUncheckedCreateInput = {
      organizationId,
      title: opportunity.title,
      specialty: opportunity.specialty,
      hiringType: opportunity.hiringType,
      state: opportunity.state,
      payRange: opportunity.payRange,
      requirementLevel: opportunity.requirementLevel,
      description: opportunity.description,
      remote: opportunity.remote,
      status: opportunity.status,
    };

    await prismaClient.opportunity.create({
      data: opportunityCreateData,
    });
    seededOpportunityCount += 1;
  }

  const activeOpportunityCount = await prismaClient.opportunity.count({
    where: { status: 'ACTIVE' },
  });

  logger?.('info', 'launch_opportunity_seed.completed', {
    activeOpportunityCount,
    seededOpportunityCount,
    createdOrganizationCount,
  });

  return {
    activeOpportunityCount,
    seededOpportunityCount,
    createdOrganizationCount,
    skipped: false,
  };
}

export async function ensureLaunchOpportunitiesBootstrapped(options: {
  prismaClient?: PrismaClient;
  logger?: SeedLogger;
} = {}): Promise<LaunchOpportunitySeedSummary | null> {
  const prismaClient = options.prismaClient ?? prisma;
  const logger = options.logger;

  if (!isDemoOpportunitySeedEnabled()) {
    logger?.('info', 'demo opportunity seed skipped — SEED_DEMO_OPPORTUNITIES not enabled');
    return {
      activeOpportunityCount: 0,
      seededOpportunityCount: 0,
      createdOrganizationCount: 0,
      skipped: true,
    };
  }

  const activeOpportunityCount = await prismaClient.opportunity.count({
    where: { status: 'ACTIVE' },
  });

  logger?.('info', 'launch_opportunity_seed.reconciling', {
    activeOpportunityCount,
    targetOpportunityCount: SEEDED_LAUNCH_OPPORTUNITIES.length,
  });

  return seedLaunchOpportunities(prismaClient, logger);
}
