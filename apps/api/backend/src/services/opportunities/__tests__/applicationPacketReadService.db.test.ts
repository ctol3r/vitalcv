/**
 * Bundle 1.1 boundary tests against real PostgreSQL.
 *
 * The only intentionally fake data is the synthetic clinician evidence inside
 * the packet. Authorization, packet-version selection, and tamper detection
 * all exercise the real Prisma schema and database constraints.
 */

import { randomUUID } from 'node:crypto';
import {
  MembershipRole,
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  hashPacketContent,
  sealPacket,
  type ApplicationPacketContent,
} from '../applicationPacketService';
import { readApplicationPacket } from '../applicationPacketReadService';

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const CLINICIAN = `packet-owner-${suffix}`;
const EMPLOYER = `packet-employer-${suffix}`;
const CROSS_ORG_EMPLOYER = `packet-cross-org-${suffix}`;
const REVOKED_EMPLOYER = `packet-revoked-${suffix}`;
const DISABLED_EMPLOYER = `packet-disabled-${suffix}`;
const NO_MEMBERSHIP_EMPLOYER = `packet-no-membership-${suffix}`;
const ADMIN = `packet-admin-${suffix}`;
const LEGACY_CLINICIAN = `packet-legacy-${suffix}`;

let organizationId: string;
let crossOrganizationId: string;
let opportunityId: string;
let crossOpportunityId: string;
let applicationId: string;
let crossApplicationId: string;
let legacyApplicationId: string;
let personProfileIds: string[] = [];

function packetContent(input: {
  applicationId: string;
  opportunityId: string;
  organizationId: string;
  packetVersion: number;
  recipient: string;
}): ApplicationPacketContent {
  return {
    applicationId: input.applicationId,
    packetVersion: input.packetVersion,
    clerkUserId: CLINICIAN,
    clinicianNpi: '1558302470',
    opportunityId: input.opportunityId,
    employerOrgId: input.organizationId,
    purpose: 'Apply with VitalCV',
    recipient: input.recipient,
    selectedSections: ['identity', 'exclusions'],
    fields: [{
      sectionId: 'identity',
      fieldId: 'identity.npi.nppes',
      label: 'NPI',
      value: '1558302470',
      evidenceState: 'source_backed',
      sourceId: 'nppes',
      sourceObservedAt: '2026-07-16T12:00:00.000Z',
      freshUntil: '2026-10-14T12:00:00.000Z',
      artifactId: null,
      receiptId: `receipt-${input.packetVersion}`,
    }],
    // `exclusions` is selected and contributes no field. The packet must carry
    // that as an explicit absence or it cannot seal at all.
    sectionAbsences: [{
      sectionId: 'exclusions',
      evidenceState: 'unavailable',
      reason: 'Nothing was found for exclusions. No usable record was obtained from its source.',
    }],
    clinicianNote: 'Synthetic integration-test packet.',
    methodologyVersion: '243.3',
    consentAt: '2026-07-16T12:05:00.000Z',
    consentReceiptId: `consent-${input.applicationId}-${input.packetVersion}`,
  };
}

async function persistPacket(input: {
  id: string;
  content: ApplicationPacketContent;
  supersededByPacketId?: string | null;
}) {
  const sealed = sealPacket(input.content);
  return prisma.applicationPacket.create({
    data: {
      id: input.id,
      applicationId: sealed.applicationId,
      packetVersion: sealed.packetVersion,
      clerkUserId: sealed.clerkUserId,
      clinicianNpi: sealed.clinicianNpi,
      opportunityId: sealed.opportunityId,
      employerOrgId: sealed.employerOrgId,
      purpose: sealed.purpose,
      recipient: sealed.recipient,
      selectedSections: sealed.selectedSections,
      fields: sealed.fields as unknown as Prisma.InputJsonValue,
      sectionAbsences: (sealed.sectionAbsences ?? []) as unknown as Prisma.InputJsonValue,
      clinicianNote: sealed.clinicianNote,
      methodologyVersion: sealed.methodologyVersion,
      consentAt: new Date(sealed.consentAt),
      consentReceiptId: sealed.consentReceiptId,
      packetHash: sealed.packetHash,
      supersededByPacketId: input.supersededByPacketId ?? null,
    },
  });
}

