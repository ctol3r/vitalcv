/**
 * Vendor-neutral hire-to-start integration inbox.
 *
 * The signed envelope is organization-bound and replay-safe. Its two initial
 * commands can map an external object or update an operational requirement.
 * Neither command writes ApplicationPacket, evidence, credentialing approval,
 * privileging state, or any source-backed claim.
 */
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';

import prisma from '../../graphql/prisma_client';
import { HttpError } from '../../utils/httpError';
import { hmacSha256Hex, sha256ForPayload } from '../../utils/deterministic';
import { canTransition, type ActivationRequirementStatus } from '../activation/requirementLifecycle';
import { enqueueHireToStartOutboundEvent } from './hireToStartOutbox';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SIGNATURE_WINDOW_SECONDS = 300;
const REQUIREMENT_STATUSES = new Set<ActivationRequirementStatus>([
  'not_started', 'requested', 'submitted', 'under_review', 'met', 'waived',
  'not_applicable', 'blocked', 'expired',
]);

export type HireToStartInboundEvent =
  | {
      version: '1';
      organizationId: string;
      sourceSystem: string;
      externalEventId: string;
      eventType: 'application.external_reference.upserted';
      applicationId: string;
      occurredAt: string;
      data: { objectType: string; externalIdentifier: string };
    }
  | {
      version: '1';
      organizationId: string;
      sourceSystem: string;
      externalEventId: string;
      eventType: 'requirement.status_changed';
      applicationId: string;
      occurredAt: string;
      data: {
        requirementId: string;
        status: ActivationRequirementStatus;
        objectType: string;
        externalIdentifier: string;
        limitation: string;
      };
    };

export interface IntegrationSignatureHeaders {
  keyId: string;
  timestamp: string;
  signature: string;
}

export type IntegrationProcessingResult = {
  receiptId: string;
  state: 'PROCESSED' | 'IGNORED' | 'FAILED';
  duplicate: boolean;
  payloadHash: string;
  reason: string | null;
};

function requireBoundedText(value: unknown, field: string, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new HttpError(400, `${field} is required and must be at most ${max} characters.`);
  return text;
}

function requireToken(value: unknown, field: string): string {
  const token = requireBoundedText(value, field, 128);
  if (!TOKEN_RE.test(token)) throw new HttpError(400, `${field} contains unsupported characters.`);
  return token;
}

function requireUuid(value: unknown, field: string): string {
  const id = requireBoundedText(value, field, 36);
  if (!UUID_RE.test(id)) throw new HttpError(400, `${field} must be a UUID.`);
  return id;
}

function requireObservedAt(value: unknown): string {
  const text = requireBoundedText(value, 'occurredAt', 64);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, 'occurredAt must be a valid ISO timestamp.');
  return parsed.toISOString();
}

/** Strict allowlist: arbitrary vendor payload fields (including PHI) are dropped. */
export function parseHireToStartInboundEvent(value: unknown): HireToStartInboundEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'A JSON event object is required.');
  }
  const raw = value as Record<string, unknown>;
  if (raw.version !== '1') throw new HttpError(400, 'version must be 1.');
  const organizationId = requireUuid(raw.organizationId, 'organizationId');
  const applicationId = requireUuid(raw.applicationId, 'applicationId');
  const sourceSystem = requireToken(raw.sourceSystem, 'sourceSystem');
  const externalEventId = requireToken(raw.externalEventId, 'externalEventId');
  const occurredAt = requireObservedAt(raw.occurredAt);
  const data = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data as Record<string, unknown>
    : {};

  if (raw.eventType === 'application.external_reference.upserted') {
    return {
      version: '1', organizationId, sourceSystem, externalEventId,
      eventType: raw.eventType, applicationId, occurredAt,
      data: {
        objectType: requireToken(data.objectType, 'data.objectType'),
        externalIdentifier: requireBoundedText(data.externalIdentifier, 'data.externalIdentifier'),
      },
    };
  }
  if (raw.eventType === 'requirement.status_changed') {
    const status = requireToken(data.status, 'data.status') as ActivationRequirementStatus;
    if (!REQUIREMENT_STATUSES.has(status)) throw new HttpError(400, 'data.status is not a supported requirement status.');
    return {
      version: '1', organizationId, sourceSystem, externalEventId,
      eventType: raw.eventType, applicationId, occurredAt,
      data: {
        requirementId: requireUuid(data.requirementId, 'data.requirementId'),
        status,
        objectType: requireToken(data.objectType, 'data.objectType'),
        externalIdentifier: requireBoundedText(data.externalIdentifier, 'data.externalIdentifier'),
        limitation: requireBoundedText(data.limitation, 'data.limitation', 500),
      },
    };
  }
  throw new HttpError(400, 'eventType is not supported.');
}

export function hireToStartIntegrationSigningContent(timestamp: string, payloadHash: string): string {
  return `v1.${timestamp}.${payloadHash}`;
}

