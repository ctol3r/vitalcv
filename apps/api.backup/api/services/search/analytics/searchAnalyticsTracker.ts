/**
 * B232B-SEARCH-006: SearchAnalyticsTracker
 *
 * Collects and stores anonymized search queries and click-through data.
 * Produces aggregate insights on popular searches, click rates, and conversion paths.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface SearchQueryEvent {
  query: string;
  entityType?: 'provider' | 'credential' | 'module' | 'contract' | 'job';
  filters?: Record<string, any>;
  userId?: string; // Optional - will be anonymized
  orgId?: string; // Optional - will be anonymized
  region?: string;
  timestamp?: Date;
}

export interface ClickThroughEvent {
  queryId: string; // Reference to search query
  resultId: string; // ID of clicked result
  resultType: 'provider' | 'credential' | 'module' | 'contract' | 'job';
  position: number; // Position in results (1-indexed)
  userId?: string; // Optional - will be anonymized
  orgId?: string; // Optional - will be anonymized
  timestamp?: Date;
}

export interface ConversionEvent {
  queryId: string; // Reference to search query
  resultId: string; // ID of converted result
  resultType: 'provider' | 'credential' | 'module' | 'contract' | 'job';
  conversionType: 'purchase' | 'download' | 'contact' | 'apply' | 'view_details';
  userId?: string; // Optional - will be anonymized
  orgId?: string; // Optional - will be anonymized
  timestamp?: Date;
}

export interface SearchInsights {
  popularQueries: Array<{
    query: string;
    count: number;
    clickRate: number;
    conversionRate: number;
  }>;
  clickRates: {
    average: number;
    byEntityType: Record<string, number>;
    byPosition: Record<number, number>;
  };
  conversionPaths: Array<{
    query: string;
    resultType: string;
    conversionType: string;
    count: number;
  }>;
  trendingQueries: Array<{
    query: string;
    growth: number; // Percentage growth
    count: number;
  }>;
}

/**
 * Anonymize user identifiers for privacy
 */
function anonymizeId(id?: string): string | null {
  if (!id) return null;
  // Simple hash-based anonymization (in production, use crypto.createHash)
  const hash = id.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `anon_${Math.abs(hash).toString(36)}`;
}

/**
 * SearchAnalyticsTracker - Tracks search queries and user interactions
 */
export class SearchAnalyticsTracker {
  /**
   * Track a search query
   */
  async trackQuery(event: SearchQueryEvent): Promise<string> {
    const anonymizedUserId = anonymizeId(event.userId);
    const anonymizedOrgId = anonymizeId(event.orgId);

    // Store in database using raw SQL (until Prisma schema is updated)
    const result = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "SearchQuery" (
        id, query, "entityType", filters, "userId", "orgId", region, timestamp, "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${event.query},
        ${event.entityType || null},
        ${event.filters ? JSON.stringify(event.filters) : null}::jsonb,
        ${anonymizedUserId},
        ${anonymizedOrgId},
        ${event.region || null},
        ${event.timestamp || new Date()},
        ${new Date()}
      )
      RETURNING id
    `;

    // Extract ID from result
    const queryId = result[0]?.id || `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return queryId;
  }

