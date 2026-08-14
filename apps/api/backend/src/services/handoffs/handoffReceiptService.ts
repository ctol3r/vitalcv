import { Prisma, type PrismaClient } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import {
  enqueueHireToStartOutboundEvent,
  type HireToStartOutboxWriter,
} from '../integrations/hireToStartOutbox';

export type HandoffReceiptStatus =
  | 'delivered'
  | 'failed'
  | 'rejected'
  | 'logged_only'
  | 'acknowledged';

export interface IssueHandoffReceiptInput {
  handoffId: string;
  attemptNumber: number;
  applicationId?: string | null;
  startActivationId?: string | null;
  verificationRequestId?: string | null;
  communicationEventId?: string | null;
  consentGrantId: string;
  packetId?: string | null;
  packetHash?: string | null;
  payloadHash: string;
  recipientOrganizationId?: string | null;
  recipient: string;
  purpose: string;
  channel: string;
  transportProvider?: string | null;
  providerMessageId?: string | null;
  status: HandoffReceiptStatus;
  limitation?: string | null;
  deliveredAt?: Date | null;
  acknowledgedAt?: Date | null;
  issuedAt?: Date;
  clinicianId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface HandoffReceiptRecord {
  id: string;
  handoffId: string;
  attemptNumber: number;
  receiptHash: string;
  auditEventId: string;
  status: string;
  issuedAt: Date;
}

export interface HandoffReceiptTransaction extends HireToStartOutboxWriter {
  auditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  handoffReceipt: {
    create(args: { data: Record<string, unknown> }): Promise<HandoffReceiptRecord>;
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

function canonicalReceipt(input: IssueHandoffReceiptInput, issuedAt: Date) {
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    throw new Error('attemptNumber must be a positive integer');
  }
  if (input.status === 'delivered' && !input.deliveredAt) {
    throw new Error('deliveredAt is required when status is delivered');
  }
  if (input.status === 'acknowledged' && !input.acknowledgedAt) {
    throw new Error('acknowledgedAt is required when status is acknowledged');
  }

  return {
    version: '1',
    handoffId: requireText(input.handoffId, 'handoffId'),
    attemptNumber: input.attemptNumber,
    applicationId: input.applicationId ?? null,
    startActivationId: input.startActivationId ?? null,
    verificationRequestId: input.verificationRequestId ?? null,
    communicationEventId: input.communicationEventId ?? null,
    consentGrantId: requireText(input.consentGrantId, 'consentGrantId'),
    packetId: input.packetId ?? null,
    packetHash: input.packetHash ?? null,
    payloadHash: requireText(input.payloadHash, 'payloadHash'),
    recipientOrganizationId: input.recipientOrganizationId ?? null,
    recipient: requireText(input.recipient, 'recipient'),
    purpose: requireText(input.purpose, 'purpose'),
    channel: requireText(input.channel, 'channel'),
    transportProvider: input.transportProvider ?? null,
    providerMessageId: input.providerMessageId ?? null,
    status: input.status,
    limitation: input.limitation ?? null,
    deliveredAt: input.deliveredAt?.toISOString() ?? null,
    acknowledgedAt: input.acknowledgedAt?.toISOString() ?? null,
    issuedAt: issuedAt.toISOString(),
  } as const;
}

/** Audit first, receipt second, one transaction. Delivery never implies review. */
export async function issueHandoffReceiptInTransaction(
  tx: HandoffReceiptTransaction,
  input: IssueHandoffReceiptInput,
): Promise<HandoffReceiptRecord> {
  const issuedAt = input.issuedAt ?? new Date();
  const canonical = canonicalReceipt(input, issuedAt);
  const receiptHash = sha256ForPayload(canonical);

  const audit = await tx.auditEvent.create({
    data: {
      type: 'handoff_receipt_issued',
      hash: receiptHash,
      referenceId: canonical.handoffId,
      clinicianId: input.clinicianId ?? null,
      organizationId: canonical.recipientOrganizationId,
      metadata: asJson({
        entity_type: 'handoff_receipt',
        handoff_id: canonical.handoffId,
        attempt_number: canonical.attemptNumber,
        application_id: canonical.applicationId,
        start_activation_id: canonical.startActivationId,
        verification_request_id: canonical.verificationRequestId,
        consent_grant_id: canonical.consentGrantId,
        packet_id: canonical.packetId,
        packet_hash: canonical.packetHash,
        payload_hash: canonical.payloadHash,
        recipient: canonical.recipient,
        purpose: canonical.purpose,
        channel: canonical.channel,
        status: canonical.status,
        limitation: canonical.limitation,
      }),
      createdAt: issuedAt,
    },
  });

  const receipt = await tx.handoffReceipt.create({
    data: {
      handoffId: canonical.handoffId,
      attemptNumber: canonical.attemptNumber,
      applicationId: canonical.applicationId,
      startActivationId: canonical.startActivationId,
      verificationRequestId: canonical.verificationRequestId,
      communicationEventId: canonical.communicationEventId,
      consentGrantId: canonical.consentGrantId,
      packetId: canonical.packetId,
      packetHash: canonical.packetHash,
      payloadHash: canonical.payloadHash,
      recipientOrganizationId: canonical.recipientOrganizationId,
      recipient: canonical.recipient,
      purpose: canonical.purpose,
      channel: canonical.channel,
      transportProvider: canonical.transportProvider,
      providerMessageId: canonical.providerMessageId,
      status: canonical.status,
      limitation: canonical.limitation,
      deliveredAt: input.deliveredAt ?? null,
      acknowledgedAt: input.acknowledgedAt ?? null,
      issuedAt,
      receiptHash,
      auditEventId: audit.id,
      metadata: asJson(input.metadata ?? {}),
    },
  });

  if (canonical.status === 'delivered' && canonical.applicationId && canonical.recipientOrganizationId) {
    await enqueueHireToStartOutboundEvent(tx, {
      eventType: 'HIRE_TO_START_PACKET_DELIVERED',
      applicationId: canonical.applicationId,
      organizationId: canonical.recipientOrganizationId,
      occurredAt: input.deliveredAt as Date,
      dedupeKey: `HIRE_TO_START_PACKET_DELIVERED:${canonical.applicationId}:${canonical.handoffId}:${canonical.attemptNumber}`,
      data: {
        handoffReceiptId: receipt.id,
        packetId: canonical.packetId,
        packetHash: canonical.packetHash,
        channel: canonical.channel,
        deliveryStatus: canonical.status,
        deliveryDoesNotImplyReview: true,
      },
    });
  }

  return receipt;
}

export async function issueHandoffReceipt(
  input: IssueHandoffReceiptInput,
  client: PrismaClient = prisma,
): Promise<HandoffReceiptRecord> {
  const issuedAt = input.issuedAt ?? new Date();
  const receiptHash = sha256ForPayload(canonicalReceipt(input, issuedAt));
  const existing = await client.handoffReceipt.findUnique({
    where: { receiptHash },
    select: {
      id: true,
      handoffId: true,
      attemptNumber: true,
      receiptHash: true,
      auditEventId: true,
      status: true,
      issuedAt: true,
    },
  });
  if (existing) return existing;

  try {
    return await client.$transaction((tx) => issueHandoffReceiptInTransaction(
      tx as unknown as HandoffReceiptTransaction,
      { ...input, issuedAt },
    ));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await client.handoffReceipt.findUnique({
        where: { receiptHash },
        select: {
          id: true,
          handoffId: true,
          attemptNumber: true,
          receiptHash: true,
          auditEventId: true,
          status: true,
          issuedAt: true,
        },
      });
      if (raced) return raced;
    }
    throw error;
  }
}
