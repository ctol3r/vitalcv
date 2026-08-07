import type { PrismaClient } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { decideEmployerActionRbac } from '../authz/employerActionRbac';
import { HttpError } from '../../utils/httpError';

export interface EmployerHandoffReceiptView {
  id: string;
  handoffId: string;
  attemptNumber: number;
  channel: string;
  status: string;
  transportProvider: string | null;
  providerMessageId: string | null;
  limitation: string | null;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  issuedAt: string;
  receiptHash: string;
}

export interface EmployerApplicationHandoffView {
  applicationId: string;
  opportunity: {
    id: string;
    title: string;
    organizationId: string;
  };
  packet: {
    id: string;
    version: number;
    hash: string;
    consentGrantId: string | null;
    purpose: string;
    recipient: string;
    createdAt: string;
  } | null;
  handoffId: string | null;
  deliveryState: 'not_recorded' | 'logged_only' | 'delivered' | 'acknowledged' | 'failed';
  receipts: EmployerHandoffReceiptView[];
  notice: string;
}

function notFound(): HttpError {
  return new HttpError(404, 'Handoff receipt not found.');
}

async function requireEmployerOrganization(
  clerkUserId: string,
  client: PrismaClient,
): Promise<string> {
  const actor = await client.user.findUnique({ where: { clerkUserId } });
  const decision = decideEmployerActionRbac(actor);
  if (!decision.allowed || !actor?.organizationId) throw notFound();
  return actor.organizationId;
}

function receiptView(receipt: {
  id: string;
  handoffId: string;
  attemptNumber: number;
  channel: string;
  status: string;
  transportProvider: string | null;
  providerMessageId: string | null;
  limitation: string | null;
  deliveredAt: Date | null;
  acknowledgedAt: Date | null;
  issuedAt: Date;
  receiptHash: string;
}): EmployerHandoffReceiptView {
  return {
    id: receipt.id,
    handoffId: receipt.handoffId,
    attemptNumber: receipt.attemptNumber,
    channel: receipt.channel,
    status: receipt.status,
    transportProvider: receipt.transportProvider,
    providerMessageId: receipt.providerMessageId,
    limitation: receipt.limitation,
    deliveredAt: receipt.deliveredAt?.toISOString() ?? null,
    acknowledgedAt: receipt.acknowledgedAt?.toISOString() ?? null,
    issuedAt: receipt.issuedAt.toISOString(),
    receiptHash: receipt.receiptHash,
  };
}

function deliveryState(receipts: readonly EmployerHandoffReceiptView[]): EmployerApplicationHandoffView['deliveryState'] {
  if (receipts.some((receipt) => receipt.status === 'acknowledged')) return 'acknowledged';
  if (receipts.some((receipt) => receipt.status === 'delivered')) return 'delivered';
  if (receipts.some((receipt) => receipt.status === 'logged_only')) return 'logged_only';
  if (receipts.some((receipt) => receipt.status === 'failed' || receipt.status === 'rejected')) return 'failed';
  return 'not_recorded';
}

export async function readApplicationHandoffForEmployer(
  applicationId: string,
  clerkUserId: string,
  client: PrismaClient = prisma,
): Promise<EmployerApplicationHandoffView> {
  const organizationId = await requireEmployerOrganization(clerkUserId, client);
  const application = await client.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      sealedPacketVersion: true,
      opportunity: { select: { id: true, title: true, organizationId: true } },
    },
  });
  if (!application || application.opportunity.organizationId !== organizationId) throw notFound();

  const packet = application.sealedPacketVersion === null
    ? null
    : await client.applicationPacket.findUnique({
        where: {
          applicationId_packetVersion: {
            applicationId: application.id,
            packetVersion: application.sealedPacketVersion,
          },
        },
        select: {
          id: true,
          packetVersion: true,
          packetHash: true,
          consentGrantId: true,
          purpose: true,
          recipient: true,
          createdAt: true,
        },
      });

  const storedReceipts = await client.handoffReceipt.findMany({
    where: { applicationId: application.id },
    orderBy: [{ issuedAt: 'asc' }, { attemptNumber: 'asc' }],
    select: {
      id: true,
      handoffId: true,
      attemptNumber: true,
      channel: true,
      status: true,
      transportProvider: true,
      providerMessageId: true,
      limitation: true,
      deliveredAt: true,
      acknowledgedAt: true,
      issuedAt: true,
      receiptHash: true,
    },
  });
  const receipts = storedReceipts.map(receiptView);

  return {
    applicationId: application.id,
    opportunity: application.opportunity,
    packet: packet
      ? {
          id: packet.id,
          version: packet.packetVersion,
          hash: packet.packetHash,
          consentGrantId: packet.consentGrantId,
          purpose: packet.purpose,
          recipient: packet.recipient,
          createdAt: packet.createdAt.toISOString(),
        }
      : null,
    handoffId: receipts[0]?.handoffId ?? null,
    deliveryState: deliveryState(receipts),
    receipts,
    notice: 'A handoff receipt records VitalCV transport activity. It does not mean the employer reviewed, accepted, credentialed, privileged, or cleared the clinician to start.',
  };
}

export async function readHandoffReceiptsForEmployer(
  handoffId: string,
  clerkUserId: string,
  client: PrismaClient = prisma,
): Promise<EmployerApplicationHandoffView> {
  const first = await client.handoffReceipt.findFirst({
    where: { handoffId },
    select: { applicationId: true },
  });
  if (!first?.applicationId) throw notFound();
  const view = await readApplicationHandoffForEmployer(first.applicationId, clerkUserId, client);
  if (view.handoffId !== handoffId && !view.receipts.some((receipt) => receipt.handoffId === handoffId)) {
    throw notFound();
  }
  return {
    ...view,
    handoffId,
    receipts: view.receipts.filter((receipt) => receipt.handoffId === handoffId),
  };
}
