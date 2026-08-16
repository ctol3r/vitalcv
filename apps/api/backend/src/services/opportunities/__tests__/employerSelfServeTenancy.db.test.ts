/**
 * Wave 1 Binding B — self-serve employer tenancy, against a REAL database.
 *
 * An employer who created their organization through the real self-serve path
 * (`upsertOrgProfile`) must be able to read and act on applications made to
 * their own opportunities.
 *
 * The employer decision path resolves tenancy through `User.organizationId` —
 * the membership store, per `middleware/organizationContext.ts`. Self-serve
 * setup created the Organization, the OrganizationProfile, and an ADMIN
 * WorkspaceMembership, but never wrote that column, so
 * `listAllOrgApplications` returned `[]` and the employer got a 404
 * "Application not found." on their own application.
 *
 * Nothing about the tenancy resolution is mocked. The organization is created
 * by the real service against real Prisma constraints, and the read path runs
 * the real queries. Only the trust-state engine (network I/O to NPPES) and the
 * downstream billing/action side effects are stubbed, because neither is under
 * test here.
 */

import { randomUUID } from 'node:crypto';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

jest.mock('../../trust/trustStateEngine', () => ({
  ...jest.requireActual('../../trust/trustStateEngine'),
  computeClinicianTrustState: jest.fn(async () => null),
}));
jest.mock('../../billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../actions/actionEngineService', () => ({ refreshActionRecommendations: jest.fn() }));

import { upsertOrgProfile } from '../opportunityService';
import { listAllOrgApplications } from '../applicationService';
import {
  getEmployerWorkflowApplication,
  runEmployerWorkflowAction,
} from '../employerWorkflowService';

const prisma = new PrismaClient();

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

/** The employer who signs up through the product, with no seed script involved. */
const SELF_SERVE_EMPLOYER = `selfserve-employer-${suffix}`;
const SELF_SERVE_DOMAIN = `selfserve-clinic-${suffix}.org`;

/** A second, unrelated self-serve employer — the cross-tenant control. */
const OTHER_EMPLOYER = `other-employer-${suffix}`;
const OTHER_DOMAIN = `other-clinic-${suffix}.org`;

const CLINICIAN = `applicant-${suffix}`;
const CLINICIAN_NPI = '1558302470';

let organizationId: string;
let otherOrganizationId: string;
let applicationId: string;

/**
 * Delete every row this suite created, scoped to its own organizations.
 *
 * Leftover rows here are not a private mess. `applications.opportunity_id` and
 * `Opportunity.organization_id` are both ON DELETE RESTRICT, so a later suite
 * that resets shared state with an unscoped `organization.deleteMany({})` —
 * `routes/__tests__/graphRoutes.test.ts` does exactly that — dies on
 * `applications_opportunity_id_fkey` against an application THIS file owns.
 * The failure surfaces in the other file, so it reads as a graph defect and is
 * invisible when either suite runs alone. Deletes are ordered child-first.
 */
async function cleanUpSuiteRows(): Promise<void> {
  const organizationIds = [organizationId, otherOrganizationId].filter(Boolean);
  const applicationIds = (await prisma.application.findMany({
    where: { opportunity: { organizationId: { in: organizationIds } } },
    select: { id: true },
  })).map(({ id }) => id);
  const organizationProfileIds = (await prisma.organizationProfile.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { id: true },
  })).map(({ id }) => id);
  const userIds = (await prisma.user.findMany({
    where: { clerkUserId: { in: [SELF_SERVE_EMPLOYER, OTHER_EMPLOYER, CLINICIAN] } },
    select: { id: true },
  })).map(({ id }) => id);

  await prisma.applicationPacket.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.activationRequirement.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  await prisma.opportunity.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.auditEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.organizationAccessRequest.deleteMany({
    where: { clerkUserId: { in: [SELF_SERVE_EMPLOYER, OTHER_EMPLOYER, CLINICIAN] } },
  });
  await prisma.workspaceMembership.deleteMany({
    where: { organizationProfileId: { in: organizationProfileIds } },
  });
  await prisma.organizationProfile.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await prisma.personProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
}

/**
 * Create the User row exactly as a real signup leaves it: a work email at the
 * organization's own domain (which is what the authority gate reads) and NO
 * organizationId — the column self-serve setup is supposed to populate.
 */
async function createEmployerUser(clerkUserId: string, domain: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: `admin@${domain}`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  return user.id;
}

async function setUpSelfServeOrg(clerkUserId: string, domain: string, name: string) {
  await createEmployerUser(clerkUserId, domain);
  // The real service — authority gate, org creation, profile, membership.
  return upsertOrgProfile(clerkUserId, {
    name,
    website: `https://${domain}`,
    facilityType: 'hospital',
    statesCovered: ['CA'],
    hiringTypes: ['permanent'],
  });
}

beforeAll(async () => {
  const created = await setUpSelfServeOrg(
    SELF_SERVE_EMPLOYER,
    SELF_SERVE_DOMAIN,
    `Self Serve Clinic ${suffix}`,
  );
  organizationId = created.organizationId;

  const other = await setUpSelfServeOrg(
    OTHER_EMPLOYER,
    OTHER_DOMAIN,
    `Other Clinic ${suffix}`,
  );
  otherOrganizationId = other.organizationId;

  await prisma.user.create({
    data: {
      clerkUserId: CLINICIAN,
      email: `clinician-${suffix}@clinician.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      id: randomUUID(),
      organizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      hiringType: 'permanent',
      state: 'CA',
    },
  });

  const application = await prisma.application.create({
    data: {
      id: randomUUID(),
      opportunityId: opportunity.id,
      clerkUserId: CLINICIAN,
      npi: CLINICIAN_NPI,
      status: 'PENDING',
    },
  });
  applicationId = application.id;
});

afterAll(async () => {
  await cleanUpSuiteRows();
  await prisma.$disconnect();
});

describe('self-serve employer tenancy binding', () => {
  it('binds the creating user to the organization that setup produced', async () => {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: SELF_SERVE_EMPLOYER },
      select: { organizationId: true },
    });

    // The closure: tenancy resolves through this column, so setup must write
    // it. Asserting the membership row instead would pass while the decision
    // path stayed broken.
    expect(user?.organizationId).toBe(organizationId);
  });

  it('lists the application to the employer who owns the opportunity', async () => {
    const applications = await listAllOrgApplications(SELF_SERVE_EMPLOYER);
    expect(applications.map((application) => application.id)).toContain(applicationId);
  });

  it('lets the self-serve employer load their own application', async () => {
    const application = await getEmployerWorkflowApplication(applicationId, SELF_SERVE_EMPLOYER);
    expect(application.id).toBe(applicationId);
    expect(application.employer.organizationId).toBe(organizationId);
  });

  it('lets the self-serve employer act on their own application', async () => {
    const result = await runEmployerWorkflowAction({
      action: 'start_review',
      applicationId,
      reviewerClerkUserId: SELF_SERVE_EMPLOYER,
      reviewNote: 'Reviewing.',
    });

    expect(result.action).toBe('start_review');
    expect(result.application.status).toBe('REVIEWED');
  });

  it('still refuses an employer from a different organization', async () => {
    // The fix must bind a user to their OWN org, not hand out access. Without
    // this, setting the column at all would look like a pass.
    expect(otherOrganizationId).not.toBe(organizationId);
    await expect(
      getEmployerWorkflowApplication(applicationId, OTHER_EMPLOYER),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('still refuses a user with no organization at all', async () => {
    await expect(
      getEmployerWorkflowApplication(applicationId, CLINICIAN),
    ).rejects.toMatchObject({ status: 404 });
  });
});
