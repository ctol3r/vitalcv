/**
 * Hire-to-start acceptance contract against real PostgreSQL.
 *
 * The trust resolver is the only mocked edge. The application transition,
 * packet seal, acceptance, requirement ledger, activation, audit rows, and
 * durable outbox request all use the real Prisma transaction and constraints.
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

import { upsertOrgProfile } from '../opportunityService';
import {
  sealPacket,
  type ApplicationPacketContent,
} from '../applicationPacketService';
import { runEmployerWorkflowAction } from '../employerWorkflowService';
import { readHireToStartCase } from '../hireToStartReadService';
import {
  buildHireToStartIntegrationSignature,
  receiveHireToStartIntegrationEvent,
  type HireToStartInboundEvent,
} from '../../integrations/hireToStartIntegrationService';
import { importGenericHireToStartRoles } from '../../integrations/hireToStartRoleImportService';
import prisma from '../../../graphql/prisma_client';

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const EMPLOYER = `hire-start-employer-${suffix}`;
const CLINICIAN = `hire-start-clinician-${suffix}`;
const NPI = '1558302470';

let organizationId: string;
let organizationProfileId: string;

async function cleanCases(): Promise<void> {
  const applicationIds = (await prisma.application.findMany({
    where: { opportunity: { organizationId } },
    select: { id: true },
  })).map(({ id }) => id);

  await prisma.integrationInboxEvent.deleteMany({ where: { organizationId } });
  await prisma.applicationExternalReference.deleteMany({ where: { organizationId } });
  await prisma.employerWebhookConfig.deleteMany({ where: { employerId: organizationId, eventType: 'HIRE_TO_START_INBOUND' } });
  await prisma.startActivation.deleteMany({ where: { orgId: organizationId } });
  await prisma.employerAcceptance.deleteMany({ where: { employerId: organizationId } });
  await prisma.activationRequirement.deleteMany({ where: { organizationId } });
  await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: applicationIds } } });
  await prisma.auditEvent.deleteMany({ where: { organizationId } });
  await prisma.applicationPacket.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.application.deleteMany({ where: { id: { in: applicationIds } } });
  await prisma.opportunity.deleteMany({ where: { organizationId } });
}

async function createApplication(options: {
  legacy?: boolean;
  revoke?: boolean;
  tamper?: boolean;
} = {}) {
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
      sealedPacketVersion: options.legacy ? null : 1,
    },
  });

  if (options.legacy) {
    return { applicationId: application.id, packetHash: null as string | null };
  }

  const content: ApplicationPacketContent = {
    applicationId: application.id,
    packetVersion: 1,
    clerkUserId: CLINICIAN,
    clinicianNpi: NPI,
    opportunityId: opportunity.id,
    employerOrgId: organizationId,
    purpose: 'Apply with VitalCV',
    recipient: `Hire Start Health ${suffix}`,
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
      receiptId: 'receipt-hire-start-test',
    }],
    sectionAbsences: [],
    clinicianNote: null,
    methodologyVersion: 'hire-start-test-v1',
    consentAt: '2026-08-14T10:05:00.000Z',
    consentReceiptId: 'consent-hire-start-test',
    opportunityVersion: opportunity.updatedAt.toISOString(),
  };
  const sealed = sealPacket(content);
  const packet = await prisma.applicationPacket.create({
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
      revokedAt: options.revoke ? new Date('2026-08-14T11:00:00.000Z') : null,
      revokedReason: options.revoke ? 'Clinician revoked disclosure.' : null,
    },
  });

  if (options.tamper) {
    await prisma.applicationPacket.update({
      where: { id: packet.id },
      data: {
        fields: [{ ...sealed.fields[0], value: '1999999999' }],
      },
    });
  }

  return { applicationId: application.id, packetHash: sealed.packetHash };
}

beforeAll(async () => {
  await prisma.user.create({
    data: {
      clerkUserId: EMPLOYER,
      email: `admin@hire-start-${suffix}.test`,
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    },
  });
  const org = await upsertOrgProfile(EMPLOYER, {
    name: `Hire Start Health ${suffix}`,
    website: `https://hire-start-${suffix}.test`,
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

describe('runEmployerWorkflowAction accept — real PostgreSQL', () => {
  it('commits the exact acceptance, only remaining requirements, activation, audit, and outbox', async () => {
    const submitted = await createApplication();
    const result = await runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: submitted.packetHash!,
      intendedStartDate: '2026-09-01T08:00:00.000Z',
      urgency: 'priority',
    });

    // Keep verification reads sequential. The full backend sweep runs many
    // Prisma suites together, so a fan-out here can exhaust the test server's
    // intentionally small connection budget without exercising more behavior.
    const application = await prisma.application.findUniqueOrThrow({ where: { id: submitted.applicationId } });
    const acceptance = await prisma.employerAcceptance.findFirstOrThrow({ where: { applicationId: submitted.applicationId } });
    const activation = await prisma.startActivation.findUniqueOrThrow({ where: { applicationId: submitted.applicationId } });
    const requirements = await prisma.activationRequirement.findMany({ where: { applicationId: submitted.applicationId } });
    const decisionAudit = await prisma.auditEvent.findFirstOrThrow({
      where: { referenceId: submitted.applicationId, type: 'APPLICATION_DECISION_RECORDED' },
    });
    const outbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { dedupeKey: `APPLICATION_DECISION_CAPSULE_REQUESTED:${submitted.applicationId}:ACCEPTED` },
    });

    expect(application.status).toBe('ACCEPTED');
    expect(acceptance.packetHash).toBe(submitted.packetHash);
    expect(acceptance.acceptedBy).toBe(EMPLOYER);
    expect(activation.acceptanceId).toBe(acceptance.id);
    expect(activation.acceptedPacketHash).toBe(submitted.packetHash);
    expect(activation.activationState).toBe('head_start_accepted');
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({
      sourceRequirementId: 'institution.orientation',
      label: 'Hospital orientation',
      status: 'not_started',
      owner: 'both',
    });
    expect(decisionAudit.organizationId).toBe(organizationId);
    expect(outbox.status).toBe('PENDING');
    expect(result).toMatchObject({
      acceptanceId: acceptance.id,
      startActivationId: activation.id,
      remainingRequirementCount: 1,
    });

    const employerCase = await readHireToStartCase({ applicationId: submitted.applicationId, clerkUserId: EMPLOYER });
    const clinicianCase = await readHireToStartCase({ applicationId: submitted.applicationId, clerkUserId: CLINICIAN });
    expect(employerCase.accessPerspective).toBe('employer');
    expect(clinicianCase.accessPerspective).toBe('clinician');
    expect(employerCase.packetBinding).toMatchObject({
      state: 'bound',
      packetVersion: 1,
      packetHash: submitted.packetHash,
      integrity: 'valid',
    });
    expect(clinicianCase.packetBinding).toEqual(employerCase.packetBinding);
    expect(clinicianCase.requirements).toEqual(employerCase.requirements);
    expect(employerCase.primaryNextAction).toMatchObject({ owner: 'clinician', objectId: requirements[0].id });
    expect(employerCase.externalSystemSync.state).toBe('not_configured');

    await expect(readHireToStartCase({
      applicationId: submitted.applicationId,
      clerkUserId: `outside-${suffix}`,
    })).rejects.toMatchObject({ status: 404 });
  });

  it('allows at most one terminal acceptance under concurrent commands', async () => {
    const submitted = await createApplication();
    const command = () => runEmployerWorkflowAction({
      action: 'accept' as const,
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: submitted.packetHash!,
    });

    const attempts = await Promise.allSettled([command(), command()]);
    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.employerAcceptance.count({ where: { applicationId: submitted.applicationId } })).toBe(1);
    expect(await prisma.startActivation.count({ where: { applicationId: submitted.applicationId } })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: submitted.applicationId, eventType: 'APPLICATION_DECISION_CAPSULE_REQUESTED' },
    })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { aggregateId: submitted.applicationId, eventType: 'HIRE_TO_START_DECISION_RECORDED' },
    })).toBe(1);
  });

  it('accepts signed requirement events once, rejects content replay, and ignores older state', async () => {
    const submitted = await createApplication();
    await runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: submitted.packetHash!,
    });
    const requirement = await prisma.activationRequirement.findFirstOrThrow({
      where: { applicationId: submitted.applicationId },
    });
    const key = await prisma.employerWebhookConfig.create({
      data: {
        employerId: organizationId,
        webhookUrl: 'https://integration.invalid/hire-to-start',
        secret: 'test-hire-to-start-secret-at-least-32-bytes',
        eventType: 'HIRE_TO_START_INBOUND',
      },
    });
    const now = new Date();
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const event: HireToStartInboundEvent = {
      version: '1',
      organizationId,
      sourceSystem: 'design-partner-test',
      externalEventId: `requirement-requested-${suffix}`,
      eventType: 'requirement.status_changed',
      applicationId: submitted.applicationId,
      occurredAt: now.toISOString(),
      data: {
        requirementId: requirement.id,
        status: 'requested',
        objectType: 'credentialing-case',
        externalIdentifier: `case-${suffix}`,
        limitation: 'Partner status only; no source-backed evidence was supplied.',
      },
    };
    const headers = {
      keyId: key.id,
      timestamp,
      signature: buildHireToStartIntegrationSignature(event, timestamp, key.secret!),
    };

    const staleTimestamp = String(Math.floor(now.getTime() / 1000) - 301);
    await expect(receiveHireToStartIntegrationEvent(event, {
      keyId: key.id,
      timestamp: staleTimestamp,
      signature: buildHireToStartIntegrationSignature(event, staleTimestamp, key.secret!),
    }, now)).rejects.toMatchObject({ status: 401 });
    await expect(receiveHireToStartIntegrationEvent(event, {
      ...headers,
      signature: `v1=${'0'.repeat(64)}`,
    }, now)).rejects.toMatchObject({ status: 401 });

    const first = await receiveHireToStartIntegrationEvent(event, headers, now);
    const replay = await receiveHireToStartIntegrationEvent(event, headers, now);
    expect(first).toMatchObject({ state: 'PROCESSED', duplicate: false });
    expect(replay).toMatchObject({ receiptId: first.receiptId, state: 'PROCESSED', duplicate: true });

    const updated = await prisma.activationRequirement.findUniqueOrThrow({ where: { id: requirement.id } });
    expect(updated).toMatchObject({
      status: 'requested',
      externalSourceSystem: 'design-partner-test',
      externalObjectType: 'credentialing-case',
      externalIdentifier: `case-${suffix}`,
      externalLimitation: 'Partner status only; no source-backed evidence was supplied.',
    });
    expect(await prisma.integrationInboxEvent.count({ where: { externalEventId: event.externalEventId } })).toBe(1);
    expect(await prisma.outboxEvent.count({
      where: { dedupeKey: `HIRE_TO_START_REQUIREMENT_CHANGED:${requirement.id}:${event.externalEventId}` },
    })).toBe(1);

    const tampered: HireToStartInboundEvent = {
      ...event,
      data: { ...event.data, status: 'submitted' },
    };
    await expect(receiveHireToStartIntegrationEvent(tampered, {
      ...headers,
      signature: buildHireToStartIntegrationSignature(tampered, timestamp, key.secret!),
    }, now)).rejects.toMatchObject({ status: 409 });

    const older: HireToStartInboundEvent = {
      ...event,
      externalEventId: `requirement-older-${suffix}`,
      occurredAt: new Date(now.getTime() - 60_000).toISOString(),
      data: { ...event.data, status: 'submitted' },
    };
    const ignored = await receiveHireToStartIntegrationEvent(older, {
      keyId: key.id,
      timestamp,
      signature: buildHireToStartIntegrationSignature(older, timestamp, key.secret!),
    }, now);
    expect(ignored).toMatchObject({ state: 'IGNORED', reason: 'out_of_order' });
    expect((await prisma.activationRequirement.findUniqueOrThrow({ where: { id: requirement.id } })).status).toBe('requested');

    const packetCount = await prisma.applicationPacket.count({ where: { applicationId: submitted.applicationId } });
    expect(packetCount).toBe(1);
    const joined = await readHireToStartCase({ applicationId: submitted.applicationId, clerkUserId: EMPLOYER });
    expect(joined.externalSystemSync.state).toBe('fresh');
    expect(joined.requirements[0]).toMatchObject({
      externalSourceSystem: 'design-partner-test',
      externalLimitation: 'Partner status only; no source-backed evidence was supplied.',
    });
  });

  it('keeps external references tenant-scoped and unique across applications', async () => {
    const firstApplication = await createApplication();
    const secondApplication = await createApplication();
    const key = await prisma.employerWebhookConfig.create({
      data: {
        employerId: organizationId,
        webhookUrl: 'https://integration.invalid/hire-to-start',
        secret: 'test-hire-to-start-secret-at-least-32-bytes',
        eventType: 'HIRE_TO_START_INBOUND',
      },
    });
    const now = new Date();
    const timestamp = String(Math.floor(now.getTime() / 1000));
    const mapping = (applicationId: string, externalEventId: string): HireToStartInboundEvent => ({
      version: '1',
      organizationId,
      sourceSystem: 'partner-ats',
      externalEventId,
      eventType: 'application.external_reference.upserted',
      applicationId,
      occurredAt: now.toISOString(),
      data: { objectType: 'ats-application', externalIdentifier: `ATS-${suffix}` },
    });
    const first = mapping(firstApplication.applicationId, `mapping-first-${suffix}`);
    const second = mapping(secondApplication.applicationId, `mapping-second-${suffix}`);

    expect(await receiveHireToStartIntegrationEvent(first, {
      keyId: key.id,
      timestamp,
      signature: buildHireToStartIntegrationSignature(first, timestamp, key.secret!),
    }, now)).toMatchObject({ state: 'PROCESSED' });
    expect(await receiveHireToStartIntegrationEvent(second, {
      keyId: key.id,
      timestamp,
      signature: buildHireToStartIntegrationSignature(second, timestamp, key.secret!),
    }, now)).toMatchObject({ state: 'FAILED', reason: 'external_reference_conflict' });

    const references = await prisma.applicationExternalReference.findMany({ where: { organizationId } });
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      applicationId: firstApplication.applicationId,
      sourceSystem: 'partner-ats',
      objectType: 'ats-application',
      externalIdentifier: `ATS-${suffix}`,
    });
  });

  it('imports generic roles idempotently into only the verified caller organization', async () => {
    const input = {
      sourceSystem: 'partner-ats',
      roles: [{
        externalRoleId: `ROLE-${suffix}`,
        title: 'Employed cardiologist',
        specialty: 'Cardiology',
        hiringType: 'permanent',
        state: 'CA',
        description: 'Partner-supplied role description.',
        remote: false,
        status: 'ACTIVE' as const,
        sourceUrl: 'https://jobs.example.test/role/123',
      }],
    };
    const created = await importGenericHireToStartRoles(EMPLOYER, input);
    const updated = await importGenericHireToStartRoles(EMPLOYER, {
      ...input,
      roles: [{ ...input.roles[0], title: 'Employed cardiologist — updated' }],
    });
    expect(created).toMatchObject({ organizationId, created: 1, updated: 0 });
    expect(updated).toMatchObject({ organizationId, created: 0, updated: 1 });
    expect(updated.opportunityIds).toEqual(created.opportunityIds);
    const role = await prisma.opportunity.findUniqueOrThrow({ where: { id: created.opportunityIds[0] } });
    expect(role).toMatchObject({
      organizationId,
      title: 'Employed cardiologist — updated',
      listingSource: 'employer_posted',
      sourceFeed: 'employer_integration',
    });
    await expect(importGenericHireToStartRoles(CLINICIAN, input)).rejects.toMatchObject({ status: 404 });
  });

  it.each([
    ['tampered', { tamper: true }],
    ['revoked', { revoke: true }],
  ])('fails closed for a %s packet without partial consequences', async (_label, options) => {
    const submitted = await createApplication(options);

    await expect(runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: submitted.packetHash!,
    })).rejects.toThrow(/packet/i);

    const application = await prisma.application.findUniqueOrThrow({ where: { id: submitted.applicationId } });
    expect(application.status).toBe('PENDING');
    expect(await prisma.employerAcceptance.count({ where: { applicationId: submitted.applicationId } })).toBe(0);
    expect(await prisma.startActivation.count({ where: { applicationId: submitted.applicationId } })).toBe(0);
    expect(await prisma.activationRequirement.count({ where: { applicationId: submitted.applicationId } })).toBe(0);
  });

  it('rejects a legacy application instead of fabricating submitted evidence', async () => {
    const submitted = await createApplication({ legacy: true });

    await expect(runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: 'not-a-real-packet',
    })).rejects.toThrow(/Legacy application/);

    expect((await prisma.application.findUniqueOrThrow({ where: { id: submitted.applicationId } })).status).toBe('PENDING');
    expect(await prisma.employerAcceptance.count({ where: { applicationId: submitted.applicationId } })).toBe(0);
  });

  it('rejects a mismatched reviewed hash before any state transition', async () => {
    const submitted = await createApplication();

    await expect(runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 1,
      packetHash: 'different-reviewed-hash',
    })).rejects.toThrow(/hash/i);

    expect((await prisma.application.findUniqueOrThrow({ where: { id: submitted.applicationId } })).status).toBe('PENDING');
  });

  it('rejects a packet version that is not the application attachment', async () => {
    const submitted = await createApplication();

    await expect(runEmployerWorkflowAction({
      action: 'accept',
      applicationId: submitted.applicationId,
      reviewerClerkUserId: EMPLOYER,
      packetVersion: 2,
      packetHash: submitted.packetHash!,
    })).rejects.toThrow(/version/i);

    expect((await prisma.application.findUniqueOrThrow({ where: { id: submitted.applicationId } })).status).toBe('PENDING');
    expect(await prisma.employerAcceptance.count({ where: { applicationId: submitted.applicationId } })).toBe(0);
  });
});