async function createWorkspaceUser(input: {
  clerkUserId: string;
  email: string;
  role?: UserRole;
  organizationId?: string;
  status?: UserStatus;
}) {
  const user = await prisma.user.create({
    data: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      role: input.role ?? UserRole.VERIFIER,
      status: input.status ?? UserStatus.ACTIVE,
      organizationId: input.organizationId,
    },
  });
  const personProfile = await prisma.personProfile.create({ data: { userId: user.id } });
  return { user, personProfile };
}

beforeAll(async () => {
  const [organization, crossOrganization] = await Promise.all([
    prisma.organization.create({
      data: { name: 'Packet Reader Health', slug: `packet-reader-${suffix}` },
    }),
    prisma.organization.create({
      data: { name: 'Cross Organization Health', slug: `packet-reader-cross-${suffix}` },
    }),
  ]);
  organizationId = organization.id;
  crossOrganizationId = crossOrganization.id;

  const [organizationProfile, crossOrganizationProfile] = await Promise.all([
    prisma.organizationProfile.create({
      data: { organizationId, specialties: [], statesCovered: [] },
    }),
    prisma.organizationProfile.create({
      data: { organizationId: crossOrganizationId, specialties: [], statesCovered: [] },
    }),
  ]);
  const [opportunity, crossOpportunity] = await Promise.all([
    prisma.opportunity.create({
      data: {
        organizationId,
        title: 'Packet Reader Hospitalist',
        specialty: 'Internal Medicine',
        state: 'CA',
        status: 'ACTIVE',
        hiringType: 'PERMANENT',
      },
    }),
    prisma.opportunity.create({
      data: {
        organizationId: crossOrganizationId,
        title: 'Cross Organization Hospitalist',
        specialty: 'Internal Medicine',
        state: 'CA',
        status: 'ACTIVE',
        hiringType: 'PERMANENT',
      },
    }),
  ]);
  opportunityId = opportunity.id;
  crossOpportunityId = crossOpportunity.id;

  const clinician = await prisma.user.create({
    data: {
      clerkUserId: CLINICIAN,
      email: `${CLINICIAN}@example.com`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  const clinicianProfile = await prisma.personProfile.create({
    data: { userId: clinician.id, npi: '1558302470' },
  });
  personProfileIds.push(clinicianProfile.id);

  const [employer, crossOrgEmployer, revokedEmployer, disabledEmployer] = await Promise.all([
    createWorkspaceUser({
      clerkUserId: EMPLOYER,
      email: `${EMPLOYER}@example.com`,
      organizationId,
    }),
    createWorkspaceUser({
      clerkUserId: CROSS_ORG_EMPLOYER,
      email: `${CROSS_ORG_EMPLOYER}@example.com`,
      organizationId: crossOrganizationId,
    }),
    createWorkspaceUser({
      clerkUserId: REVOKED_EMPLOYER,
      email: `${REVOKED_EMPLOYER}@example.com`,
      organizationId,
    }),
    createWorkspaceUser({
      clerkUserId: DISABLED_EMPLOYER,
      email: `${DISABLED_EMPLOYER}@example.com`,
      organizationId,
      status: UserStatus.DEACTIVATED,
    }),
  ]);
  const noMembershipEmployer = await createWorkspaceUser({
    clerkUserId: NO_MEMBERSHIP_EMPLOYER,
    email: `${NO_MEMBERSHIP_EMPLOYER}@example.com`,
    organizationId,
  });
  personProfileIds.push(
    employer.personProfile.id,
    crossOrgEmployer.personProfile.id,
    revokedEmployer.personProfile.id,
    disabledEmployer.personProfile.id,
    noMembershipEmployer.personProfile.id,
  );
  await prisma.user.create({
    data: {
      clerkUserId: ADMIN,
      email: `${ADMIN}@example.com`,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.workspaceMembership.createMany({
    data: [
      {
        personProfileId: employer.personProfile.id,
        organizationProfileId: organizationProfile.id,
        role: MembershipRole.CREDENTIALING_SPECIALIST,
        active: true,
      },
      {
        personProfileId: crossOrgEmployer.personProfile.id,
        organizationProfileId: crossOrganizationProfile.id,
        role: MembershipRole.ADMIN,
        active: true,
      },
      {
        personProfileId: revokedEmployer.personProfile.id,
        organizationProfileId: organizationProfile.id,
        role: MembershipRole.ADMIN,
        active: false,
      },
      {
        personProfileId: disabledEmployer.personProfile.id,
        organizationProfileId: organizationProfile.id,
        role: MembershipRole.ADMIN,
        active: true,
      },
    ],
  });

  const [application, crossApplication, legacyApplication] = await Promise.all([
    prisma.application.create({
      data: {
        opportunityId,
        clerkUserId: CLINICIAN,
        npi: '1558302470',
        sealedPacketVersion: 2,
      },
    }),
    prisma.application.create({
      data: {
        opportunityId: crossOpportunityId,
        clerkUserId: `cross-clinician-${suffix}`,
        npi: '1558302471',
        sealedPacketVersion: 1,
      },
    }),
    prisma.application.create({
      data: {
        opportunityId,
        clerkUserId: LEGACY_CLINICIAN,
        npi: '1558302472',
        sealedPacketVersion: null,
      },
    }),
  ]);
  applicationId = application.id;
  crossApplicationId = crossApplication.id;
  legacyApplicationId = legacyApplication.id;

  const v1PacketId = randomUUID();
  const v2PacketId = randomUUID();
  await persistPacket({
    id: v1PacketId,
    content: packetContent({
      applicationId,
      opportunityId,
      organizationId,
      packetVersion: 1,
      recipient: organization.name,
    }),
    supersededByPacketId: v2PacketId,
  });
  await persistPacket({
    id: v2PacketId,
    content: packetContent({
      applicationId,
      opportunityId,
      organizationId,
      packetVersion: 2,
      recipient: organization.name,
    }),
  });
  await persistPacket({
    id: randomUUID(),
    content: packetContent({
      applicationId: crossApplicationId,
      opportunityId: crossOpportunityId,
      organizationId: crossOrganizationId,
      packetVersion: 3,
      recipient: crossOrganization.name,
    }),
  });
});

afterAll(async () => {
  const applicationIds = [applicationId, crossApplicationId, legacyApplicationId]
    .filter((id): id is string => Boolean(id));
  if (applicationIds.length > 0) {
    await prisma.auditEvent.deleteMany({ where: { referenceId: { in: applicationIds } } });
    await prisma.applicationPacket.deleteMany({ where: { applicationId: { in: applicationIds } } });
    await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  }
  await prisma.workspaceMembership.deleteMany({ where: { personProfileId: { in: personProfileIds } } });
  await prisma.personProfile.deleteMany({ where: { id: { in: personProfileIds } } });
  await prisma.user.deleteMany({
    where: {
      clerkUserId: {
        in: [
          CLINICIAN,
          EMPLOYER,
          CROSS_ORG_EMPLOYER,
          REVOKED_EMPLOYER,
          DISABLED_EMPLOYER,
          NO_MEMBERSHIP_EMPLOYER,
          ADMIN,
        ],
      },
    },
  });
  await prisma.opportunity.deleteMany({ where: { id: { in: [opportunityId, crossOpportunityId] } } });
  await prisma.organizationProfile.deleteMany({ where: { organizationId: { in: [organizationId, crossOrganizationId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, crossOrganizationId] } } });
  await prisma.$disconnect();
});

describe('application packet reader — real PostgreSQL authorization boundary', () => {
  it('returns byte-equivalent submitted fields to the clinician and authorized employer member', async () => {
    const clinician = await readApplicationPacket({ applicationId, clerkUserId: CLINICIAN });
    const employer = await readApplicationPacket({ applicationId, clerkUserId: EMPLOYER });

    expect(clinician.accessPerspective).toBe('clinician');
    expect(employer.accessPerspective).toBe('employer');
    expect(clinician.submittedPacket?.packetVersion).toBe(2);
    expect(JSON.stringify(employer.submittedPacket?.fields)).toBe(JSON.stringify(clinician.submittedPacket?.fields));
  });

  it('uses the sealed pointer by default and permits an explicitly retained prior version', async () => {
    const current = await readApplicationPacket({ applicationId, clerkUserId: CLINICIAN });
    const prior = await readApplicationPacket({ applicationId, clerkUserId: CLINICIAN, packetVersion: 1 });

    expect(current.submittedPacket).toMatchObject({ packetVersion: 2, lifecycle: 'active' });
    expect(prior.submittedPacket).toMatchObject({ packetVersion: 1, lifecycle: 'superseded' });
  });

  it('denies cross-organization, missing, revoked, and disabled employer access', async () => {
    for (const clerkUserId of [
      CROSS_ORG_EMPLOYER,
      NO_MEMBERSHIP_EMPLOYER,
      REVOKED_EMPLOYER,
      DISABLED_EMPLOYER,
    ]) {
      await expect(readApplicationPacket({ applicationId, clerkUserId }))
        .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });
    }
  });

  it('allows only the explicit active platform administrator mechanism', async () => {
    await expect(readApplicationPacket({ applicationId, clerkUserId: ADMIN }))
      .resolves.toMatchObject({ accessPerspective: 'admin' });

    await expect(readApplicationPacket({
      applicationId,
      clerkUserId: NO_MEMBERSHIP_EMPLOYER,
      role: 'ADMIN',
      organizationId,
    } as unknown as Parameters<typeof readApplicationPacket>[0])).rejects.toMatchObject({ status: 404 });
  });

  it('does not allow a packet version belonging to a different application', async () => {
    await expect(readApplicationPacket({ applicationId, clerkUserId: CLINICIAN, packetVersion: 3 }))
      .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });
  });

  it('returns the honest legacy response without backfilling current data', async () => {
    await expect(readApplicationPacket({ applicationId: legacyApplicationId, clerkUserId: LEGACY_CLINICIAN }))
      .resolves.toMatchObject({
        mode: 'legacy',
        submittedPacket: null,
        legacyNotice: 'Legacy application — no immutable disclosure packet was captured at submission.',
      });
  });

  /**
   * The employer-facing read is where the defect was visible: `selectedSections`
   * listed "exclusions", no exclusions field was present, and the response said
   * nothing else — so the only available reading was "checked, and clean".
   */
  it('shows the employer WHY a selected section is empty instead of leaving it silent', async () => {
    const employer = await readApplicationPacket({ applicationId, clerkUserId: EMPLOYER });
    const packet = employer.submittedPacket;

    expect(packet?.selectedSections).toContain('exclusions');
    expect(packet?.fields.some((field) => field.sectionId === 'exclusions')).toBe(false);

    // Not silence: an explicit record, read straight out of the seal.
    expect(packet?.sectionAbsences).toEqual([
      expect.objectContaining({
        sectionId: 'exclusions',
        evidenceState: 'unavailable',
        reason: expect.stringMatching(/nothing was found/i),
      }),
    ]);
    // And nothing in the disclosed scope is left for the reader to guess at.
    expect(packet?.unexplainedSectionIds).toEqual([]);

    // The clinician sees exactly what the employer sees.
    const clinician = await readApplicationPacket({ applicationId, clerkUserId: CLINICIAN });
    expect(clinician.submittedPacket?.sectionAbsences).toEqual(packet?.sectionAbsences);
  });

  it('reports a pre-absence packet as HAVING NO RECORD, not as having nothing absent', async () => {
    // A row written before absences existed: section_absences is NULL, and the
    // hash covers content without the key. Sealed directly because sealPacket's
    // invariant — correctly — refuses to produce such a packet today.
    const legacyVersion = 4;
    const content = packetContent({
      applicationId,
      opportunityId,
      organizationId,
      packetVersion: legacyVersion,
      recipient: 'Packet Test Health',
    });
    const { sectionAbsences: _omitted, ...legacyContent } = content;
    await prisma.applicationPacket.create({
      data: {
        id: randomUUID(),
        ...legacyContent,
        selectedSections: legacyContent.selectedSections,
        fields: legacyContent.fields as unknown as Prisma.InputJsonValue,
        consentAt: new Date(legacyContent.consentAt),
        packetHash: hashPacketContent(legacyContent),
        // sectionAbsences deliberately not written → NULL.
      },
    });

    const legacy = await readApplicationPacket({
      applicationId,
      clerkUserId: EMPLOYER,
      packetVersion: legacyVersion,
    });

    // NULL, not []. An empty list would assert "every section contributed" —
    // a claim this packet never made.
    expect(legacy.submittedPacket?.sectionAbsences).toBeNull();
    // The silence is still named, so the reader is not left to infer a clean check.
    expect(legacy.submittedPacket?.unexplainedSectionIds).toEqual(['exclusions']);
  });

  it('fails closed and records an integrity audit when persisted evidence is tampered', async () => {
    await prisma.applicationPacket.update({
      where: { applicationId_packetVersion: { applicationId, packetVersion: 2 } },
      data: { purpose: 'tampered after consent' },
    });

    await expect(readApplicationPacket({ applicationId, clerkUserId: CLINICIAN }))
      .rejects.toMatchObject({ status: 409, code: 'APPLICATION_PACKET_INTEGRITY_FAILED' });
    await expect(prisma.auditEvent.findFirst({
      where: { referenceId: applicationId, type: 'application_packet_integrity_failed' },
    })).resolves.toBeTruthy();
  });
});