export function buildHireToStartIntegrationSignature(
  event: HireToStartInboundEvent,
  timestamp: string,
  secret: string,
): string {
  return `v1=${hmacSha256Hex(hireToStartIntegrationSigningContent(timestamp, sha256ForPayload(event)), secret)}`;
}

function signatureMatches(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

async function authenticate(
  event: HireToStartInboundEvent,
  headers: IntegrationSignatureHeaders,
  now: Date,
): Promise<{ payloadHash: string; keyId: string }> {
  const keyId = requireUuid(headers.keyId, 'x-vitalcv-key-id');
  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isInteger(timestampSeconds)) throw new HttpError(401, 'Invalid integration signature.');
  const age = Math.abs(Math.floor(now.getTime() / 1000) - timestampSeconds);
  if (age > SIGNATURE_WINDOW_SECONDS) throw new HttpError(401, 'Integration signature timestamp is outside the allowed window.');

  const config = await prisma.employerWebhookConfig.findFirst({
    where: {
      id: keyId,
      employerId: event.organizationId,
      eventType: 'HIRE_TO_START_INBOUND',
      isActive: true,
    },
    select: { id: true, secret: true },
  });
  if (!config?.secret) throw new HttpError(401, 'Invalid integration signature.');

  const payloadHash = sha256ForPayload(event);
  const expected = `v1=${hmacSha256Hex(hireToStartIntegrationSigningContent(headers.timestamp, payloadHash), config.secret)}`;
  if (!signatureMatches(headers.signature, expected)) throw new HttpError(401, 'Invalid integration signature.');
  return { payloadHash, keyId: config.id };
}

function receiptWhere(event: HireToStartInboundEvent) {
  return {
    organizationId_sourceSystem_externalEventId: {
      organizationId: event.organizationId,
      sourceSystem: event.sourceSystem,
      externalEventId: event.externalEventId,
    },
  } as const;
}

async function duplicateResult(event: HireToStartInboundEvent, payloadHash: string): Promise<IntegrationProcessingResult | null> {
  const existing = await prisma.integrationInboxEvent.findUnique({ where: receiptWhere(event) });
  if (!existing) return null;
  if (existing.payloadHash !== payloadHash) {
    throw new HttpError(409, 'The external event id was already used with different content.');
  }
  return {
    receiptId: existing.id,
    state: existing.processingState as IntegrationProcessingResult['state'],
    duplicate: true,
    payloadHash,
    reason: existing.processingError,
  };
}

