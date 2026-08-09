jest.mock('../../trust/trustStateEngine', () => ({
  computeClinicianTrustState: jest.fn(),
}));

import { randomUUID } from 'node:crypto';

import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

import { computeClinicianTrustState } from '../../trust/trustStateEngine';
import { verifySealedPacket, type SealedApplicationPacket } from '../../opportunities/applicationPacketService';
import {
  createApplyIntent,
  previewApplyIntent,
  submitApplyIntent,
} from '../applyIntentService';
import { readApplicationHandoffForEmployer } from '../../handoffs/handoffReadService';

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const EMPLOYER = `intent-employer-${suffix}`;
const FOREIGN_EMPLOYER = `intent-foreign-${suffix}`;
const CLINICIAN = `intent-clinician-${suffix}`;
const SECOND_CLINICIAN = `intent-second-clinician-${suffix}`;
const NPI = '1558302470';
const SECOND_NPI = '1558302471';

let organizationId: string;
let foreignOrganizationId: string;
let opportunityId: string;
let personProfileIds: string[] = [];
let applicationId: string | null = null;
let requestUri: string | null = null;

const trustState = {
  npi: NPI,
  identityVerified: false,
  licensureStatus: 'unknown',
  exclusionClear: false,
  exclusionStatus: 'UNKNOWN',
  credentialCount: 1,
  readiness_level: 'L1',
  readiness_status: 'Evidence available',
  readiness_score: 20,
  gap_summary: ['Licensure source access required'],
  methodology_version: 'phase2-test',
  computed_at: '2026-07-30T17:00:00.000Z',
  trustBand: 'L1',
  trustScore: 20,
  gaps: ['Licensure source access required'],
  computedAt: '2026-07-30T17:00:00.000Z',
  facts: [
    {
      factType: 'identity',
      source: 'NPPES',
      status: 'source_backed',
      verifiedAt: '2026-07-30T16:55:00.000Z',
      expiresAt: '2026-10-30T16:55:00.000Z',
      details: 'NPI active · name match',
    },
    {
      factType: 'licensure',
      source: 'STATE_BOARD',
      status: 'access_required',
      details: 'Source access required',
    },
  ],
};

beforeAll(async () => {
  jest.mocked(computeClinicianTrustState).mockImplementation(async (npi: string) => ({
    ...trustState,
    npi,
  }) as never);

  const [organization, foreignOrganization] = await Promise.all([
    prisma.organization.create({
      data: { name: 'Apply Intent Health', slug: `apply-intent-${suffix}` },
    }),
    prisma.organization.create({
      data: { name: 'Foreign Apply Intent Health', slug: `apply-intent-foreign-${suffix}` },
    }),
  ]);
  organizationId = organization.id;
  foreignOrganizationId = foreignOrganization.id;

  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      hiringType: 'PERMANENT',
      state: 'CA',
      status: 'ACTIVE',
    },
  });
  opportunityId = opportunity.id;

  const [employer, foreignEmployer, clinician, secondClinician] = await Promise.all([
    prisma.user.create({
      data: {
        clerkUserId: EMPLOYER,
        email: `${EMPLOYER}@example.com`,
        role: UserRole.VERIFIER,
        status: UserStatus.ACTIVE,
        organizationId,
      },
    }),
    prisma.user.create({
      data: {
        clerkUserId: FOREIGN_EMPLOYER,
        email: `${FOREIGN_EMPLOYER}@example.com`,
        role: UserRole.VERIFIER,
        status: UserStatus.ACTIVE,
        organizationId: foreignOrganizationId,
      },
    }),
    prisma.user.create({
      data: {
        clerkUserId: CLINICIAN,
        email: `${CLINICIAN}@example.com`,
        role: UserRole.CLINICIAN,
        status: UserStatus.ACTIVE,
      },
    }),
    prisma.user.create({
      data: {
        clerkUserId: SECOND_CLINICIAN,
        email: `${SECOND_CLINICIAN}@example.com`,
        role: UserRole.CLINICIAN,
        status: UserStatus.ACTIVE,
      },
    }),
  ]);

  const [employerProfile, foreignEmployerProfile, clinicianProfile, secondClinicianProfile] = await Promise.all([
    prisma.personProfile.create({ data: { userId: employer.id } }),
    prisma.personProfile.create({ data: { userId: foreignEmployer.id } }),
    prisma.personProfile.create({ data: { userId: clinician.id, npi: NPI } }),
    prisma.personProfile.create({ data: { userId: secondClinician.id, npi: SECOND_NPI } }),
  ]);
  personProfileIds = [
    employerProfile.id,
    foreignEmployerProfile.id,
    clinicianProfile.id,
    secondClinicianProfile.id,
  ];
});

afterAll(async () => {
  if (applicationId) {
    const receipts = await prisma.handoffReceipt.findMany({
      where: { applicationId },
      select: { auditEventId: true },
    });
    const grants = await prisma.consentGrant.findMany({
      where: { applicationId },
      select: { auditEventId: true },
    });
    await prisma.handoffReceipt.deleteMany({ where: { applicationId } });
    await prisma.consentGrant.deleteMany({ where: { applicationId } });
    await prisma.applicationPacket.deleteMany({ where: { applicationId } });
    await prisma.application.deleteMany({ where: { id: applicationId } });
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { referenceId: applicationId },
          { id: { in: [...receipts, ...grants].map((row) => row.auditEventId) } },
        ],
      },
    });
  }
  if (requestUri) {
    await prisma.idempotentResponse.deleteMany({ where: { key: { contains: requestUri } } });
    await prisma.auditEvent.deleteMany({ where: { referenceId: requestUri } });
    await prisma.parRequest.deleteMany({ where: { requestUri } });
  }
  await prisma.personProfile.deleteMany({ where: { id: { in: personProfileIds } } });
  await prisma.user.deleteMany({
    where: { clerkUserId: { in: [EMPLOYER, FOREIGN_EMPLOYER, CLINICIAN, SECOND_CLINICIAN] } },
  });
  await prisma.opportunity.deleteMany({ where: { id: opportunityId } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, foreignOrganizationId] } } });
  await prisma.$disconnect();
});