  /**
   * Track a click-through event
   */
  async trackClickThrough(event: ClickThroughEvent): Promise<void> {
    const anonymizedUserId = anonymizeId(event.userId);
    const anonymizedOrgId = anonymizeId(event.orgId);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SearchClickThrough" (
        id, "queryId", "resultId", "resultType", position, "userId", "orgId", timestamp, "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
    `,
      event.queryId,
      event.resultId,
      event.resultType,
      event.position,
      anonymizedUserId,
      anonymizedOrgId,
      event.timestamp || new Date(),
      new Date()
    );
  }

  /**
   * Track a conversion event
   */
  async trackConversion(event: ConversionEvent): Promise<void> {
    const anonymizedUserId = anonymizeId(event.userId);
    const anonymizedOrgId = anonymizeId(event.orgId);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "SearchConversion" (
        id, "queryId", "resultId", "resultType", "conversionType", "userId", "orgId", timestamp, "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
    `,
      event.queryId,
      event.resultId,
      event.resultType,
      event.conversionType,
      anonymizedUserId,
      anonymizedOrgId,
      event.timestamp || new Date(),
      new Date()
    );
  }

  /**
   * Get aggregate insights for popular searches, click rates, and conversions
   */
  async getInsights(options?: {
    startDate?: Date;
    endDate?: Date;
    entityType?: string;
    region?: string;
    limit?: number;
  }): Promise<SearchInsights> {
    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = options?.endDate || new Date();
    const limit = options?.limit || 20;

    // Build dynamic WHERE clause
    const whereConditions: string[] = [`sq.timestamp >= $1`, `sq.timestamp <= $2`];
    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    if (options?.entityType) {
      whereConditions.push(`sq."entityType" = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }

    if (options?.region) {
      whereConditions.push(`sq.region = $${paramIndex}`);
      params.push(options.region);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Popular queries with click and conversion rates
    const popularQueriesResult = await prisma.$queryRawUnsafe<Array<{
      query: string;
      count: bigint;
      clicks: bigint;
      conversions: bigint;
    }>>(`
      SELECT
        sq.query,
        COUNT(*)::bigint as count,
        COUNT(DISTINCT sct.id)::bigint as clicks,
        COUNT(DISTINCT sc.id)::bigint as conversions
      FROM "SearchQuery" sq
      LEFT JOIN "SearchClickThrough" sct ON sq.id = sct."queryId"
      LEFT JOIN "SearchConversion" sc ON sq.id = sc."queryId"
      WHERE ${whereClause}
      GROUP BY sq.query
      ORDER BY count DESC
      LIMIT $${paramIndex}
    `, ...params, limit);

    const popularQueries = popularQueriesResult.map((row) => ({
      query: row.query,
      count: Number(row.count),
      clickRate: row.count > 0 ? Number(row.clicks) / Number(row.count) : 0,
      conversionRate: row.count > 0 ? Number(row.conversions) / Number(row.count) : 0,
    }));

    // Click rates by entity type and position
    const clickRatesByType = await prisma.$queryRawUnsafe<Array<{
      resultType: string;
      clickRate: number;
    }>>(`
      SELECT
        sct."resultType",
        COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM "SearchQuery" sq2
          WHERE sq2.timestamp >= $1 AND sq2.timestamp <= $2), 0) as "clickRate"
      FROM "SearchClickThrough" sct
      JOIN "SearchQuery" sq ON sct."queryId" = sq.id
      WHERE sq.timestamp >= $1 AND sq.timestamp <= $2
      GROUP BY sct."resultType"
    `, startDate, endDate);

    const clickRatesByPosition = await prisma.$queryRawUnsafe<Array<{
      position: number;
      clickRate: number;
    }>>(`
      SELECT
        sct.position,
        COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM "SearchQuery" sq2
          WHERE sq2.timestamp >= $1 AND sq2.timestamp <= $2), 0) as "clickRate"
      FROM "SearchClickThrough" sct
      JOIN "SearchQuery" sq ON sct."queryId" = sq.id
      WHERE sq.timestamp >= $1 AND sq.timestamp <= $2
      GROUP BY sct.position
      ORDER BY sct.position
    `, startDate, endDate);

    const totalQueries = popularQueries.reduce((sum, q) => sum + q.count, 0);
    const totalClicks = popularQueries.reduce((sum, q) => sum + q.count * q.clickRate, 0);
    const averageClickRate = totalQueries > 0 ? totalClicks / totalQueries : 0;

    // Conversion paths
    const conversionPathsResult = await prisma.$queryRawUnsafe<Array<{
      query: string;
      resultType: string;
      conversionType: string;
      count: bigint;
    }>>(`
      SELECT
        sq.query,
        sc."resultType",
        sc."conversionType",
        COUNT(*)::bigint as count
      FROM "SearchConversion" sc
      JOIN "SearchQuery" sq ON sc."queryId" = sq.id
      WHERE sq.timestamp >= $1 AND sq.timestamp <= $2
      GROUP BY sq.query, sc."resultType", sc."conversionType"
      ORDER BY count DESC
      LIMIT $3
    `, startDate, endDate, limit);

    const conversionPaths = conversionPathsResult.map((row) => ({
      query: row.query,
      resultType: row.resultType,
      conversionType: row.conversionType,
      count: Number(row.count),
    }));

    // Trending queries (comparing last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const recentQueries = await prisma.$queryRawUnsafe<Array<{
      query: string;
      count: bigint;
    }>>(`
      SELECT query, COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE timestamp >= $1 AND timestamp <= $2
      GROUP BY query
    `, sevenDaysAgo, endDate);

    const previousQueries = await prisma.$queryRawUnsafe<Array<{
      query: string;
      count: bigint;
    }>>(`
      SELECT query, COUNT(*)::bigint as count
      FROM "SearchQuery"
      WHERE timestamp >= $1 AND timestamp < $2
      GROUP BY query
    `, fourteenDaysAgo, sevenDaysAgo);

    const previousMap = new Map(previousQueries.map((q) => [q.query, Number(q.count)]));
    const trendingQueries = recentQueries
      .map((q) => {
        const recentCount = Number(q.count);
        const previousCount = previousMap.get(q.query) || 0;
        const growth = previousCount > 0 ? ((recentCount - previousCount) / previousCount) * 100 : 100;
        return {
          query: q.query,
          growth,
          count: recentCount,
        };
      })
      .filter((q) => q.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, limit);

    return {
      popularQueries,
      clickRates: {
        average: averageClickRate,
        byEntityType: Object.fromEntries(
          clickRatesByType.map((r) => [r.resultType, Number(r.clickRate)])
        ),
        byPosition: Object.fromEntries(
          clickRatesByPosition.map((r) => [r.position, Number(r.clickRate)])
        ),
      },
      conversionPaths,
      trendingQueries,
    };
  }
}

// Export singleton instance
export const searchAnalyticsTracker = new SearchAnalyticsTracker();

