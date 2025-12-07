/**
 * B162C-MULTI-007: Audit events for organization switches
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface OrgSwitchEventPayload {
  userId: string;
  oldOrgId?: string | null;
  newOrgId: string;
  metadata?: Record<string, any>;
}

export async function logOrgSwitchEvent(event: OrgSwitchEventPayload) {
  const timestamp = new Date().toISOString();
  const payload = {
    userId: event.userId,
    oldOrgId: event.oldOrgId || null,
    newOrgId: event.newOrgId,
    metadata: event.metadata || null,
    timestamp,
  };

  const anchoredHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: 'ORG_SWITCH',
      userId: event.userId,
      data: {
        ...payload,
        anchoredHash,
      },
    },
  });

  const anchoredTx = await simulateAnchor(anchoredHash);

  await prisma.auditEvent.update({
    where: { id: auditEvent.id },
    data: {
      data: {
        ...(auditEvent.data as Record<string, any>),
        anchoredTx,
      },
    },
  });

  return auditEvent;
}

export async function getOrgSwitchEvents(
  userId: string,
  limit: number = 50
) {
  return prisma.auditEvent.findMany({
    where: {
      type: 'ORG_SWITCH',
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

async function simulateAnchor(hash: string) {
  return `0x${hash.substring(0, 32)}`;
}
