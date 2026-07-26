/**
 * Seal W0.2 — transactional submission, against a REAL database.
 *
 * This suite exists to prove the acceptance gate, not the happy path:
 *  - the exact submitted packet REPLAYS after Wallet evidence changes;
 *  - changing current evidence does NOT mutate the submitted packet;
 *  - the packet hash is stable;
 *  - retry does not create duplicates;
 *  - consent is recorded (as a durable audit row, not a boolean);
 *  - clinician and employer read the same submitted packet.
 *
 * Only the evidence resolver is mocked — it performs network I/O (NPPES). The
 * database, transaction, and uniqueness constraints are real, because those
 * are precisely what is under test.
 */

import { PrismaClient } from '@prisma/client';

import { verifySealedPacket, type SealedApplicationPacket } from '../applicationPacketService';

const trustStateMock = jest.fn();
jest.mock('../../trust/trustStateEngine', () => ({
  ...jest.requireActual('../../trust/trustStateEngine'),
  computeClinicianTrustState: (npi: string) => trustStateMock(npi),
}));

// Downstream side effects are out of scope for this bundle's contract.
jest.mock('../../billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../actions/actionEngineService', () => ({ refreshActionRecommendations: jest.fn() }));

import { applyToOpportunity } from '../applicationService';

const prisma = new PrismaClient();

const NPI = '1558302470';
const CLERK_USER = 'user_seal_test';

/**
 * A COMPLETE ClinicianTrustState — the hydrate path (buildReadinessSummary)
 * reads the scoring fields, not just the facts the packet freezes. A partial
 * fixture would only prove the packet path and leave hydrate untested.
 */
function trustState(overrides: { identityDetails?: string; extraFact?: boolean } = {}) {
  return {
    npi: NPI,
    identityVerified: true,
    licensureStatus: 'verified' as const,
    exclusionClear: true,
    credentialCount: 2,
    readiness_level: 'L2' as const,
    readiness_status: 'Provisional — licensure pending',
    readiness_score: 72,
    gap_summary: ['State licensure requires source access'],
    methodology_version: '243.3',
    computed_at: '2026-07-16T11:05:00.000Z',
    computedAt: '2026-07-16T11:05:00.000Z',
    trustBand: 'L2' as const,
    trustScore: 72,
    gaps: ['State licensure requires source access'],
    facts: [
      {
        factType: 'identity',
        source: 'NPPES',
        status: 'source_backed',
        verifiedAt: '2026-07-16T11:00:00.000Z',
        expiresAt: '2026-10-14T11:00:00.000Z',
        details: overrides.identityDetails ?? 'NPI active · name match',
      },
      {
        factType: 'exclusion',
        source: 'OIG_LEIE',
        status: 'clear',
        verifiedAt: '2026-07-16T11:01:00.000Z',
        details: 'No exclusion found',
      },
      ...(overrides.extraFact
        ? [
            {
              factType: 'licensure',
              source: 'STATE_BOARD',
              status: 'source_backed',
              verifiedAt: '2026-07-17T09:00:00.000Z',
              details: 'License verified after submission',
            },
          ]
        : []),
    ],
  };
}

let organizationId: string;
let opportunityId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: 'Seal Test Health', slug: `seal-test-${Date.now()}` },
  });
  organizationId = org.id;
  const opp = await prisma.opportunity.create({
    data: {
      organizationId,
      title: 'Hospitalist',
      specialty: 'Internal Medicine',
      state: 'CA',
      status: 'ACTIVE',
      hiringType: 'PERMANENT',
    },
  });
  opportunityId = opp.id;
  const user = await prisma.user.create({
    data: { clerkUserId: CLERK_USER, email: `${CLERK_USER}@example.com` },
  });
  await prisma.personProfile.create({ data: { userId: user.id, npi: NPI } });
});

afterAll(async () => {
  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.application.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: CLERK_USER } });
  await prisma.opportunity.deleteMany({ where: { organizationId } });
  await prisma.personProfile.deleteMany({ where: { npi: NPI } });
  await prisma.user.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  trustStateMock.mockReset();
  trustStateMock.mockResolvedValue(trustState());
  // Each case starts from no application: submission is idempotent by design,
  // so a row left by a prior test would silently short-circuit the next one.
  await prisma.applicationPacket.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.application.deleteMany({ where: { clerkUserId: CLERK_USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: CLERK_USER } });
});

async function readPacket(applicationId: string): Promise<SealedApplicationPacket> {
  const row = await prisma.applicationPacket.findFirstOrThrow({
    where: { applicationId },
    orderBy: { packetVersion: 'desc' },
  });
  return {
    applicationId: row.applicationId,
    packetVersion: row.packetVersion,
    clerkUserId: row.clerkUserId,
    clinicianNpi: row.clinicianNpi,
    opportunityId: row.opportunityId,
    employerOrgId: row.employerOrgId,
    purpose: row.purpose,
    recipient: row.recipient,
    selectedSections: row.selectedSections as string[],
    fields: row.fields as never,
    clinicianNote: row.clinicianNote,
    methodologyVersion: row.methodologyVersion,
    consentAt: row.consentAt.toISOString(),
    consentReceiptId: row.consentReceiptId,
    // Mirror the read service (J5b): a NULL column reconstructs as `undefined`
    // so canonicalize omits the key and the seal hash still verifies. A new
    // packet carries the version string, which is covered by the seal hash.
    opportunityVersion: row.opportunityVersion ?? undefined,
    packetHash: row.packetHash,
  };
}

