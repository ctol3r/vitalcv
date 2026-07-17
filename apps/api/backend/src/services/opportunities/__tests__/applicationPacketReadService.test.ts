import {
  MembershipRole,
  UserRole,
  UserStatus,
} from '@prisma/client';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: { findUnique: jest.fn() },
    applicationPacket: { findFirst: jest.fn() },
    auditEvent: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    personProfile: { findUnique: jest.fn() },
    organizationProfile: { findUnique: jest.fn() },
    workspaceMembership: { findUnique: jest.fn() },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { HttpError } from '../../../utils/httpError';
import {
  sealPacket,
  type ApplicationPacketContent,
} from '../applicationPacketService';
import {
  applicationPacketLegacyNotice,
  parseApplicationPacketApplicationId,
  parseRequestedPacketVersion,
  readApplicationPacket,
} from '../applicationPacketReadService';

const APPLICATION_ID = 'a1111111-1111-4111-8111-111111111111';
const OTHER_APPLICATION_ID = 'a2222222-2222-4222-8222-222222222222';
const OPPORTUNITY_ID = 'b1111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = 'c1111111-1111-4111-8111-111111111111';
const OWNER = 'clinician-owner';
const EMPLOYER = 'employer-reviewer';

const prismaMock = prisma as unknown as {
  application: { findUnique: jest.Mock };
  applicationPacket: { findFirst: jest.Mock };
  auditEvent: { create: jest.Mock };
  user: { findUnique: jest.Mock };
  personProfile: { findUnique: jest.Mock };
  organizationProfile: { findUnique: jest.Mock };
  workspaceMembership: { findUnique: jest.Mock };
};

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: APPLICATION_ID,
    clerkUserId: OWNER,
    opportunityId: OPPORTUNITY_ID,
    sealedPacketVersion: 2,
    opportunity: { organizationId: ORGANIZATION_ID },
    ...overrides,
  };
}

function storedPacket(
  overrides: Record<string, unknown> = {},
  contentOverrides: Partial<ApplicationPacketContent> = {},
) {
  const packetVersion = typeof overrides.packetVersion === 'number' ? overrides.packetVersion : 2;
  const { packetVersion: _packetVersion, ...rowOverrides } = overrides;
  const content: ApplicationPacketContent = {
    applicationId: APPLICATION_ID,
    packetVersion,
    clerkUserId: OWNER,
    clinicianNpi: '1558302470',
    opportunityId: OPPORTUNITY_ID,
    employerOrgId: ORGANIZATION_ID,
    purpose: 'Apply with VitalCV',
    recipient: 'Packet Test Health',
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
      receiptId: 'receipt-1',
    }],
    clinicianNote: 'Available in August.',
    methodologyVersion: '243.3',
    consentAt: '2026-07-16T12:05:00.000Z',
    consentReceiptId: 'consent-1',
    ...contentOverrides,
  };
  const sealed = sealPacket(content);
  return {
    ...sealed,
    consentAt: new Date(sealed.consentAt),
    supersededByPacketId: null,
    revokedAt: null,
    revokedReason: null,
    ...rowOverrides,
  };
}

function activeEmployerUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'employer-user-id',
    role: UserRole.VERIFIER,
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

function wireAuthorizedEmployer() {
  prismaMock.user.findUnique.mockResolvedValue(activeEmployerUser());
  prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'employer-profile-id' });
  prismaMock.organizationProfile.findUnique.mockResolvedValue({ id: 'employer-org-profile-id' });
  prismaMock.workspaceMembership.findUnique.mockResolvedValue({
    active: true,
    role: MembershipRole.CREDENTIALING_SPECIALIST,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.application.findUnique.mockResolvedValue(application());
  prismaMock.applicationPacket.findFirst.mockResolvedValue(storedPacket());
  prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
  prismaMock.user.findUnique.mockResolvedValue(activeEmployerUser());
  prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'employer-profile-id' });
  prismaMock.organizationProfile.findUnique.mockResolvedValue({ id: 'employer-org-profile-id' });
  prismaMock.workspaceMembership.findUnique.mockResolvedValue(null);
});

