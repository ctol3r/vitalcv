import type { PrismaClient } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';
import { getServiceLogger } from '../logging/serviceLogger.js';
import type { DriftSignalType, DriftSeverity } from '../drift/types.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('privileging/drift');

type PrismaLike = Pick<
  PrismaClient,
  'privilegeGranted' | 'fPPECase' | 'privilegeRenewal'
>;

export interface PrivilegeDriftActionInput {
  type: DriftSignalType;
  severity: DriftSeverity;
  privilegeGrantedId?: string;
  clinicianDid: string;
  orgId?: string;
  detectedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PrivilegeDriftActionResult {
  privilegeGrantedId: string;
  actions: string[];
}

const CRITICAL_TYPES: DriftSignalType[] = [
  'PRIVILEGE_EXPIRED',
  'PRIVILEGE_FPPE_FAILED',
  'PRIVILEGE_RENEWAL_OVERDUE',
];

function getClient(client?: PrismaLike): PrismaLike {
  return client ?? prisma;
}

export async function respondToPrivilegeDrift(
  input: PrivilegeDriftActionInput,
  options: { prisma?: PrismaLike } = {}
): Promise<PrivilegeDriftActionResult | null> {
  if (!CRITICAL_TYPES.includes(input.type) || input.severity !== 'critical') {
    return null;
  }

  const client = getClient(options.prisma);
  const detectedAt = input.detectedAt ?? new Date();

  const privilege = await client.privilegeGranted.findFirst({
    where: {
      ...(input.privilegeGrantedId ? { id: input.privilegeGrantedId } : {}),
      ...(input.privilegeGrantedId
        ? {}
        : {
            clinicianDid: input.clinicianDid,
            ...(input.orgId ? { orgId: input.orgId } : {}),
          }),
    },
  });

  if (!privilege) {
    log.warn('[PrivilegeDrift] Unable to locate privilege grant', {
      clinicianDid: input.clinicianDid,
      privilegeGrantedId: input.privilegeGrantedId,
      type: input.type,
    });
    return null;
  }

  const actions: string[] = [];

  if (input.type === 'PRIVILEGE_EXPIRED') {
    await client.privilegeGranted.update({
      where: { id: privilege.id },
      data: {
        status: 'HOLD',
        revocationReason: 'Drift orchestrator hold',
        updatedAt: detectedAt,
      },
    });
    actions.push('privilege_hold');
  }

  if (input.type === 'PRIVILEGE_FPPE_FAILED') {
    await restartFppeForPrivilege(client, privilege.id, privilege, detectedAt);
    actions.push('fppe_restart');
  }

  if (input.type === 'PRIVILEGE_RENEWAL_OVERDUE') {
    await flagRenewalForReview(client, privilege.id, detectedAt);
    actions.push('renewal_reconsideration');
  }

  if (!actions.length) {
    return null;
  }

  log.info('[PrivilegeDrift] Applied mitigation', {
    privilegeGrantedId: privilege.id,
    clinicianDid: privilege.clinicianDid,
    actions,
  });

  return {
    privilegeGrantedId: privilege.id,
    actions,
  };
}

async function restartFppeForPrivilege(
  client: PrismaLike,
  privilegeGrantedId: string,
  privilege: { clinicianDid: string; orgId: string; privilegeSetId: string },
  detectedAt: Date
) {
  await client.fPPECase.updateMany({
    where: {
      privilegeGrantedId,
      status: { in: ['OPEN', 'IN_REVIEW'] },
    },
    data: {
      status: 'FAILED',
      completedAt: detectedAt,
    },
  });

  await client.fPPECase.create({
    data: {
      privilegeGrantedId,
      clinicianId: privilege.clinicianDid,
      orgId: privilege.orgId,
      privilegeCode: privilege.privilegeSetId,
      startAt: detectedAt,
      dueAt: addDays(detectedAt, 30),
      status: 'OPEN',
      notes: 'Restarted via drift orchestrator',
    },
  });

  await client.privilegeGranted.update({
    where: { id: privilegeGrantedId },
    data: {
      fppeStatus: 'IN_REVIEW',
      updatedAt: detectedAt,
    },
  });
}

async function flagRenewalForReview(
  client: PrismaLike,
  privilegeGrantedId: string,
  detectedAt: Date
) {
  const existing = await client.privilegeRenewal.findFirst({
    where: {
      privilegeGrantedId,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    orderBy: { dueDate: 'desc' },
  });

  if (existing) {
    await client.privilegeRenewal.update({
      where: { id: existing.id },
      data: {
        status: 'OVERDUE',
        dueDate: existing.dueDate ?? detectedAt,
        lastNotifiedAt: detectedAt,
        notificationsSent: (existing.notificationsSent ?? 0) + 1,
      },
    });
    return;
  }

  await client.privilegeRenewal.create({
    data: {
      privilegeGrantedId,
      dueDate: detectedAt,
      status: 'OVERDUE',
      lastNotifiedAt: detectedAt,
      notificationsSent: 1,
    },
  });
}

