/**
 * The one application-bound start command against real PostgreSQL.
 *
 * Proves the founder invariant this lane exists for: start-ready and the
 * employer-confirmed actual first day flow ONLY through
 * applicationStartCommandService, atomically — StartActivation advance,
 * StartAttestation, both audit events, and the outbound intent commit
 * together or not at all, and no interleaving of concurrent commands can
 * produce a second attestation. The trust resolver is the only mocked edge;
 * everything else is the real Prisma transaction and constraints (same
 * posture as employerWorkflowAcceptance.db.test.ts, whose fixture plumbing
 * this mirrors).
 */
import { randomUUID } from 'node:crypto';
import { Prisma, UserRole, UserStatus } from '@prisma/client';

jest.mock('../../trust/trustStateEngine', () => ({
  ...jest.requireActual('../../trust/trustStateEngine'),
  computeClinicianTrustState: jest.fn(async () => null),
}));
jest.mock('../../billing/billingEngine', () => ({ processApplicationBilling: jest.fn() }));
jest.mock('../../actions/actionEngineService', () => ({
  refreshActionRecommendations: jest.fn(),
}));

import { upsertOrgProfile } from '../../opportunities/opportunityService';
import {
  sealPacket,
  type ApplicationPacketContent,
} from '../../opportunities/applicationPacketService';
import { runEmployerWorkflowAction } from '../../opportunities/employerWorkflowService';
import { readHireToStartCase } from '../../opportunities/hireToStartReadService';
import { resolveActivationRequirement } from '../activationRequirementService';
import {
  confirmApplicationStart,
  confirmStartByAcceptance,
  markApplicationStartReady,
} from '../applicationStartCommandService';
import prisma from '../../../graphql/prisma_client';

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const EMPLOYER = `start-command-employer-${suffix}`;
const CLINICIAN = `start-command-clinician-${suffix}`;
const NPI = '1234567893';

let organizationId: string;
let organizationProfileId: string;

async function cleanCases(): Promise<void> {
  const applicationIds = (await prisma.application.findMany({
    where: { opportunity: { organizationId } },
    select: { id: true },
  })).map(({ id }) => id);
  const acceptanceIds = (await prisma.employerAcceptance.findMany({
    where: { employerId: organizationId },
    select: { id: true },
  })).map(({ id }) => id);

  // StartAttestation has no organization column on current main (the #1384
  // binding columns are deferred) — clean through the acceptance keys.
  await prisma.startAttestation.deleteMany({ where: { acceptanceId: { in: acceptanceIds } } });
  await prisma.startActivation.deleteMany({ where: { orgId: organizationId } });
  await prisma.employerAcceptance.deleteMany({ where: { employerId: organizationId } });
  await prisma.activationRequirement.deleteMany({ where: { organizationId } });
  await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: applicationIds } } });
  await prisma.auditEvent.deleteMany({ where: { organizationId } });
  await prisma.applicationPacket.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  await prisma.opportunity.deleteMany({ where: { organizationId } });
}

async function createApplication() {
  const opportunity = await prisma.opportunity.create({
    data: {
      id: randomUUID(),
      organizationId,
      title: 'Employed hospitalist',
      specialty: 'Internal Medicine',
      hiringType: 'permanent',
      state: 'CA',
      status: 'ACTIVE',
    },
  });
  const application = await prisma.application.create({
    data: {
      id: randomUUID(),
      opportunityId: opportunity.id,
      clerkUserId: CLINICIAN,
      npi: NPI,
      status: 'PENDING',
      sealedPacketVersion: 1,
    },
  });

  const content: ApplicationPacketContent = {
    applicationId: application.id,
    packetVersion: 1,
    clerkUserId: CLINICIAN,
    clinicianNpi: NPI,
    opportunityId: opportunity.id,
    employerOrgId: organizationId,
    purpose: 'Apply with VitalCV',
    recipient: `Start Command Health ${suffix}`,
    selectedSections: ['identity'],
    fields: [{
      sectionId: 'identity',
      fieldId: 'identity.npi.nppes',
      label: 'NPI',
      value: NPI,
      evidenceState: 'source_backed',
      sourceId: 'nppes',
      sourceObservedAt: '2026-08-14T10:00:00.000Z',
      freshUntil: '2026-11-12T10:00:00.000Z',
      artifactId: null,
      receiptId: 'receipt-start-command-test',
    }],
    sectionAbsences: [],
    clinicianNote: null,
    methodologyVersion: 'start-command-test-v1',
    consentAt: '2026-08-14T10:05:00.000Z',
    consentReceiptId: 'consent-start-command-test',
    opportunityVersion: opportunity.updatedAt.toISOString(),
  };
  const sealed = sealPacket(content);
  await prisma.applicationPacket.create({
    data: {
      id: randomUUID(),
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
      sectionAbsences: sealed.sectionAbsences as unknown as Prisma.InputJsonValue,
      clinicianNote: sealed.clinicianNote,
      methodologyVersion: sealed.methodologyVersion,
      consentAt: new Date(sealed.consentAt),
      consentReceiptId: sealed.consentReceiptId,
      opportunityVersion: sealed.opportunityVersion,
      packetHash: sealed.packetHash,
    },
  });

  return { applicationId: application.id, packetHash: sealed.packetHash };
}