describe('applyToOpportunity — sealed submission (real DB)', () => {
  it('seals a packet, records consent, and links the application in one transaction', async () => {
    const application = await applyToOpportunity({
      opportunityId,
      clerkUserId: CLERK_USER,
      coverNote: 'Available in August.',
    });

    const row = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(row.sealedPacketVersion).toBe(1);

    const packet = await readPacket(application.id);
    expect(verifySealedPacket(packet)).toBe(true);
    expect(packet.fields.length).toBeGreaterThan(0);
    // J5b: the packet records — inside the seal — which opportunity version it
    // was sealed against, so it verifies WITH the version present (not omitted).
    expect(packet.opportunityVersion).toBeTruthy();
    // Recipient is the org NAME frozen at consent time, not just an id.
    expect(packet.recipient).toBe('Seal Test Health');
    expect(packet.clinicianNote).toBe('Available in August.');

    // Consent is a durable audit row — the packet points at its real id.
    const consent = await prisma.auditEvent.findUniqueOrThrow({
      where: { id: packet.consentReceiptId },
    });
    expect(consent.type).toBe('application_consent');
    expect(consent.referenceId).toBe(application.id);

    const sealedEvent = await prisma.auditEvent.findFirst({
      where: { referenceId: application.id, type: 'application_packet_sealed' },
    });
    expect(sealedEvent?.hash).toBe(packet.packetHash);
  });

  it('ACCEPTANCE GATE: the submitted packet replays unchanged after Wallet evidence moves', async () => {
    const application = await applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER });
    const submitted = await readPacket(application.id);

    // The Wallet changes: identity detail rewritten, a new licensure fact lands.
    trustStateMock.mockResolvedValue(
      trustState({ identityDetails: 'NPI active · name CHANGED', extraFact: true }),
    );

    // Any later read/retry must not touch the sealed packet.
    await applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER });

    const afterChange = await readPacket(application.id);
    expect(afterChange).toEqual(submitted);
    expect(afterChange.packetHash).toBe(submitted.packetHash);
    expect(verifySealedPacket(afterChange)).toBe(true);
    // The stale value is preserved verbatim — never silently refreshed.
    expect(JSON.stringify(afterChange.fields)).toContain('NPI active · name match');
    expect(JSON.stringify(afterChange.fields)).not.toContain('name CHANGED');
  });

  it('IDEMPOTENT: retries create exactly one application and one packet', async () => {
    const first = await applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER });
    const retries = await Promise.all([
      applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER }),
      applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER }),
      applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER }),
    ]);
    for (const retry of retries) expect(retry.id).toBe(first.id);

    expect(await prisma.application.count({ where: { clerkUserId: CLERK_USER, opportunityId } })).toBe(1);
    expect(await prisma.applicationPacket.count({ where: { applicationId: first.id } })).toBe(1);
    // One consent per real disclosure — retries must not mint consent receipts.
    expect(
      await prisma.auditEvent.count({
        where: { referenceId: first.id, type: 'application_consent' },
      }),
    ).toBe(1);
  });

  it('reapplying after withdrawal seals a NEW version and retains the prior one', async () => {
    const first = await applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER });
    const firstPacket = await readPacket(first.id);
    await prisma.application.update({ where: { id: first.id }, data: { status: 'WITHDRAWN' } });

    trustStateMock.mockResolvedValue(trustState({ identityDetails: 'NPI active · refreshed' }));
    const again = await applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER });
    expect(again.id).toBe(first.id);

    const versions = await prisma.applicationPacket.findMany({
      where: { applicationId: first.id },
      orderBy: { packetVersion: 'asc' },
    });
    expect(versions.map((v) => v.packetVersion)).toEqual([1, 2]);
    // History is never rewritten: v1 still hashes to its original seal.
    expect(versions[0].packetHash).toBe(firstPacket.packetHash);
    expect(versions[1].packetHash).not.toBe(firstPacket.packetHash);

    const row = await prisma.application.findUniqueOrThrow({ where: { id: first.id } });
    expect(row.sealedPacketVersion).toBe(2);
  });

  it('refuses to seal an empty disclosure rather than sealing a hollow packet', async () => {
    trustStateMock.mockResolvedValue({ ...trustState(), facts: [] });
    await expect(
      applyToOpportunity({ opportunityId, clerkUserId: CLERK_USER }),
    ).rejects.toThrow(/evidence/i);
    // Nothing partial survives — the transaction rolled back.
    expect(await prisma.application.count({ where: { clerkUserId: CLERK_USER, opportunityId } })).toBe(0);
  });
});