describe('readApplicationPacket', () => {
  it('returns the exact sealed packet to its clinician owner', async () => {
    const result = await readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: OWNER });

    expect(result).toMatchObject({
      applicationId: APPLICATION_ID,
      opportunityId: OPPORTUNITY_ID,
      accessPerspective: 'clinician',
      mode: 'sealed',
      submittedPacket: { packetVersion: 2, integrity: 'valid' },
      legacyNotice: null,
    });
    expect(result.submittedPacket?.fields).toEqual(storedPacket().fields);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns byte-equivalent submitted fields to an authorized employer', async () => {
    const clinician = await readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: OWNER });
    wireAuthorizedEmployer();
    const employer = await readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: EMPLOYER });

    expect(employer.accessPerspective).toBe('employer');
    expect(JSON.stringify(employer.submittedPacket?.fields)).toBe(JSON.stringify(clinician.submittedPacket?.fields));
  });

  it('does not allow another clinician to read the packet', async () => {
    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: 'another-clinician' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('allows an active review-capable member only for the opportunity organization', async () => {
    wireAuthorizedEmployer();

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: EMPLOYER }))
      .resolves.toMatchObject({ accessPerspective: 'employer' });

    expect(prismaMock.workspaceMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        personProfileId_organizationProfileId: {
          personProfileId: 'employer-profile-id',
          organizationProfileId: 'employer-org-profile-id',
        },
      },
    }));
  });

  it('denies cross-organization, missing, and revoked memberships without metadata leakage', async () => {
    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: EMPLOYER }))
      .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });

    prismaMock.workspaceMembership.findUnique.mockResolvedValue({
      active: false,
      role: MembershipRole.ADMIN,
    });
    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: EMPLOYER }))
      .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });
  });

  it('denies a disabled user even when its stored membership is review-capable', async () => {
    prismaMock.user.findUnique.mockResolvedValue(activeEmployerUser({
      status: UserStatus.DEACTIVATED,
    }));
    prismaMock.workspaceMembership.findUnique.mockResolvedValue({
      active: true,
      role: MembershipRole.ADMIN,
    });

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: EMPLOYER }))
      .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });
    expect(prismaMock.workspaceMembership.findUnique).not.toHaveBeenCalled();
  });

  it('uses the server-side active ADMIN record for explicit platform access', async () => {
    prismaMock.user.findUnique.mockResolvedValue(activeEmployerUser({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    }));

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: 'platform-admin' }))
      .resolves.toMatchObject({ accessPerspective: 'admin' });
    expect(prismaMock.personProfile.findUnique).not.toHaveBeenCalled();
  });

  it('does not accept client-supplied role or organization assertions', async () => {
    await expect(readApplicationPacket({
      applicationId: APPLICATION_ID,
      clerkUserId: EMPLOYER,
      organizationId: ORGANIZATION_ID,
      role: 'ADMIN',
    } as unknown as Parameters<typeof readApplicationPacket>[0])).rejects.toMatchObject({ status: 404 });
  });

  it('returns the explicitly requested retained version instead of the attached version', async () => {
    const retained = storedPacket({ packetVersion: 1 });
    prismaMock.applicationPacket.findFirst.mockResolvedValue(retained);

    const result = await readApplicationPacket({
      applicationId: APPLICATION_ID,
      clerkUserId: OWNER,
      packetVersion: 1,
    });

    expect(result.submittedPacket?.packetVersion).toBe(1);
    expect(prismaMock.applicationPacket.findFirst).toHaveBeenCalledWith({
      where: { applicationId: APPLICATION_ID, packetVersion: 1 },
    });
  });

  it('fails closed when a requested version does not belong to the application', async () => {
    prismaMock.applicationPacket.findFirst.mockResolvedValue(null);

    await expect(readApplicationPacket({
      applicationId: APPLICATION_ID,
      clerkUserId: OWNER,
      packetVersion: 1,
    })).rejects.toMatchObject({ status: 404 });
  });

  it('fails closed and records a security audit when stored packet content is tampered', async () => {
    const tampered = storedPacket({
      fields: [{
        ...storedPacket().fields[0],
        value: 'tampered-after-submission',
      }],
    });
    prismaMock.applicationPacket.findFirst.mockResolvedValue(tampered);

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: OWNER }))
      .rejects.toMatchObject({ status: 409, code: 'APPLICATION_PACKET_INTEGRITY_FAILED' });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'application_packet_integrity_failed' }),
    }));
  });

  it('fails closed when a validly hashed packet is bound to a different clinician', async () => {
    const wrongClinician = storedPacket({}, { clerkUserId: 'another-clinician' });
    prismaMock.applicationPacket.findFirst.mockResolvedValue(wrongClinician);

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: OWNER }))
      .rejects.toMatchObject({ status: 409, code: 'APPLICATION_PACKET_INTEGRITY_FAILED' });
  });

  it('returns an honest legacy response without reading a packet row', async () => {
    prismaMock.application.findUnique.mockResolvedValue(application({ sealedPacketVersion: null }));

    await expect(readApplicationPacket({ applicationId: APPLICATION_ID, clerkUserId: OWNER }))
      .resolves.toEqual({
        applicationId: APPLICATION_ID,
        opportunityId: OPPORTUNITY_ID,
        accessPerspective: 'clinician',
        mode: 'legacy',
        submittedPacket: null,
        legacyNotice: applicationPacketLegacyNotice,
      });
    expect(prismaMock.applicationPacket.findFirst).not.toHaveBeenCalled();
  });

  it('does not distinguish a missing application from an unauthorized packet', async () => {
    prismaMock.application.findUnique.mockResolvedValue(null);

    await expect(readApplicationPacket({ applicationId: OTHER_APPLICATION_ID, clerkUserId: OWNER }))
      .rejects.toMatchObject({ status: 404, message: 'Application packet not found.' });
  });
});

describe('packet reader route parsing', () => {
  it.each(['0', '-1', '1.5', ' 1', 'not-a-number', '9007199254740992', ['1']])(
    'rejects malformed packet version %p',
    (version) => {
      expect(() => parseRequestedPacketVersion(version)).toThrow(HttpError);
    },
  );

  it('accepts a positive integer version and valid UUID application id', () => {
    expect(parseRequestedPacketVersion('2')).toBe(2);
    expect(parseApplicationPacketApplicationId(APPLICATION_ID)).toBe(APPLICATION_ID);
  });

  it.each(['not-a-uuid', '', undefined])('rejects malformed application id %p', (applicationId) => {
    expect(() => parseApplicationPacketApplicationId(applicationId)).toThrow(HttpError);
  });
});
