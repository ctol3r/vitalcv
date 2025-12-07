/**
 * B141D-FF-003: Audit events for flag changes
 *
 * Every flag change emits an audit event with:
 * - flagKey: The flag that was changed
 * - scope: 'GLOBAL', 'ORG', or 'USER'
 * - oldValue: Previous value (null if new)
 * - newValue: New value (null if deleted)
 * - actorId: User who made the change
 *
 * Events are anchored to blockchain for tamper-proof audit trail
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export interface FlagChangeEvent {
  flagKey: string;
  scope: 'GLOBAL' | 'ORG' | 'USER';
  orgId?: string;
  userId?: string;
  oldValue: any;
  newValue: any;
  actorId: string;
  actorName?: string;
}

/**
 * Record a flag change event
 */
export async function recordFlagChange(event: FlagChangeEvent) {
  // Generate hash for anchoring
  const eventData = {
    flagKey: event.flagKey,
    scope: event.scope,
    orgId: event.orgId || null,
    userId: event.userId || null,
    oldValue: event.oldValue,
    newValue: event.newValue,
    actorId: event.actorId,
    timestamp: new Date().toISOString(),
  };

  const anchoredHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(eventData))
    .digest('hex');

  // Create audit event in AuditEvent table
  const auditEvent = await prisma.auditEvent.create({
    data: {
      type: 'FLAG_CHANGED',
      userId: event.actorId,
      data: {
        flagKey: event.flagKey,
        scope: event.scope,
        orgId: event.orgId,
        userId: event.userId,
        oldValue: event.oldValue,
        newValue: event.newValue,
        actorId: event.actorId,
        actorName: event.actorName,
        anchoredHash,
      },
    },
  });

  // In production, anchor hash to blockchain
  // For now, we'll use a simulated transaction hash
  const anchoredTx = await simulateBlockchainAnchor(anchoredHash);

  // Update audit event with transaction hash
  await prisma.auditEvent.update({
    where: { id: auditEvent.id },
    data: {
      data: {
        ...(auditEvent.data as any),
        anchoredTx,
      },
    },
  });

  // Also create a SettingsAuditEvent for consistency with other settings changes
  await prisma.settingsAuditEvent.create({
    data: {
      orgId: event.orgId || 'GLOBAL',
      resourceType: 'FeatureFlag',
      resourceId: event.flagKey,
      action: event.oldValue === null ? 'FLAG_OVERRIDE_CREATED' :
              event.newValue === null ? 'FLAG_OVERRIDE_DELETED' :
              'FLAG_OVERRIDE_UPDATED',
      actorId: event.actorId,
      actorName: event.actorName,
      before: event.oldValue !== null ? { value: event.oldValue } : null,
      after: event.newValue !== null ? { value: event.newValue } : null,
      changeSet: {
        value: {
          before: event.oldValue,
          after: event.newValue,
        },
      },
      anchoredHash,
      anchoredTx,
      metadata: {
        scope: event.scope,
        flagKey: event.flagKey,
        orgId: event.orgId,
        userId: event.userId,
      },
    },
  });

  return auditEvent;
}

/**
 * Simulate blockchain anchor (replace with actual blockchain service)
 */
async function simulateBlockchainAnchor(hash: string): Promise<string> {
  // In production, this would call the blockchain service
  // For now, return a simulated transaction hash
  return `0x${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Get flag change history for a flag
 */
export async function getFlagChangeHistory(
  flagKey: string,
  options?: {
    orgId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  const where: any = {
    type: 'FLAG_CHANGED',
    data: {
      path: ['flagKey'],
      equals: flagKey,
    },
  };

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit || 100,
  });

  // Filter by scope if provided
  let filtered = events;
  if (options?.orgId) {
    filtered = filtered.filter((e: any) =>
      (e.data as any)?.scope === 'ORG' && (e.data as any)?.orgId === options.orgId
    );
  }
  if (options?.userId) {
    filtered = filtered.filter((e: any) =>
      (e.data as any)?.scope === 'USER' && (e.data as any)?.userId === options.userId
    );
  }

  return filtered;
}

/**
 * Get latest change for a flag override
 */
export async function getLatestFlagChange(
  flagKey: string,
  scope: 'GLOBAL' | 'ORG' | 'USER',
  orgId?: string,
  userId?: string
) {
  const where: any = {
    type: 'FLAG_CHANGED',
    data: {
      path: ['flagKey'],
      equals: flagKey,
    },
  };

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: 1,
  });

  if (events.length === 0) {
    return null;
  }

  // Filter by scope
  const filtered = events.filter((e: any) => {
    const data = e.data as any;
    if (data.scope !== scope) return false;
    if (scope === 'ORG' && data.orgId !== orgId) return false;
    if (scope === 'USER' && data.userId !== userId) return false;
    return true;
  });

  return filtered[0] || null;
}

/**
 * Export flag change events for compliance/reporting
 */
export async function exportFlagChangeEvents(
  options?: {
    flagKey?: string;
    scope?: 'GLOBAL' | 'ORG' | 'USER';
    orgId?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: any = {
    type: 'FLAG_CHANGED',
  };

  if (options?.flagKey) {
    where.data = {
      path: ['flagKey'],
      equals: options.flagKey,
    };
  }

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Filter by scope if provided
  let filtered = events;
  if (options?.scope) {
    filtered = filtered.filter((e: any) =>
      (e.data as any)?.scope === options.scope
    );
  }
  if (options?.orgId) {
    filtered = filtered.filter((e: any) =>
      (e.data as any)?.orgId === options.orgId
    );
  }

  return filtered.map((e: any) => ({
    id: e.id,
    flagKey: (e.data as any).flagKey,
    scope: (e.data as any).scope,
    orgId: (e.data as any).orgId,
    userId: (e.data as any).userId,
    oldValue: (e.data as any).oldValue,
    newValue: (e.data as any).newValue,
    actorId: (e.data as any).actorId,
    actorName: (e.data as any).actorName,
    timestamp: e.createdAt,
    anchoredHash: (e.data as any).anchoredHash,
    anchoredTx: (e.data as any).anchoredTx,
  }));
}

