/**
 * Audit Scrapbook collector
 * Collects event history and audit trail metadata
 */

import type { PrismaClient } from '@prisma/client';

export interface AuditScrapbookState {
  totalEvents: number;
  eventsByType: Record<string, number>;
  recentEvents: number;
  lastEventTimestamp?: string;
  auditIntegrity: 'verified' | 'unknown';
}

export async function collectAuditScrapbook(
  prisma: PrismaClient
): Promise<AuditScrapbookState> {
  try {
    // Try to query audit/event tables
    const eventCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "AuditEvent"
    `.catch(() => [{ count: 0n }]);

    const recentEventCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "AuditEvent"
      WHERE "createdAt" > NOW() - INTERVAL '24 hours'
    `.catch(() => [{ count: 0n }]);

    const lastEvent = await prisma.$queryRaw<Array<{ createdAt: Date }>>`
      SELECT "createdAt"
      FROM "AuditEvent"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `.catch(() => []);

    const eventsByType = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
      SELECT "type", COUNT(*) as count
      FROM "AuditEvent"
      GROUP BY "type"
      ORDER BY count DESC
      LIMIT 20
    `.catch(() => []);

    const eventsByTypeMap: Record<string, number> = {};
    for (const row of eventsByType) {
      eventsByTypeMap[row.type] = Number(row.count);
    }

    return {
      totalEvents: Number(eventCount[0]?.count || 0),
      eventsByType: eventsByTypeMap,
      recentEvents: Number(recentEventCount[0]?.count || 0),
      lastEventTimestamp: lastEvent[0]?.createdAt?.toISOString(),
      auditIntegrity: 'unknown', // Would need chain verification for 'verified'
    };
  } catch (error) {
    console.warn('[state-agent] Failed to collect audit scrapbook state:', error);
    return {
      totalEvents: 0,
      eventsByType: {},
      recentEvents: 0,
      auditIntegrity: 'unknown',
    };
  }
}

