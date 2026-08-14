/**
 * Canonical application-bound hire-to-start commands.
 *
 * Start-ready and confirmed-first-day are aggregate transitions. Each command
 * advances StartActivation and writes its audit/outbox consequences in the same
 * PostgreSQL transaction. Confirmation also creates exactly one application-
 * bound StartAttestation and its non-repudiation event. It never implies
 * credentialing, enrollment, privileging, or institutional approval.
 */
import { Prisma, type StartAttestation } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';
import { enqueueHireToStartOutboundEvent } from '../integrations/hireToStartOutbox';
import { isRequirementResolved, type ActivationRequirementStatus } from './requirementLifecycle';

export interface StartReadyResult {
  state: 'start_ready';
  duplicate: boolean;
  auditEventId: string;
  activationId: string;
}

export interface ConfirmedApplicationStartResult {
  state: 'started';
  duplicate: boolean;
  applicationId: string;
  organizationId: string;
  attestation: StartAttestation;
  lifecycleAuditEventId: string;
  attestationAuditEventId: string;
}

function conflict(message: string, code: string): HttpError {
  return new HttpError(409, message, code);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const START_READY_ALLOWED_STATES = new Set([
  'head_start_accepted',
  'requirements_in_progress',
  'waiting_on_clinician',
  'waiting_on_issuer',
  'manual_review',
  'cancelled',
]);

export async function markApplicationStartReady(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
  now?: Date;
}): Promise<StartReadyResult> {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const activation = await tx.startActivation.findFirst({
      where: { applicationId: input.applicationId, orgId: input.organizationId },
    });
    if (!activation) throw new HttpError(404, 'Hire-to-start case not found.');

    const priorAudit = await tx.auditEvent.findFirst({
      where: { type: 'START_READY', referenceId: input.applicationId, organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (activation.activationState === 'start_ready' && priorAudit) {
      return { state: 'start_ready', duplicate: true, auditEventId: priorAudit.id, activationId: activation.id };
    }
    if (!START_READY_ALLOWED_STATES.has(activation.activationState)) {
      throw conflict(`The case cannot be marked start-ready from ${activation.activationState}.`, 'INVALID_START_STATE');
    }

    const requirements = await tx.activationRequirement.findMany({
      where: { applicationId: input.applicationId, organizationId: input.organizationId, necessity: 'required' },
      select: { id: true, label: true, status: true, owner: true },
    });
    const blocking = requirements.filter((requirement) => (
      !isRequirementResolved(requirement.status as ActivationRequirementStatus)
    ));
    if (blocking.length > 0) {
      throw conflict('Required items remain unresolved.', 'START_REQUIREMENTS_OPEN');
    }

    const advanced = await tx.startActivation.updateMany({
      where: { id: activation.id, activationState: activation.activationState },
      data: { activationState: 'start_ready', updatedAt: now },
    });
    if (advanced.count !== 1) throw conflict('The start state changed; reload the case.', 'START_STATE_CONFLICT');

    const payload = {
      schema: 'vitalcv.application-start-ready.v1',
      applicationId: input.applicationId,
      organizationId: input.organizationId,
      activationId: activation.id,
      actorId: input.actorId,
      recordedAt: now.toISOString(),
      requiredItemsResolved: requirements.length,
      institutionReviewRemains: true,
    };
    const audit = await tx.auditEvent.create({
      data: {
        type: 'START_READY',
        referenceId: input.applicationId,
        organizationId: input.organizationId,
        clinicianId: activation.clinicianNpi,
        hash: sha256ForPayload(payload),
        metadata: payload,
      },
    });
    await enqueueHireToStartOutboundEvent(tx, {
      eventType: 'HIRE_TO_START_START_READY',
      applicationId: input.applicationId,
      organizationId: input.organizationId,
      occurredAt: now,
      dedupeKey: `HIRE_TO_START_START_READY:${input.applicationId}`,
      data: { activationId: activation.id, auditEventId: audit.id, institutionReviewRemains: true },
    });
    return { state: 'start_ready', duplicate: false, auditEventId: audit.id, activationId: activation.id };
  });
}

async function existingConfirmedStart(
  applicationId: string,
  organizationId: string,
): Promise<ConfirmedApplicationStartResult | null> {
  const existing = await prisma.startAttestation.findFirst({ where: { applicationId, organizationId } });
  if (!existing?.applicationId || !existing.organizationId) return null;
  const [lifecycle, attestationAudit] = await Promise.all([
    prisma.auditEvent.findFirst({
      where: { type: 'START_RECORDED', referenceId: applicationId, organizationId: existing.organizationId },
      orderBy: { createdAt: 'desc' }, select: { id: true },
    }),
    prisma.auditEvent.findFirst({
      where: { type: 'START_ATTESTED', referenceId: existing.id },
      orderBy: { createdAt: 'desc' }, select: { id: true },
    }),
  ]);
  if (!lifecycle || !attestationAudit) {
    throw conflict('The existing start record is incomplete and requires review.', 'START_RECORD_INCOMPLETE');
  }
  return {
    state: 'started', duplicate: true, applicationId, organizationId: existing.organizationId,
    attestation: existing, lifecycleAuditEventId: lifecycle.id, attestationAuditEventId: attestationAudit.id,
  };
}

export async function confirmApplicationStart(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
  startedAt: Date;
  role?: string | null;
  facility?: string | null;
  now?: Date;
}): Promise<ConfirmedApplicationStartResult> {
  const now = input.now ?? new Date();
  if (Number.isNaN(input.startedAt.getTime())) throw new HttpError(400, 'startedAt must be a valid ISO date.');
  if (input.startedAt.getTime() > now.getTime()) {
    throw new HttpError(400, 'Actual first day cannot be in the future.');
  }

  const duplicate = await existingConfirmedStart(input.applicationId, input.organizationId);
  if (duplicate) {
    if (duplicate.attestation.startedAt.getTime() !== input.startedAt.getTime()) {
      throw conflict('A different actual first day is already confirmed.', 'START_ALREADY_CONFIRMED');
    }
    return duplicate;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: { id: input.applicationId, opportunity: { organizationId: input.organizationId } },
        select: {
          id: true,
          npi: true,
          opportunity: { select: { title: true, organizationId: true, organization: { select: { name: true } } } },
        },
      });
      if (!application) throw new HttpError(404, 'Hire-to-start case not found.');
      const [activation, acceptance] = await Promise.all([
        tx.startActivation.findFirst({
          where: { applicationId: input.applicationId, orgId: input.organizationId },
        }),
        tx.employerAcceptance.findFirst({
          where: {
            applicationId: input.applicationId,
            employerId: input.organizationId,
            status: 'ACCEPTED',
          },
          orderBy: { acceptedAt: 'desc' },
        }),
      ]);
      if (
        !activation
        || !acceptance
        || activation.acceptanceId !== acceptance.id
        || !activation.acceptedPacketId
        || !activation.acceptedPacketHash
        || activation.acceptedPacketHash !== acceptance.packetHash
      ) {
        throw conflict('A packet-bound active acceptance is required.', 'START_ACCEPTANCE_REQUIRED');
      }
      if (activation.activationState !== 'start_ready') {
        throw conflict('The case must be explicitly marked start-ready first.', 'START_NOT_READY');
      }
      if (input.startedAt < acceptance.acceptedAt) {
        throw new HttpError(400, 'Actual first day cannot precede head-start acceptance.');
      }

      const attestationId = randomUUID();
      const role = input.role?.trim() || activation.role?.trim() || application.opportunity.title;
      const facility = input.facility?.trim() || acceptance.organization?.trim() || application.opportunity.organization.name;
      const eventPayload = {
        schema: 'vitalcv.application-confirmed-start.v1',
        applicationId: input.applicationId,
        organizationId: input.organizationId,
        activationId: activation.id,
        acceptanceId: acceptance.id,
        attestationId,
        actorId: input.actorId,
        clinicianNpi: application.npi ?? activation.clinicianNpi,
        role,
        facility,
        actualFirstDay: input.startedAt.toISOString(),
        confirmedAt: now.toISOString(),
        credentialingApprovalInferred: false,
        institutionReviewRemains: true,
      };
      const eventHash = sha256ForPayload(eventPayload);
      const advanced = await tx.startActivation.updateMany({
        where: { id: activation.id, activationState: 'start_ready' },
        data: { activationState: 'started', updatedAt: now },
      });
      if (advanced.count !== 1) throw conflict('The start state changed; reload the case.', 'START_STATE_CONFLICT');

      const attestation = await tx.startAttestation.create({
        data: {
          id: attestationId,
          acceptanceId: acceptance.id,
          applicationId: input.applicationId,
          organizationId: input.organizationId,
          confirmedBy: input.actorId,
          role,
          facility,
          startedAt: input.startedAt,
          anchoredRoot: null,
          eventHash,
          metadata: eventPayload,
          createdAt: now,
        },
      });
      const attestationAudit = await tx.auditEvent.create({
        data: {
          type: 'START_ATTESTED', referenceId: attestation.id,
          clinicianId: application.npi ?? activation.clinicianNpi,
          organizationId: input.organizationId, hash: eventHash,
          metadata: eventPayload,
        },
      });
      const lifecycleAudit = await tx.auditEvent.create({
        data: {
          type: 'START_RECORDED', referenceId: input.applicationId,
          clinicianId: application.npi ?? activation.clinicianNpi,
          organizationId: input.organizationId, hash: eventHash,
          metadata: { ...eventPayload, startAttestationId: attestation.id, attestationAuditEventId: attestationAudit.id },
        },
      });
      await enqueueHireToStartOutboundEvent(tx, {
        eventType: 'HIRE_TO_START_START_CONFIRMED',
        applicationId: input.applicationId,
        organizationId: input.organizationId,
        occurredAt: now,
        dedupeKey: `HIRE_TO_START_START_CONFIRMED:${input.applicationId}`,
        data: {
          startAttestationId: attestation.id,
          acceptanceId: acceptance.id,
          actualFirstDay: input.startedAt.toISOString(),
          lifecycleAuditEventId: lifecycleAudit.id,
        },
      });
      return {
        state: 'started' as const,
        duplicate: false,
        applicationId: input.applicationId,
        organizationId: input.organizationId,
        attestation,
        lifecycleAuditEventId: lifecycleAudit.id,
        attestationAuditEventId: attestationAudit.id,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await existingConfirmedStart(input.applicationId, input.organizationId);
      if (raced && raced.attestation.startedAt.getTime() === input.startedAt.getTime()) return raced;
      if (!raced) throw new HttpError(404, 'Hire-to-start case not found.');
      throw conflict('A different actual first day is already confirmed.', 'START_ALREADY_CONFIRMED');
    }
    throw error;
  }
}

