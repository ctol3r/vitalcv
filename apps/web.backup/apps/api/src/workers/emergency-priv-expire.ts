import cron from 'node-cron';
import { PrismaClient, type Prisma } from '@prisma/client';
import { anchorEvent } from '../services/audit/anchor';

const prisma = new PrismaClient();

const DEFAULT_CRON = process.env.EMERGENCY_PRIVILEGE_EXPIRE_CRON?.trim() || '*/15 * * * *';
const DEFAULT_LIMIT = Number(process.env.EMERGENCY_PRIVILEGE_EXPIRE_BATCH ?? 25);

let scheduledTask: cron.ScheduledTask | null = null;

export function startEmergencyPrivilegeExpiryWorker(): cron.ScheduledTask {
  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const revoked = await runEmergencyPrivilegeExpiryBatch();
      if (revoked > 0) {
        console.info('[workers][emergency privileges] revoked expired privileges', { revoked });
      }
    } catch (error) {
      console.error('[workers][emergency privileges] batch failed', error);
    }
  });

  return scheduledTask;
}

export interface EmergencyExpiryOptions {
  limit?: number;
  now?: Date;
}

export async function runEmergencyPrivilegeExpiryBatch(
  options: EmergencyExpiryOptions = {},
): Promise<number> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const boundary = options.now ?? new Date();

  const candidates = await prisma.emergencyPrivilege.findMany({
    where: {
      revokedAt: null,
      expiresAt: { lte: boundary },
    },
    orderBy: { expiresAt: 'asc' },
    take: limit,
  });

  if (candidates.length === 0) {
    return 0;
  }

  for (const privilege of candidates) {
    await prisma.emergencyPrivilege.update({
      where: { id: privilege.id },
      data: {
        revokedAt: boundary,
        metadata: updateMetadata(privilege.metadata, {
          revokedBy: 'expiry_worker',
          revocationReason: 'expired',
        }),
      },
    });

    anchorEvent('privilegeEmergencyRevoked', {
      privilegeId: privilege.id,
      clinicianId: privilege.clinicianId,
      orgId: privilege.orgId,
      reason: 'expired',
      revokedAt: boundary.toISOString(),
    });
  }

  return candidates.length;
}

function updateMetadata(
  existing: Prisma.JsonValue | null,
  overlay: Record<string, unknown>,
): Prisma.JsonValue {
  const base = typeof existing === 'object' && existing !== null ? existing : {};
  return {
    ...base,
    ...overlay,
  };
}











