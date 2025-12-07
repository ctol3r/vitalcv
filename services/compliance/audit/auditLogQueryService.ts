/**
 * B239B-COM-013: AuditLogQueryService
 *
 * Provides efficient search/filter of audit logs by date range, entity, actor, obligation.
 * Supports pagination and respects access rights.
 * Caches frequent queries for performance.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { AuditEventFilter } from '../models/UnifiedAuditTrail.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/audit/query');

interface QueryOptions {
  userId?: string;
  orgId?: string;
  requireAccessRights?: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Query audit logs with filtering and pagination
 */
export async function queryAuditLogs(
  filter: AuditEventFilter,
  options: QueryOptions = {}
): Promise<PaginatedResult<Prisma.UnifiedAuditTrailGetPayload<{}>>> {
  try {
    const {
      entityType,
      entityId,
      action,
      actorId,
      jurisdiction,
      obligationId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filter;

    // Build where clause
    const where: Prisma.UnifiedAuditTrailWhereInput = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (action) {
      where.action = action;
    }

    if (actorId) {
      where.actorId = actorId;
    }

    if (jurisdiction) {
      where.jurisdiction = jurisdiction;
    }

    if (obligationId) {
      where.obligationId = obligationId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Apply access rights filtering if required
    if (options.requireAccessRights && options.userId) {
      // In a real implementation, check user permissions
      // For now, allow access to own events or org events
      // This would be expanded based on role-based access control
      if (options.orgId) {
        // Allow access to org-related events
        where.OR = [
          { actorId: options.userId },
          { entityType: 'org', entityId: options.orgId },
        ];
      } else {
        where.actorId = options.userId;
      }
    }

    // Execute query with pagination
    const [data, total] = await Promise.all([
      prisma.unifiedAuditTrail.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.unifiedAuditTrail.count({ where }),
    ]);

    const page = Math.floor(offset / limit) + 1;
    const hasMore = offset + data.length < total;

    return {
      data,
      total,
      page,
      pageSize: limit,
      hasMore,
    };
  } catch (error) {
    log.error('[queryAuditLogs] Query failed', { error, filter });
    throw error;
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: string,
  options: QueryOptions = {}
): Promise<Prisma.UnifiedAuditTrailGetPayload<{}>[]> {
  return (
    await queryAuditLogs(
      { entityType, entityId },
      { ...options, requireAccessRights: true }
    )
  ).data;
}

/**
 * Get audit logs by obligation (e.g., GDPR, HIPAA)
 */
export async function getObligationAuditLogs(
  obligationId: string,
  startDate?: Date,
  endDate?: Date,
  options: QueryOptions = {}
): Promise<PaginatedResult<Prisma.UnifiedAuditTrailGetPayload<{}>>> {
  return queryAuditLogs(
    {
      obligationId,
      startDate,
      endDate,
    },
    options
  );
}

/**
 * Get audit logs by actor
 */
export async function getActorAuditLogs(
  actorId: string,
  startDate?: Date,
  endDate?: Date,
  options: QueryOptions = {}
): Promise<PaginatedResult<Prisma.UnifiedAuditTrailGetPayload<{}>>> {
  return queryAuditLogs(
    {
      actorId,
      startDate,
      endDate,
    },
    options
  );
}

/**
 * Get audit statistics for a time period
 */
export async function getAuditStatistics(
  startDate: Date,
  endDate: Date,
  options: QueryOptions = {}
): Promise<{
  totalEvents: number;
  byAction: Record<string, number>;
  byEntityType: Record<string, number>;
  byObligation: Record<string, number>;
}> {
  try {
    const where: Prisma.UnifiedAuditTrailWhereInput = {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Apply access rights if required
    if (options.requireAccessRights && options.userId) {
      if (options.orgId) {
        where.OR = [
          { actorId: options.userId },
          { entityType: 'org', entityId: options.orgId },
        ];
      } else {
        where.actorId = options.userId;
      }
    }

    const events = await prisma.unifiedAuditTrail.findMany({
      where,
      select: {
        action: true,
        entityType: true,
        obligationId: true,
      },
    });

    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const byObligation: Record<string, number> = {};

    for (const event of events) {
      byAction[event.action] = (byAction[event.action] || 0) + 1;
      byEntityType[event.entityType] = (byEntityType[event.entityType] || 0) + 1;
      if (event.obligationId) {
        byObligation[event.obligationId] = (byObligation[event.obligationId] || 0) + 1;
      }
    }

    return {
      totalEvents: events.length,
      byAction,
      byEntityType,
      byObligation,
    };
  } catch (error) {
    log.error('[getAuditStatistics] Statistics query failed', { error });
    throw error;
  }
}

/**
 * Simple in-memory cache for frequent queries
 * In production, use Redis or similar
 */
class QueryCache {
  private cache = new Map<string, { data: unknown; expires: number }>();
  private ttl = 60000; // 1 minute

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown, ttl?: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.ttl),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const queryCache = new QueryCache();

/**
 * Cached version of queryAuditLogs for frequent queries
 */
export async function queryAuditLogsCached(
  filter: AuditEventFilter,
  options: QueryOptions = {},
  cacheKey?: string
): Promise<PaginatedResult<Prisma.UnifiedAuditTrailGetPayload<{}>>> {
  const key = cacheKey || JSON.stringify({ filter, options });
  const cached = queryCache.get<PaginatedResult<Prisma.UnifiedAuditTrailGetPayload<{}>>>(key);
  if (cached) {
    return cached;
  }

  const result = await queryAuditLogs(filter, options);
  queryCache.set(key, result);
  return result;
}