export async function confirmStartByAcceptance(input: {
  acceptanceId: string;
  actorId: string;
  startedAt: Date;
  role?: string | null;
  facility?: string | null;
  expectedClinicianNpi?: string | null;
  expectedOrganizationId?: string | null;
}): Promise<ConfirmedApplicationStartResult> {
  const acceptance = await prisma.employerAcceptance.findUnique({
    where: { id: input.acceptanceId },
    select: {
      applicationId: true,
      clinicianNpi: true,
      employerId: true,
      status: true,
    },
  });
  if (
    !acceptance
    || acceptance.status !== 'ACCEPTED'
    || !acceptance.applicationId
    || !acceptance.clinicianNpi
    || !acceptance.employerId
  ) {
    throw conflict('A packet-bound application acceptance is required.', 'START_ACCEPTANCE_REQUIRED');
  }
  if (input.expectedClinicianNpi && acceptance.clinicianNpi !== input.expectedClinicianNpi) {
    throw conflict('The acceptance does not belong to this clinician.', 'START_ACCEPTANCE_REQUIRED');
  }
  const application = await prisma.application.findUnique({
    where: { id: acceptance.applicationId },
    select: { opportunity: { select: { organizationId: true } } },
  });
  if (!application) throw new HttpError(404, 'Hire-to-start case not found.');
  if (application.opportunity.organizationId !== acceptance.employerId) {
    throw conflict('The acceptance is not bound to the application organization.', 'START_ACCEPTANCE_REQUIRED');
  }
  if (input.expectedOrganizationId && application.opportunity.organizationId !== input.expectedOrganizationId) {
    throw new HttpError(404, 'Hire-to-start case not found.');
  }
  return confirmApplicationStart({
    applicationId: acceptance.applicationId,
    organizationId: application.opportunity.organizationId,
    actorId: input.actorId,
    startedAt: input.startedAt,
    role: input.role,
    facility: input.facility,
  });
}
