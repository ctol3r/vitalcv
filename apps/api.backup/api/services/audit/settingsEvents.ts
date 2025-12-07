/**
 * B141A-AUD-008: Settings change audit events
 * Records all setting changes with before/after states and anchors to blockchain
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Setting change event types
 */
export enum SettingChangeAction {
  EHR_CONFIG_CREATED = 'EHR_CONFIG_CREATED',
  EHR_CONFIG_UPDATED = 'EHR_CONFIG_UPDATED',
  EHR_CONFIG_DELETED = 'EHR_CONFIG_DELETED',
  TEFCA_CONFIG_CREATED = 'TEFCA_CONFIG_CREATED',
  TEFCA_CONFIG_UPDATED = 'TEFCA_CONFIG_UPDATED',
  TEFCA_CONFIG_DELETED = 'TEFCA_CONFIG_DELETED',
  BILLING_CONFIG_UPDATED = 'BILLING_CONFIG_UPDATED',
  ORG_CONFIG_UPDATED = 'ORG_CONFIG_UPDATED',
  PAYER_CONFIG_CREATED = 'PAYER_CONFIG_CREATED',
  PAYER_CONFIG_UPDATED = 'PAYER_CONFIG_UPDATED',
  PAYER_CONFIG_DELETED = 'PAYER_CONFIG_DELETED',
}

/**
 * Record a settings change event
 */
export async function recordSettingChange(
  orgId: string,
  resourceType: string,
  action: SettingChangeAction,
  actorId: string,
  actorName: string,
  before: Record<string, any> | null,
  after: Record<string, any> | null,
  resourceId?: string,
  metadata?: Record<string, any>
) {
  // Compute change set (fields that changed)
  const changeSet = computeChangeSet(before, after);

  // Generate hash for anchoring
  const anchoredHash = generateSettingChangeHash({
    orgId,
    resourceType,
    resourceId,
    action,
    actorId,
    timestamp: new Date().toISOString(),
    before,
    after,
  });

  // Create audit event
  const event = await prisma.settingsAuditEvent.create({
    data: {
      orgId,
      resourceType,
      resourceId,
      action,
      actorId,
      actorName,
      before,
      after,
      changeSet,
      anchoredHash,
      metadata,
    },
  });

  // In production, would anchor hash to blockchain
  // For now, we just store the hash
  // Example: await anchorToBlockchain(anchoredHash);
  const anchoredTx = await simulateBlockchainAnchor(anchoredHash);

  // Update with transaction hash
  const updatedEvent = await prisma.settingsAuditEvent.update({
    where: { id: event.id },
    data: { anchoredTx },
  });

  // Also create a regular audit event for backward compatibility
  await prisma.auditEvent.create({
    data: {
      type: 'SETTING_CHANGED',
      data: {
        settingsEventId: event.id,
        orgId,
        resourceType,
        action,
        actorId,
        actorName,
        changedFields: Object.keys(changeSet),
      },
    },
  });

  return updatedEvent;
}

/**
 * Compute change set between before and after states
 */
function computeChangeSet(
  before: Record<string, any> | null,
  after: Record<string, any> | null
): Record<string, any> {
  if (!before && !after) {
    return {};
  }

  if (!before) {
    // All fields in 'after' are new
    return { ...after };
  }

  if (!after) {
    // All fields in 'before' were removed
    return Object.keys(before).reduce((acc, key) => {
      acc[key] = { before: before[key], after: null };
      return acc;
    }, {} as Record<string, any>);
  }

  // Compare fields
  const changeSet: Record<string, any> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeValue = before[key];
    const afterValue = after[key];

    // Skip sensitive fields
    if (
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('key')
    ) {
      changeSet[key] = {
        before: beforeValue ? '[REDACTED]' : null,
        after: afterValue ? '[REDACTED]' : null,
        changed: beforeValue !== afterValue,
      };
      continue;
    }

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changeSet[key] = {
        before: beforeValue,
        after: afterValue,
      };
    }
  }

  return changeSet;
}

/**
 * Generate hash for settings change event
 */
function generateSettingChangeHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
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
 * Get settings change history for an organization
 */
export async function getSettingsChangeHistory(
  orgId: string,
  options?: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  const where: any = { orgId };

  if (options?.resourceType) {
    where.resourceType = options.resourceType;
  }

  if (options?.resourceId) {
    where.resourceId = options.resourceId;
  }

  if (options?.actorId) {
    where.actorId = options.actorId;
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

  return await prisma.settingsAuditEvent.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit || 100,
  });
}

/**
 * Get specific settings change event
 */
export async function getSettingChangeEvent(eventId: string) {
  return await prisma.settingsAuditEvent.findUnique({
    where: { id: eventId },
  });
}

/**
 * Verify settings change event integrity (check hash)
 */
export async function verifySettingChangeIntegrity(eventId: string): Promise<boolean> {
  const event = await prisma.settingsAuditEvent.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    return false;
  }

  const recomputedHash = generateSettingChangeHash({
    orgId: event.orgId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    action: event.action,
    actorId: event.actorId,
    timestamp: event.createdAt.toISOString(),
    before: event.before,
    after: event.after,
  });

  return recomputedHash === event.anchoredHash;
}

/**
 * Helper functions for specific resource types
 */

export async function recordEhrConfigChange(
  orgId: string,
  action: SettingChangeAction,
  actorId: string,
  actorName: string,
  before: any,
  after: any,
  resourceId?: string
) {
  return recordSettingChange(
    orgId,
    'EhrConfig',
    action,
    actorId,
    actorName,
    before,
    after,
    resourceId
  );
}

export async function recordTefcaConfigChange(
  orgId: string,
  action: SettingChangeAction,
  actorId: string,
  actorName: string,
  before: any,
  after: any,
  resourceId?: string
) {
  return recordSettingChange(
    orgId,
    'QhinConfig',
    action,
    actorId,
    actorName,
    before,
    after,
    resourceId
  );
}

export async function recordBillingConfigChange(
  orgId: string,
  actorId: string,
  actorName: string,
  before: any,
  after: any
) {
  return recordSettingChange(
    orgId,
    'BillingConfig',
    SettingChangeAction.BILLING_CONFIG_UPDATED,
    actorId,
    actorName,
    before,
    after
  );
}

export async function recordOrgConfigChange(
  orgId: string,
  actorId: string,
  actorName: string,
  before: any,
  after: any
) {
  return recordSettingChange(
    orgId,
    'OrgConfig',
    SettingChangeAction.ORG_CONFIG_UPDATED,
    actorId,
    actorName,
    before,
    after
  );
}

/**
 * Get settings change statistics for an organization
 */
export async function getSettingsChangeStats(
  orgId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { orgId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = startDate;
    }
    if (endDate) {
      where.createdAt.lte = endDate;
    }
  }

  const events = await prisma.settingsAuditEvent.findMany({
    where,
    select: {
      resourceType: true,
      action: true,
      actorId: true,
    },
  });

  // Aggregate statistics
  const stats = {
    total: events.length,
    byResourceType: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
    byActor: {} as Record<string, number>,
  };

  for (const event of events) {
    stats.byResourceType[event.resourceType] =
      (stats.byResourceType[event.resourceType] || 0) + 1;
    stats.byAction[event.action] = (stats.byAction[event.action] || 0) + 1;
    stats.byActor[event.actorId] = (stats.byActor[event.actorId] || 0) + 1;
  }

  return stats;
}

