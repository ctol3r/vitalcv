import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { getMultiOrgProfile } from '../multiOrgProfile';

type PrismaClient = any;

const {
  PrismaClient: PrismaClientCtor,
  OrgMembershipRole,
  OrgMembershipV2Status,
} = require('@prisma/client') as {
  PrismaClient: new () => PrismaClient;
  OrgMembershipRole: Record<string, string>;
  OrgMembershipV2Status: Record<string, string>;
};

const prisma = new PrismaClientCtor();

describe('MultiOrgProfile view', () => {
  const clinicianUserId = 'multi-org-user';
  const clinicianId = 'multi-org-clinician';
  const clinicianDid = 'did:example:multi-org';
  const orgA = 'multi-org-a';
  const orgB = 'multi-org-b';
  const payerExternalId = 'payer-alpha';
  let privilegeSetId: string;
  let privilegeRequestId: string;
  let privilegeGrantedId: string;
  let payerId: string;
  let oppeScheduleId: string;

  beforeAll(async () => {
    await cleanup();

    await prisma.user.create({
      data: {
        id: clinicianUserId,
        email: `${clinicianUserId}@example.com`,
        name: 'Multi Org Clinician',
        roles: [],
        did: clinicianDid,
      },
    });

    await prisma.clinicianProfile.create({
      data: {
        id: clinicianId,
        userId: clinicianUserId,
        npi: '2233445566',
        specialty: 'Emergency Medicine',
        state: 'TX',
      },
    });

    for (const partner of [
      { id: orgA, partnerId: 'partner-a', partnerName: 'Alpha Health' },
      { id: orgB, partnerId: 'partner-b', partnerName: 'Beta Health' },
    ]) {
      await prisma.partnerConfig.create({
        data: {
          ...partner,
          allowedOrigins: [],
          isActive: true,
          authType: 'bearer',
        },
      });
    }

    await prisma.orgMembershipV2.createMany({
      data: [
        {
          clinicianId,
          orgId: orgA,
          role: OrgMembershipRole.ADMIN,
          membershipStatus: OrgMembershipV2Status.ACTIVE,
          joinedAt: new Date(),
        },
        {
          clinicianId,
          orgId: orgB,
          role: OrgMembershipRole.VIEWER,
          membershipStatus: OrgMembershipV2Status.PENDING,
        },
      ],
    });

    const privilegeSet = await prisma.privilegeSet.create({
      data: {
        orgId: orgA,
        name: 'Core Privileges',
        department: 'Emergency',
        procedures: { items: ['triage', 'stabilize'] },
        requirements: { license: 'active' },
      },
    });
    privilegeSetId = privilegeSet.id;

    const privilegeRequest = await prisma.privilegeRequest.create({
      data: {
        orgId: orgA,
        clinicianDid,
        privilegeSetId,
        evidenceIds: [],
        evidenceBundle: {},
        status: 'PENDING',
      },
    });
    privilegeRequestId = privilegeRequest.id;

    const privilegeGranted = await prisma.privilegeGranted.create({
      data: {
        privilegeRequestId,
        orgId: orgA,
        clinicianDid,
        privilegeSetId,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      },
    });
    privilegeGrantedId = privilegeGranted.id;

    await prisma.tJCComplianceRecord.create({
      data: {
        clinicianId,
        orgId: orgA,
        overallStatus: 'PASS',
        standardResults: {},
      },
    });

    const payer = await prisma.payer.create({
      data: {
        payerId: payerExternalId,
        name: 'Payer Alpha',
        planTypes: ['HMO'],
        enrollmentEndpoint: 'https://payer.example.com',
        contactInfo: {},
        states: ['TX'],
      },
    });
    payerId = payer.id;

    await prisma.payerEnrollment.create({
      data: {
        orgId: orgA,
        payerId,
        clinicianDid,
        status: 'APPROVED',
        evidenceIds: [],
      },
    });

    await prisma.driftEvent.create({
      data: {
        id: 'drift-event-a',
        clinicianId,
        orgId: orgA,
        detectorId: 'privilege-mismatch',
        type: 'PRIVILEGE',
        category: 'PRIVILEGE',
        severity: 'WARNING',
        status: 'OPEN',
        fingerprint: 'drift-event-a',
        summary: 'Privilege mismatch detected',
      },
    });

    const schedule = await prisma.oPPEScheduleV2.create({
      data: {
        clinicianId,
        orgId: orgA,
        frequencyMonths: 12,
        nextDueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      },
    });
    oppeScheduleId = schedule.id;

    await prisma.fPPECase.create({
      data: {
        clinicianId,
        orgId: orgA,
        privilegeGrantedId,
        privilegeCode: 'core',
        startAt: new Date(),
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        status: 'OPEN',
      },
    });

    await prisma.oPPECase.create({
      data: {
        scheduleId: oppeScheduleId,
        clinicianId,
        orgId: orgA,
        privilegeCode: 'core',
        periodStart: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        periodEnd: new Date(),
        status: 'OPEN',
      },
    });

    await prisma.credentialRisk.create({
      data: {
        clinicianId,
        score: 42,
        factors: { identity: 'verified' },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('builds multi-org profile summary with aggregates', async () => {
    const profile = await getMultiOrgProfile(clinicianId);

    expect(profile.clinician.id).toBe(clinicianId);
    expect(profile.memberships).toHaveLength(2);

    const orgASummary = profile.memberships.find((m) => m.orgId === orgA);
    expect(orgASummary?.privileges.requests.total).toBeGreaterThan(0);
    expect(orgASummary?.privileges.grants.active).toBeGreaterThan(0);
    expect(orgASummary?.enrollment.approved).toBe(1);
    expect(orgASummary?.risk.driftOpen).toBe(1);

    expect(profile.aggregates.totalMemberships).toBe(2);
    expect(profile.aggregates.privileges.totalRequests).toBeGreaterThan(0);
    expect(profile.aggregates.riskScore).toBe(42);
  });

  async function cleanup() {
    await prisma.credentialRisk.deleteMany({ where: { clinicianId } });
    await prisma.oPPECase.deleteMany({ where: { clinicianId } });
    await prisma.fPPECase.deleteMany({ where: { clinicianId } });
    await prisma.oPPEScheduleV2.deleteMany({ where: { clinicianId } });
    await prisma.driftEvent.deleteMany({ where: { clinicianId } });
    await prisma.payerEnrollment.deleteMany({ where: { clinicianDid } });
    await prisma.payer.deleteMany({ where: { payerId: payerExternalId } });
    await prisma.tJCComplianceRecord.deleteMany({ where: { clinicianId } });
    await prisma.privilegeGranted.deleteMany({ where: { clinicianDid } });
    await prisma.privilegeRequest.deleteMany({ where: { clinicianDid } });
    await prisma.privilegeSet.deleteMany({ where: { orgId: orgA } });
    await prisma.orgMembershipV2.deleteMany({ where: { clinicianId } });
    await prisma.partnerConfig.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.clinicianProfile.deleteMany({ where: { id: clinicianId } });
    await prisma.user.deleteMany({ where: { id: clinicianUserId } });
  }
});