/** Accept as head start, then resolve the one remaining required item. */
async function acceptedCase() {
  const submitted = await createApplication();
  await runEmployerWorkflowAction({
    action: 'accept',
    applicationId: submitted.applicationId,
    reviewerClerkUserId: EMPLOYER,
    packetVersion: 1,
    packetHash: submitted.packetHash,
  });
  const requirement = await prisma.activationRequirement.findFirstOrThrow({
    where: { applicationId: submitted.applicationId },
  });
  return { ...submitted, requirementId: requirement.id };
}

async function makeStartReady(applicationId: string, requirementId: string) {
  expect(await resolveActivationRequirement({
    requirementId,
    organizationId,
    toStatus: 'waived',
    actorId: EMPLOYER,
    reason: 'Institution documented an authorized pilot waiver.',
  })).toEqual({ ok: true });
  return markApplicationStartReady({ applicationId, organizationId, actorId: EMPLOYER });
}

async function attestationCount(applicationId: string): Promise<number> {
  const activation = await prisma.startActivation.findUnique({
    where: { applicationId },
    select: { acceptanceId: true },
  });
  if (!activation?.acceptanceId) return 0;
  return prisma.startAttestation.count({ where: { acceptanceId: activation.acceptanceId } });
}

beforeAll(async () => {
  await prisma.user.create({
    data: {
      clerkUserId: EMPLOYER,
      email: `admin@start-command-${suffix}.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  const org = await upsertOrgProfile(EMPLOYER, {
    name: `Start Command Health ${suffix}`,
    website: `https://start-command-${suffix}.test`,
    facilityType: 'health system',
    statesCovered: ['CA'],
    hiringTypes: ['permanent'],
  });
  organizationId = org.organizationId;
  const organizationProfile = await prisma.organizationProfile.update({
    where: { organizationId },
    data: {
      requirements: [
        { label: 'NPI', level: 'L3', key: 'identity.npi.nppes', priority: 'required' },
        { label: 'Hospital orientation', level: 'L2', key: 'institution.orientation', priority: 'required' },
      ],
    },
  });
  organizationProfileId = organizationProfile.id;

  const clinicianUser = await prisma.user.create({
    data: {
      clerkUserId: CLINICIAN,
      email: `${CLINICIAN}@example.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.personProfile.create({
    data: { userId: clinicianUser.id, npi: NPI },
  });
});

beforeEach(cleanCases);

afterAll(async () => {
  await cleanCases();
  await prisma.workspaceMembership.deleteMany({ where: { organizationProfileId } });
  const userIds = (await prisma.user.findMany({
    where: { clerkUserId: { in: [EMPLOYER, CLINICIAN] } },
    select: { id: true },
  })).map(({ id }) => id);
  await prisma.personProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.organizationProfile.deleteMany({ where: { organizationId } });
  await prisma.user.deleteMany({ where: { clerkUserId: { in: [EMPLOYER, CLINICIAN] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.$disconnect();
});

describe('one application-bound start command — real PostgreSQL', () => {
  it('advances accept → requirements → start-ready → one confirmed first day, atomically', async () => {
    const { applicationId, requirementId, packetHash } = await acceptedCase();
    const actualFirstDay = new Date();

    // (6) Confirm before start-ready is rejected — #1384's semantics require
    // the explicit start-ready decision first; direct confirm is NOT allowed.
    await expect(confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    })).rejects.toMatchObject({ status: 409, code: 'START_NOT_READY' });
    expect(await attestationCount(applicationId)).toBe(0);

    // Start-ready refuses while a required item is open — and writes NOTHING.
    await expect(markApplicationStartReady({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
    })).rejects.toMatchObject({ status: 409, code: 'START_REQUIREMENTS_OPEN' });
    expect(await prisma.auditEvent.count({
      where: { referenceId: applicationId, type: 'START_READY' },
    })).toBe(0);

    const ready = await makeStartReady(applicationId, requirementId);
    expect(ready).toMatchObject({ state: 'start_ready', duplicate: false });
    expect((await prisma.startActivation.findUniqueOrThrow({
      where: { applicationId },
    })).activationState).toBe('start_ready');

    // Requirement resolution and start-ready each committed their outbound
    // intent with the state change.
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: applicationId, eventType: 'HIRE_TO_START_REQUIREMENT_CHANGED' },
    })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: applicationId, eventType: 'HIRE_TO_START_START_READY' },
    })).toBe(1);

    // Re-marking start-ready is idempotent — same audit row, no second event.
    const readyAgain = await markApplicationStartReady({ applicationId, organizationId, actorId: EMPLOYER });
    expect(readyAgain).toMatchObject({ duplicate: true, auditEventId: ready.auditEventId });
    expect(await prisma.auditEvent.count({
      where: { referenceId: applicationId, type: 'START_READY' },
    })).toBe(1);

    // A packet-binding break after acceptance fails the confirm closed.
    await prisma.employerAcceptance.updateMany({
      where: { applicationId },
      data: { packetHash: 'tampered-after-acceptance' },
    });
    await expect(confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    })).rejects.toMatchObject({ status: 409, code: 'START_ACCEPTANCE_REQUIRED' });
    expect(await attestationCount(applicationId)).toBe(0);
    await prisma.employerAcceptance.updateMany({
      where: { applicationId },
      data: { packetHash },
    });

    // A future first day is a projection, not a confirmation.
    await expect(confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })).rejects.toMatchObject({ status: 400 });

    const confirmed = await confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    });
    expect(confirmed).toMatchObject({ state: 'started', duplicate: false });
    expect(confirmed.attestation).toMatchObject({
      role: 'Employed hospitalist',
      startedAt: actualFirstDay,
    });
    // Without the deferred binding columns, the application/organization/actor
    // binding is durable in the attestation metadata and committed by the hash.
    expect(confirmed.attestation.eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(confirmed.attestation.metadata).toMatchObject({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      credentialingApprovalInferred: false,
      institutionReviewRemains: true,
    });
    expect((await prisma.startActivation.findUniqueOrThrow({
      where: { applicationId },
    })).activationState).toBe('started');
    expect(await prisma.auditEvent.count({
      where: { referenceId: applicationId, type: { in: ['START_READY', 'START_RECORDED'] } },
    })).toBe(2);
    expect(await prisma.auditEvent.count({
      where: { referenceId: confirmed.attestation.id, type: 'START_ATTESTED' },
    })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: applicationId, eventType: 'HIRE_TO_START_START_CONFIRMED' },
    })).toBe(1);

    // (2) Replaying the identical confirmation answers idempotently.
    const replay = await confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    });
    expect(replay).toMatchObject({ duplicate: true, attestation: { id: confirmed.attestation.id } });
    expect(await attestationCount(applicationId)).toBe(1);

    // (4) A foreign organization gets the same 404 as an unknown case.
    await expect(confirmApplicationStart({
      applicationId,
      organizationId: randomUUID(),
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    })).rejects.toMatchObject({ status: 404 });

    // A DIFFERENT first day is a conflict, never a silent overwrite.
    await expect(confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: new Date(actualFirstDay.getTime() - 60_000),
    })).rejects.toMatchObject({ status: 409, code: 'START_ALREADY_CONFIRMED' });

    // The joined case surfaces the real writes — stage, actual start, and the
    // start milestones now come from records this command created.
    const joined = await readHireToStartCase({ applicationId, clerkUserId: EMPLOYER });
    expect(joined.currentStage).toBe('started');
    expect(joined.actualStart).toMatchObject({
      attestationId: confirmed.attestation.id,
      actualFirstDay: actualFirstDay.toISOString(),
      employerConfirmed: true,
    });
    expect(joined.milestones.map(({ type }) => type)).toEqual(expect.arrayContaining([
      'start_ready_recorded',
      'actual_start_confirmed',
    ]));
    expect(joined.limitations).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/without an application start event|without an employer start attestation/),
    ]));
  });

  it('(2) allows at most one attestation under concurrent confirmation commands', async () => {
    const { applicationId, requirementId } = await acceptedCase();
    await makeStartReady(applicationId, requirementId);
    const actualFirstDay = new Date();

    const command = () => confirmApplicationStart({
      applicationId,
      organizationId,
      actorId: EMPLOYER,
      startedAt: actualFirstDay,
    });

    // Barrier: hold the aggregate's row lock while BOTH commands start, so
    // both pass their duplicate pre-checks and stack up at the conditional
    // state advance. Without this, event-loop scheduling can serialize the two
    // commands and the pre-check alone masks a broken exactly-once guard —
    // measured: with the advance's count check deleted, an unbarriered version
    // of this test still passed. Releasing the lock makes them race for real.
    let racing!: Promise<PromiseSettledResult<Awaited<ReturnType<typeof command>>>[]>;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM start_activations WHERE application_id = ${applicationId}::uuid FOR UPDATE`;
      racing = Promise.allSettled([command(), command()]);
      await new Promise((resolve) => setTimeout(resolve, 750));
    });
    const attempts = await racing;

    const fulfilled = attempts.filter(
      (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof command>>> => attempt.status === 'fulfilled',
    );
    // The loser of the conditional state advance rolls back whole and answers
    // from the winner's record — so both may fulfil, but exactly one CREATED.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(fulfilled.filter(({ value }) => !value.duplicate)).toHaveLength(1);
    const ids = new Set(fulfilled.map(({ value }) => value.attestation.id));
    expect(ids.size).toBe(1);

    expect(await attestationCount(applicationId)).toBe(1);
    expect(await prisma.auditEvent.count({
      where: { referenceId: applicationId, type: 'START_RECORDED' },
    })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: applicationId, eventType: 'HIRE_TO_START_START_CONFIRMED' },
    })).toBe(1);
  });

  it('(5) fails closed when a compatibility caller presents an unbound legacy acceptance', async () => {
    const acceptance = await prisma.employerAcceptance.create({
      data: {
        employerId: organizationId,
        clinicianNpi: NPI,
        status: 'ACCEPTED',
        acceptedAt: new Date('2026-08-13T18:00:00.000Z'),
      },
    });
    await expect(confirmStartByAcceptance({
      acceptanceId: acceptance.id,
      actorId: EMPLOYER,
      startedAt: new Date('2026-08-14T18:00:00.000Z'),
    })).rejects.toMatchObject({ status: 409, code: 'START_ACCEPTANCE_REQUIRED' });
    expect(await prisma.startAttestation.count({ where: { acceptanceId: acceptance.id } })).toBe(0);
  });

  it('routes the acceptance-keyed machine lane through the same command, cross-checked', async () => {
    const { applicationId, requirementId } = await acceptedCase();
    await makeStartReady(applicationId, requirementId);
    const activation = await prisma.startActivation.findUniqueOrThrow({
      where: { applicationId },
      select: { acceptanceId: true },
    });
    const acceptanceId = activation.acceptanceId!;
    const actualFirstDay = new Date();

    // A clinician-identity mismatch fails closed before any write.
    await expect(confirmStartByAcceptance({
      acceptanceId,
      actorId: `api-key:test-${suffix}`,
      startedAt: actualFirstDay,
      expectedClinicianNpi: '1558302470',
    })).rejects.toMatchObject({ status: 409, code: 'START_ACCEPTANCE_REQUIRED' });

    // An organization-authority mismatch is a uniform 404.
    await expect(confirmStartByAcceptance({
      acceptanceId,
      actorId: `api-key:test-${suffix}`,
      startedAt: actualFirstDay,
      expectedOrganizationId: randomUUID(),
    })).rejects.toMatchObject({ status: 404 });
    expect(await attestationCount(applicationId)).toBe(0);

    const confirmed = await confirmStartByAcceptance({
      acceptanceId,
      actorId: `api-key:test-${suffix}`,
      startedAt: actualFirstDay,
      expectedClinicianNpi: NPI,
      expectedOrganizationId: organizationId,
      role: 'Hospitalist (nocturnist)',
      facility: 'Mercy General',
    });
    expect(confirmed).toMatchObject({ state: 'started', duplicate: false });
    expect(confirmed.attestation).toMatchObject({
      acceptanceId,
      role: 'Hospitalist (nocturnist)',
      facility: 'Mercy General',
    });
    expect(await attestationCount(applicationId)).toBe(1);
  });
});