describe('Apply Intent atomic handoff — real PostgreSQL', () => {
  it('creates an opaque one-time intent with exact employer and opportunity context', async () => {
    const intent = await createApplyIntent({
      opportunityId,
      creatorClerkUserId: EMPLOYER,
      purpose: 'employment application',
      requestedSections: ['identity', 'licensure'],
      requestedCredentialTypes: ['STATE_LICENSE'],
      returnUrl: 'https://vitalcv.com/employer/applications',
    });
    requestUri = intent.requestUri;
    expect(intent).toMatchObject({
      status: 'ready',
      organization: { id: organizationId, name: 'Apply Intent Health' },
      opportunity: { id: opportunityId, title: 'Hospitalist' },
      requestedSections: ['identity', 'licensure'],
    });
    expect(intent.requestUri).toMatch(/^vai_/);
  });

  it('previews only the requested evidence for the authenticated clinician', async () => {
    const preview = await previewApplyIntent(requestUri!, CLINICIAN);
    expect(preview.clinician.npi).toBe(NPI);
    expect(preview.fields.map((field) => field.sectionId)).toEqual(['identity', 'licensure']);
    expect(preview.limitations).toContain('Some requested evidence requires source access or employer review.');
  });

  it('atomically binds consent, immutable packet, application and portal handoff receipt', async () => {
    const result = await submitApplyIntent({
      requestUri: requestUri!,
      clinicianClerkUserId: CLINICIAN,
      selectedSections: ['identity'],
      coverNote: 'Available in September.',
      authenticationMethod: 'clerk_session',
      authenticationRef: 'session-test',
    });
    applicationId = result.applicationId;

    const [intent, application, packet, grant, receipts] = await Promise.all([
      prisma.parRequest.findUniqueOrThrow({ where: { requestUri: requestUri! } }),
      prisma.application.findUniqueOrThrow({ where: { id: result.applicationId } }),
      prisma.applicationPacket.findUniqueOrThrow({ where: { id: result.packet.id } }),
      prisma.consentGrant.findUniqueOrThrow({ where: { id: result.consentGrantId } }),
      prisma.handoffReceipt.findMany({ where: { handoffId: result.handoffId }, orderBy: { attemptNumber: 'asc' } }),
    ]);

    expect(intent.used).toBe(true);
    expect(application.sealedPacketVersion).toBe(result.packet.version);
    expect(packet.consentGrantId).toBe(grant.id);
    expect(grant.packetId).toBe(packet.id);
    expect(grant.packetHash).toBe(packet.packetHash);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ status: 'logged_only', channel: 'portal', packetHash: packet.packetHash });

    const replay: SealedApplicationPacket = {
      applicationId: packet.applicationId,
      packetVersion: packet.packetVersion,
      clerkUserId: packet.clerkUserId,
      clinicianNpi: packet.clinicianNpi,
      opportunityId: packet.opportunityId,
      employerOrgId: packet.employerOrgId,
      purpose: packet.purpose,
      recipient: packet.recipient,
      selectedSections: packet.selectedSections as string[],
      fields: packet.fields as never,
      // NULL (legacy row) → undefined → key omitted, same rule as opportunityVersion.
      sectionAbsences: (packet.sectionAbsences ?? undefined) as never,
      clinicianNote: packet.clinicianNote,
      methodologyVersion: packet.methodologyVersion,
      consentAt: packet.consentAt.toISOString(),
      consentReceiptId: packet.consentReceiptId,
      consentGrantId: packet.consentGrantId ?? undefined,
      opportunityVersion: packet.opportunityVersion ?? undefined,
      packetHash: packet.packetHash,
    };
    expect(verifySealedPacket(replay)).toBe(true);
    expect(verifySealedPacket({ ...replay, consentGrantId: randomUUID() })).toBe(false);
  });

  it('returns the same stored result on clinician retry and never creates another packet', async () => {
    const retried = await submitApplyIntent({
      requestUri: requestUri!,
      clinicianClerkUserId: CLINICIAN,
      selectedSections: ['identity'],
      authenticationMethod: 'clerk_session',
    });
    expect(retried.applicationId).toBe(applicationId);
    await expect(prisma.applicationPacket.count({ where: { applicationId: applicationId! } })).resolves.toBe(1);
  });

  it('does not let another clinician reuse the consumed intent', async () => {
    await expect(submitApplyIntent({
      requestUri: requestUri!,
      clinicianClerkUserId: SECOND_CLINICIAN,
      selectedSections: ['identity'],
      authenticationMethod: 'clerk_session',
    })).rejects.toMatchObject({ status: 409 });
  });

  it('returns receipt truth to the owning employer and a uniform 404 cross-tenant', async () => {
    const owner = await readApplicationHandoffForEmployer(applicationId!, EMPLOYER);
    expect(owner.deliveryState).toBe('logged_only');
    expect(owner.packet?.consentGrantId).toBeTruthy();
    expect(owner.notice).toMatch(/does not mean the employer reviewed/i);

    await expect(readApplicationHandoffForEmployer(applicationId!, FOREIGN_EMPLOYER))
      .rejects.toMatchObject({ status: 404, message: 'Handoff receipt not found.' });
  });
});