export async function receiveHireToStartIntegrationEvent(
  raw: unknown,
  headers: IntegrationSignatureHeaders,
  now = new Date(),
): Promise<IntegrationProcessingResult> {
  const event = parseHireToStartInboundEvent(raw);
  const { payloadHash, keyId } = await authenticate(event, headers, now);
  const duplicate = await duplicateResult(event, payloadHash);
  if (duplicate) return duplicate;
  const occurredAt = new Date(event.occurredAt);

  try {
    return await prisma.$transaction(async (tx) => {
      const application = await tx.application.findFirst({
        where: { id: event.applicationId, opportunity: { organizationId: event.organizationId } },
        select: { id: true },
      });
      const receipt = await tx.integrationInboxEvent.create({
        data: {
          organizationId: event.organizationId,
          applicationId: application?.id ?? null,
          sourceSystem: event.sourceSystem,
          externalEventId: event.externalEventId,
          eventType: event.eventType,
          payload: event.data as Prisma.InputJsonValue,
          payloadHash,
          signatureKeyId: keyId,
          occurredAt,
          receivedAt: now,
        },
      });

      if (!application) {
        await tx.integrationInboxEvent.update({
          where: { id: receipt.id },
          data: { processingState: 'FAILED', processedAt: now, processingError: 'application_not_found' },
        });
        return { receiptId: receipt.id, state: 'FAILED', duplicate: false, payloadHash, reason: 'application_not_found' };
      }

      if (event.eventType === 'application.external_reference.upserted') {
        const conflict = await tx.applicationExternalReference.findFirst({
          where: {
            organizationId: event.organizationId,
            sourceSystem: event.sourceSystem,
            objectType: event.data.objectType,
            externalIdentifier: event.data.externalIdentifier,
            NOT: { applicationId: event.applicationId },
          },
          select: { id: true },
        });
        if (conflict) {
          await tx.integrationInboxEvent.update({
            where: { id: receipt.id },
            data: { processingState: 'FAILED', processedAt: now, processingError: 'external_reference_conflict' },
          });
          return { receiptId: receipt.id, state: 'FAILED', duplicate: false, payloadHash, reason: 'external_reference_conflict' };
        }

        const existing = await tx.applicationExternalReference.findFirst({
          where: {
            applicationId: event.applicationId,
            organizationId: event.organizationId,
            sourceSystem: event.sourceSystem,
            objectType: event.data.objectType,
          },
        });
        if (existing?.lastObservedAt && occurredAt <= existing.lastObservedAt) {
          await tx.integrationInboxEvent.update({
            where: { id: receipt.id },
            data: { processingState: 'IGNORED', processedAt: now, processingError: 'out_of_order' },
          });
          return { receiptId: receipt.id, state: 'IGNORED', duplicate: false, payloadHash, reason: 'out_of_order' };
        }

        if (existing) {
          await tx.applicationExternalReference.update({
            where: { id: existing.id },
            data: { externalIdentifier: event.data.externalIdentifier, lastObservedAt: occurredAt },
          });
        } else {
          await tx.applicationExternalReference.create({
            data: {
              applicationId: event.applicationId,
              organizationId: event.organizationId,
              sourceSystem: event.sourceSystem,
              objectType: event.data.objectType,
              externalIdentifier: event.data.externalIdentifier,
              firstObservedAt: occurredAt,
              lastObservedAt: occurredAt,
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            type: 'INTEGRATION_EXTERNAL_REFERENCE_RECORDED',
            hash: payloadHash,
            referenceId: event.applicationId,
            organizationId: event.organizationId,
            metadata: {
              sourceSystem: event.sourceSystem,
              externalEventId: event.externalEventId,
              objectType: event.data.objectType,
              externalIdentifier: event.data.externalIdentifier,
            },
          },
        });
        await tx.integrationInboxEvent.update({
          where: { id: receipt.id },
          data: { processingState: 'PROCESSED', processedAt: now },
        });
        return { receiptId: receipt.id, state: 'PROCESSED', duplicate: false, payloadHash, reason: null };
      }

      const requirement = await tx.activationRequirement.findFirst({
        where: {
          id: event.data.requirementId,
          applicationId: event.applicationId,
          organizationId: event.organizationId,
        },
      });
      if (!requirement) {
        await tx.integrationInboxEvent.update({
          where: { id: receipt.id },
          data: { processingState: 'FAILED', processedAt: now, processingError: 'requirement_not_found' },
        });
        return { receiptId: receipt.id, state: 'FAILED', duplicate: false, payloadHash, reason: 'requirement_not_found' };
      }
      if (requirement.externalObservedAt && occurredAt <= requirement.externalObservedAt) {
        await tx.integrationInboxEvent.update({
          where: { id: receipt.id },
          data: { processingState: 'IGNORED', processedAt: now, processingError: 'out_of_order' },
        });
        return { receiptId: receipt.id, state: 'IGNORED', duplicate: false, payloadHash, reason: 'out_of_order' };
      }

      const priorStatus = requirement.status as ActivationRequirementStatus;
      if (priorStatus !== event.data.status && !canTransition(priorStatus, event.data.status)) {
        await tx.integrationInboxEvent.update({
          where: { id: receipt.id },
          data: { processingState: 'FAILED', processedAt: now, processingError: 'invalid_requirement_transition' },
        });
        return { receiptId: receipt.id, state: 'FAILED', duplicate: false, payloadHash, reason: 'invalid_requirement_transition' };
      }

      await tx.activationRequirement.update({
        where: { id: requirement.id },
        data: {
          status: event.data.status,
          externalSourceSystem: event.sourceSystem,
          externalObjectType: event.data.objectType,
          externalIdentifier: event.data.externalIdentifier,
          externalObservedAt: occurredAt,
          externalLimitation: event.data.limitation,
          resolvedBy: ['met', 'waived', 'not_applicable'].includes(event.data.status)
            ? `integration:${event.sourceSystem}`
            : null,
          resolvedAt: ['met', 'waived', 'not_applicable'].includes(event.data.status) ? occurredAt : null,
        },
      });
      await tx.auditEvent.create({
        data: {
          type: 'INTEGRATION_REQUIREMENT_STATUS_RECORDED',
          hash: payloadHash,
          referenceId: requirement.id,
          organizationId: event.organizationId,
          metadata: {
            applicationId: event.applicationId,
            priorStatus,
            nextStatus: event.data.status,
            sourceSystem: event.sourceSystem,
            externalEventId: event.externalEventId,
            externalObjectType: event.data.objectType,
            externalIdentifier: event.data.externalIdentifier,
            limitation: event.data.limitation,
            createsSourceBackedEvidence: false,
            institutionReviewRemains: true,
          },
        },
      });
      const outbox = await enqueueHireToStartOutboundEvent(tx, {
        eventType: 'HIRE_TO_START_REQUIREMENT_CHANGED',
        applicationId: event.applicationId,
        organizationId: event.organizationId,
        occurredAt,
        dedupeKey: `HIRE_TO_START_REQUIREMENT_CHANGED:${requirement.id}:${event.externalEventId}`,
        data: {
          requirementId: requirement.id,
          priorStatus,
          status: event.data.status,
          owner: requirement.owner,
          sourceSystem: event.sourceSystem,
          limitation: event.data.limitation,
          createsSourceBackedEvidence: false,
        },
      });
      await tx.integrationInboxEvent.update({
        where: { id: receipt.id },
        data: { processingState: 'PROCESSED', processedAt: now, outboxEventId: outbox.id },
      });
      return { receiptId: receipt.id, state: 'PROCESSED', duplicate: false, payloadHash, reason: null };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await duplicateResult(event, payloadHash);
      if (raced) return raced;
    }
    throw error;
  }
}
