/**
 * VaultAuditLog
 * B237A-DP-008: VaultAuditLog
 *
 * Records all operations on the vault (create, read, update, delete, share, export).
 * Stores timestamp, actor, action, recordId. Tamper-evident with hash verification.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  vaultId: string;
  actorId: string;
  action: string;
  recordId?: string;
  scope?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a vault access event
 */
export async function logVaultAccess(entry: AuditLogEntry): Promise<void> {
  // Calculate tamper-evident hash
  const hashInput = [
    entry.vaultId,
    entry.actorId,
    entry.action,
    entry.recordId || '',
    entry.scope || '',
    new Date().toISOString(),
  ].join('|');

  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  await prisma.vaultAuditLog.create({
    data: {
      vaultId: entry.vaultId,
      actorId: entry.actorId,
      action: entry.action,
      recordId: entry.recordId,
      scope: entry.scope,
      ipAddress: entry.ipAddress ? anonymizeIp(entry.ipAddress) : null,
      userAgent: entry.userAgent ? truncateUserAgent(entry.userAgent) : null,
      metadata: entry.metadata || {},
      hash,
    },
  });
}

/**
 * Get audit logs for a vault
 */
export async function getVaultAuditLogs(
  vaultId: string,
  options?: {
    actorId?: string;
    action?: string;
    recordId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: any = {
    vaultId,
    ...(options?.actorId && { actorId: options.actorId }),
    ...(options?.action && { action: options.action }),
    ...(options?.recordId && { recordId: options.recordId }),
    ...(options?.startDate && { createdAt: { gte: options.startDate } }),
    ...(options?.endDate && { createdAt: { lte: options.endDate } }),
  };

  return prisma.vaultAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  });
}

/**
 * Get audit logs by actor
 */
export async function getActorAuditLogs(
  actorId: string,
  options?: {
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  const where: any = {
    actorId,
    ...(options?.action && { action: options.action }),
    ...(options?.startDate && { createdAt: { gte: options.startDate } }),
    ...(options?.endDate && { createdAt: { lte: options.endDate } }),
  };

  return prisma.vaultAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
  });
}

/**
 * Verify audit log integrity (check hash)
 */
export async function verifyAuditLogIntegrity(logId: string): Promise<boolean> {
  const log = await prisma.vaultAuditLog.findUnique({
    where: { id: logId },
  });

  if (!log) {
    return false;
  }

  // Recalculate hash
  const hashInput = [
    log.vaultId,
    log.actorId,
    log.action,
    log.recordId || '',
    log.scope || '',
    log.createdAt.toISOString(),
  ].join('|');

  const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  return log.hash === expectedHash;
}

/**
 * Get audit statistics for admin dashboard
 */
export async function getAuditStatistics(
  options?: {
    startDate?: Date;
    endDate?: Date;
    vaultId?: string;
  }
) {
  const where: any = {
    ...(options?.startDate && { createdAt: { gte: options.startDate } }),
    ...(options?.endDate && { createdAt: { lte: options.endDate } }),
    ...(options?.vaultId && { vaultId: options.vaultId }),
  };

  const logs = await prisma.vaultAuditLog.findMany({
    where,
    select: {
      action: true,
      actorId: true,
      vaultId: true,
      createdAt: true,
    },
  });

  const stats = {
    totalEvents: logs.length,
    byAction: {} as Record<string, number>,
    byActor: {} as Record<string, number>,
    byVault: {} as Record<string, number>,
    timeline: [] as Array<{ date: string; count: number }>,
  };

  logs.forEach((log) => {
    // Count by action
    stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

    // Count by actor
    stats.byActor[log.actorId] = (stats.byActor[log.actorId] || 0) + 1;

    // Count by vault
    stats.byVault[log.vaultId] = (stats.byVault[log.vaultId] || 0) + 1;
  });

  // Group by date
  const dateGroups = new Map<string, number>();
  logs.forEach((log) => {
    const date = log.createdAt.toISOString().split('T')[0];
    dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
  });

  stats.timeline = Array.from(dateGroups.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return stats;
}

/**
 * Anonymize IP address (remove last octet)
 */
function anonymizeIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  // IPv6: simplify to first 64 bits
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 4).join(':') + '::';
  }
  return ip;
}

/**
 * Truncate user agent to reasonable length
 */
function truncateUserAgent(userAgent: string, maxLength: number = 200): string {
  if (userAgent.length <= maxLength) {
    return userAgent;
  }
  return userAgent.substring(0, maxLength) + '...';
}
