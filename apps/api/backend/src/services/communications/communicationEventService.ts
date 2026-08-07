import { Prisma, type PrismaClient } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';

export type CommunicationDirection = 'outbound' | 'inbound' | 'internal';
export type CommunicationChannel =
  | 'email'
  | 'fax'
  | 'secure_message'
  | 'phone'
  | 'voicemail'
  | 'webhook'
  | 'portal';

export interface AppendCommunicationEventInput {
  startActivationId?: string | null;
  applicationId?: string | null;
  verificationRequestId?: string | null;
  activationRequirementId?: string | null;
  organizationId?: string | null;
  clinicianId?: string | null;
  issuerId?: string | null;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  eventType: string;
  status: string;
  senderRef?: string | null;
  recipientRef?: string | null;
  providerMessageId?: string | null;
  threadKey?: string | null;
  subject?: string | null;
  redactedSummary?: string | null;
  contentHash?: string | null;
  encryptedContentRef?: string | null;
  attachmentRefs?: readonly unknown[];
  consentGrantId?: string | null;
  occurredAt?: Date;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface CommunicationEventRecord {
  id: string;
  auditEventId: string;
  channel: string;
  providerMessageId: string | null;
  occurredAt: Date;
}

export interface CommunicationEventTransaction {
  auditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  communicationEvent: {
    create(args: { data: Record<string, unknown> }): Promise<CommunicationEventRecord>;
  };
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function canonicalEvent(input: AppendCommunicationEventInput, occurredAt: Date) {
  return {
    version: '1',
    startActivationId: input.startActivationId ?? null,
    applicationId: input.applicationId ?? null,
    verificationRequestId: input.verificationRequestId ?? null,
    activationRequirementId: input.activationRequirementId ?? null,
    organizationId: input.organizationId ?? null,
    clinicianId: input.clinicianId ?? null,
    issuerId: input.issuerId ?? null,
    direction: input.direction,
    channel: input.channel,
    eventType: requireText(input.eventType, 'eventType'),
    status: requireText(input.status, 'status'),
    senderRef: input.senderRef ?? null,
    recipientRef: input.recipientRef ?? null,
    providerMessageId: input.providerMessageId ?? null,
    threadKey: input.threadKey ?? null,
    subject: input.subject ?? null,
    redactedSummary: input.redactedSummary ?? null,
    contentHash: input.contentHash ?? null,
    encryptedContentRef: input.encryptedContentRef ?? null,
    attachmentRefs: input.attachmentRefs ?? [],
    consentGrantId: input.consentGrantId ?? null,
    occurredAt: occurredAt.toISOString(),
  } as const;
}

/** Append-only and audit-first inside a single transaction. */
export async function appendCommunicationEventInTransaction(
  tx: CommunicationEventTransaction,
  input: AppendCommunicationEventInput,
): Promise<CommunicationEventRecord> {
  const occurredAt = input.occurredAt ?? new Date();
  const canonical = canonicalEvent(input, occurredAt);
  const eventHash = sha256ForPayload(canonical);

  const audit = await tx.auditEvent.create({
    data: {
      type: 'communication_event_appended',
      hash: eventHash,
      referenceId: canonical.verificationRequestId
        ?? canonical.startActivationId
        ?? canonical.applicationId
        ?? eventHash,
      clinicianId: canonical.clinicianId,
      organizationId: canonical.organizationId,
      metadata: asJson({
        entity_type: 'communication_event',
        direction: canonical.direction,
        channel: canonical.channel,
        event_type: canonical.eventType,
        status: canonical.status,
        provider_message_id: canonical.providerMessageId,
        verification_request_id: canonical.verificationRequestId,
        consent_grant_id: canonical.consentGrantId,
      }),
      createdAt: occurredAt,
    },
  });

  return tx.communicationEvent.create({
    data: {
      startActivationId: canonical.startActivationId,
      applicationId: canonical.applicationId,
      verificationRequestId: canonical.verificationRequestId,
      activationRequirementId: canonical.activationRequirementId,
      organizationId: canonical.organizationId,
      clinicianId: canonical.clinicianId,
      issuerId: canonical.issuerId,
      direction: canonical.direction,
      channel: canonical.channel,
      eventType: canonical.eventType,
      status: canonical.status,
      senderRef: canonical.senderRef,
      recipientRef: canonical.recipientRef,
      providerMessageId: canonical.providerMessageId,
      threadKey: canonical.threadKey,
      subject: canonical.subject,
      redactedSummary: canonical.redactedSummary,
      contentHash: canonical.contentHash,
      encryptedContentRef: canonical.encryptedContentRef,
      attachmentRefs: asJson(canonical.attachmentRefs),
      consentGrantId: canonical.consentGrantId,
      occurredAt,
      auditEventId: audit.id,
      metadata: asJson(input.metadata ?? {}),
    },
  });
}

export async function appendCommunicationEvent(
  input: AppendCommunicationEventInput,
  client: PrismaClient = prisma,
): Promise<CommunicationEventRecord> {
  if (input.providerMessageId) {
    const existing = await client.communicationEvent.findFirst({
      where: { channel: input.channel, providerMessageId: input.providerMessageId },
      select: { id: true, auditEventId: true, channel: true, providerMessageId: true, occurredAt: true },
    });
    if (existing) return existing;
  }

  try {
    return await client.$transaction((tx) => appendCommunicationEventInTransaction(
      tx as unknown as CommunicationEventTransaction,
      input,
    ));
  } catch (error) {
    if (
      input.providerMessageId
      && error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      const raced = await client.communicationEvent.findFirst({
        where: { channel: input.channel, providerMessageId: input.providerMessageId },
        select: { id: true, auditEventId: true, channel: true, providerMessageId: true, occurredAt: true },
      });
      if (raced) return raced;
    }
    throw error;
  }
}
