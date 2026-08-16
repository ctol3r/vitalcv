/**
 * Canonical application-bound hire-to-start commands (ADR 0007 succession —
 * this module is the one authoritative start command; reconstructs PR #1384
 * onto current main).
 *
 * Start-ready and confirmed-first-day are aggregate transitions. Each command
 * advances StartActivation and writes its audit/outbox consequences in the same
 * PostgreSQL transaction. Confirmation also creates exactly one StartAttestation
 * for the case and its START_ATTESTED non-repudiation event. It never implies
 * credentialing, enrollment, privileging, or institutional approval — every
 * payload states `credentialingApprovalInferred: false` and
 * `institutionReviewRemains: true`; start-ready is an operational state, not a
 * credentialing claim.
 *
 * EXACTLY-ONCE WITHOUT A SCHEMA CHANGE. #1384 added
 * `StartAttestation.applicationId` with a unique index and leaned on P2002 to
 * resolve races. That column set (applicationId/organizationId/confirmedBy +
 * migration) is a founder-approval tier and is deferred. Here the guarantee is
 * carried by the conditional state advance inside the transaction: the
 * `updateMany({ where: { id, activationState: 'start_ready' } })` row lock
 * serializes concurrent confirms — the loser observes count 0, the transaction
 * rolls back (no attestation, no audit, no outbox), and the caller re-reads the
 * winner's record to answer idempotently. The application/organization/actor
 * binding those columns would have held is durable in the attestation metadata
 * and both audit rows instead.
 *
 * AUTHORIZATION IS THE CALLER'S JOB ONLY FOR IDENTITY, NEVER FOR ORG SCOPE:
 * `organizationId` must be server-derived (route membership resolution or the
 * acceptance's own organization) — the org scoping inside every query here is
 * what makes a foreign-org caller indistinguishable from an unknown case (404).
 */
import type { StartAttestation } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';
import { enqueueHireToStartOutboundEvent } from './hireToStartOutbox';
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
      data: { activationState: 'start_ready' },
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

/**
 * The already-confirmed record for a case, or null when no confirmation exists.
 *
 * Without the deferred `StartAttestation.applicationId` column, the case's
 * attestation is resolved through its StartActivation's acceptance. A record
 * that exists but is missing either of its paired audit rows (e.g. a legacy
 * machine-lane attestation on the same acceptance, which has START_ATTESTED but
 * no START_RECORDED lifecycle event) fails closed as incomplete rather than
 * being silently double-attested or adopted as a confirmation.
 */
async function existingConfirmedStart(
  applicationId: string,
  organizationId: string,
): Promise<ConfirmedApplicationStartResult | null> {
  const activation = await prisma.startActivation.findFirst({
    where: { applicationId, orgId: organizationId },
    select: { acceptanceId: true },
  });
  if (!activation?.acceptanceId) return null;
  const existing = await prisma.startAttestation.findFirst({
    where: { acceptanceId: activation.acceptanceId },
    orderBy: { createdAt: 'desc' },
  });
  if (!existing) return null;
  const [lifecycle, attestationAudit] = await Promise.all([
    prisma.auditEvent.findFirst({
      where: { type: 'START_RECORDED', referenceId: applicationId, organizationId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.auditEvent.findFirst({
      where: { type: 'START_ATTESTED', referenceId: existing.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
  ]);
  if (!lifecycle || !attestationAudit) {
    throw conflict('The existing start record is incomplete and requires review.', 'START_RECORD_INCOMPLETE');
  }
  return {
    state: 'started',
    duplicate: true,
    applicationId,
    organizationId,
    attestation: existing,
    lifecycleAuditEventId: lifecycle.id,
    attestationAuditEventId: attestationAudit.id,
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
        data: { activationState: 'started' },
      });
      if (advanced.count !== 1) throw conflict('The start state changed; reload the case.', 'START_STATE_CONFLICT');

      const attestation = await tx.startAttestation.create({
        data: {
          id: attestationId,
          acceptanceId: acceptance.id,
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
          type: 'START_ATTESTED',
          referenceId: attestation.id,
          clinicianId: application.npi ?? activation.clinicianNpi,
          organizationId: input.organizationId,
          hash: eventHash,
          metadata: eventPayload,
        },
      });
      const lifecycleAudit = await tx.auditEvent.create({
        data: {
          type: 'START_RECORDED',
          referenceId: input.applicationId,
          clinicianId: application.npi ?? activation.clinicianNpi,
          organizationId: input.organizationId,
          hash: eventHash,
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
    // A concurrent confirm lost the race and rolled back whole — either at the
    // conditional state advance (START_STATE_CONFLICT) or, when the winner
    // committed between this call's pre-check and its transaction read, at the
    // start_ready gate (START_NOT_READY). Re-read the winner's record: an
    // identical first day is answered idempotently; a different one is a real
    // conflict; no record at all means the original error stands.
    if (error instanceof HttpError && (error.code === 'START_STATE_CONFLICT' || error.code === 'START_NOT_READY')) {
      const raced = await existingConfirmedStart(input.applicationId, input.organizationId);
      if (raced && raced.attestation.startedAt.getTime() === input.startedAt.getTime()) return raced;
      if (!raced) throw error;
      throw conflict('A different actual first day is already confirmed.', 'START_ALREADY_CONFIRMED');
    }
    throw error;
  }
}

/**
 * Compatibility adapter for acceptance-keyed callers (the machine start lane).
 * Resolves the acceptance to its application + owning organization and runs the
 * canonical application command. Acceptances without an application binding, a
 * clinician NPI, or an employer organization fail closed — a legacy row cannot
 * manufacture a hire-to-start case.
 */
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
