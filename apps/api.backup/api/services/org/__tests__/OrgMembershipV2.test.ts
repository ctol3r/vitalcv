import { OrgMembershipRole, OrgMembershipV2Status, PrismaClient } from '@prisma/client';
import {
  inviteClinicianToOrg,
  listMembershipsForClinician,
  listMembershipsForOrg,
  updateOrgMembershipV2Status,
} from '../models/OrgMembershipV2';

const prisma = new PrismaClient();

describe('OrgMembershipV2 model', () => {
  const clinicianUserId = 'org-mv2-user';
  const clinicianId = 'org-mv2-clinician';
  const primaryOrgId = 'org-mv2-primary';
  const secondaryOrgId = 'org-mv2-secondary';

  beforeAll(async () => {
    await prisma.orgMembershipV2.deleteMany({
      where: {
        clinicianId: clinicianId,
      },
    });

    await prisma.clinicianProfile.deleteMany({
      where: { id: clinicianId },
    });
    await prisma.user.deleteMany({
      where: { id: clinicianUserId },
    });
    await prisma.partnerConfig.deleteMany({
      where: { id: { in: [primaryOrgId, secondaryOrgId] } },
    });

    await prisma.user.create({
      data: {
        id: clinicianUserId,
        email: `${clinicianUserId}@example.com`,
        name: 'Org Membership Tester',
        roles: [],
      },
    });

    await prisma.clinicianProfile.create({
      data: {
        id: clinicianId,
        userId: clinicianUserId,
        npi: '1234567890',
        specialty: 'Cardiology',
        state: 'CA',
      },
    });

    const partnerRecords = [
      { id: primaryOrgId, partnerId: 'primary', partnerName: 'Primary Org' },
      { id: secondaryOrgId, partnerId: 'secondary', partnerName: 'Secondary Org' },
    ];

    for (const partner of partnerRecords) {
      await prisma.partnerConfig.create({
        data: {
          ...partner,
          allowedOrigins: [],
          isActive: true,
          authType: 'bearer',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.orgMembershipV2.deleteMany({
      where: { clinicianId },
    });
    await prisma.partnerConfig.deleteMany({
      where: { id: { in: [primaryOrgId, secondaryOrgId] } },
    });
    await prisma.clinicianProfile.deleteMany({
      where: { id: clinicianId },
    });
    await prisma.user.deleteMany({
      where: { id: clinicianUserId },
    });
    await prisma.$disconnect();
  });

  it('invites clinician to an org with default role/status', async () => {
    const membership = await inviteClinicianToOrg(clinicianId, primaryOrgId, 'admin-user', {
      reason: 'First invite',
    });

    expect(membership.role).toBe(OrgMembershipRole.VIEWER);
    expect(membership.membershipStatus).toBe(OrgMembershipV2Status.INVITED);
    expect(membership.org?.partnerName).toBe('Primary Org');
  });

  it('activates membership and enforces status transitions', async () => {
    const activated = await updateOrgMembershipV2Status(
      clinicianId,
      primaryOrgId,
      OrgMembershipV2Status.ACTIVE
    );

    expect(activated.membershipStatus).toBe(OrgMembershipV2Status.ACTIVE);
    expect(activated.joinedAt).toBeInstanceOf(Date);

    await expect(
      updateOrgMembershipV2Status(clinicianId, primaryOrgId, OrgMembershipV2Status.INVITED)
    ).rejects.toThrow(/Cannot transition/);
  });

  it('lists memberships for clinician and org', async () => {
    await inviteClinicianToOrg(clinicianId, secondaryOrgId);

    const clinicianMemberships = await listMembershipsForClinician(clinicianId);
    expect(clinicianMemberships.length).toBeGreaterThanOrEqual(2);

    const orgMemberships = await listMembershipsForOrg(secondaryOrgId);
    expect(orgMemberships[0].clinician.id).toBe(clinicianId);
    expect(orgMemberships[0].membershipStatus).toBe(OrgMembershipV2Status.INVITED);
  });
});

