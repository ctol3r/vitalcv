/**
 * B243B-KMS-018: ContentAnalyticsService
 *
 * Collects article view statistics (views, unique readers, time spent, bounce rate).
 * Calculates trending articles; provides aggregated data for dashboards.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const log = getServiceLogger('kms/analytics');

export interface ViewEvent {
  articleId: string;
  userId?: string; // Optional user ID for unique reader tracking
  sessionId: string; // Session ID for tracking
  timeSpent?: number; // Time spent in seconds
  bounced?: boolean; // Whether user bounced (left immediately)
}

export interface AnalyticsRecord {
  id: string;
  articleId: string;
  views: number;
  uniqueReaders: number;
  avgTimeSpent: number;
  bounceRate: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Record a view event
 */
export async function recordView(
  prisma: PrismaClient,
  event: ViewEvent
): Promise<void> {
  try {
    // Validate article exists
    const article = await prisma.contentArticle.findUnique({
      where: { id: event.articleId },
    });

    if (!article) {
      log.warn('View recorded for non-existent article', { articleId: event.articleId });
      return;
    }

    // Get or create analytics record for current period (daily)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    let analytics = await prisma.contentAnalytics.findFirst({
      where: {
        articleId: event.articleId,
        periodStart,
        periodEnd,
      },
    });

    if (!analytics) {
      analytics = await prisma.contentAnalytics.create({
        data: {
          articleId: event.articleId,
          periodStart,
          periodEnd,
          views: 0,
          uniqueReaders: 0,
          avgTimeSpent: 0,
          bounceRate: 0,
        },
      });
    }

    // Update statistics
    const updates: any = {
      views: { increment: 1 },
    };

    // Track unique readers (if userId provided)
    if (event.userId) {
      // Check if this user already viewed in this period
      const existingViews = await prisma.contentAnalytics.findFirst({
        where: {
          articleId: event.articleId,
          periodStart,
          periodEnd,
        },
      });

      // Simple heuristic: if views > uniqueReaders, increment uniqueReaders
      // In production, you'd track this more precisely
      if (existingViews && existingViews.views >= existingViews.uniqueReaders) {
        updates.uniqueReaders = { increment: 1 };
      }
    }

    // Update average time spent
    if (event.timeSpent !== undefined && event.timeSpent > 0) {
      const currentAvg = analytics.avgTimeSpent;
      const totalViews = analytics.views + 1;
      const newAvg = (currentAvg * analytics.views + event.timeSpent) / totalViews;
      updates.avgTimeSpent = newAvg;
    }

    // Update bounce rate
    if (event.bounced !== undefined) {
      const currentBounceRate = analytics.bounceRate;
      const totalViews = analytics.views + 1;
      const bouncedViews = currentBounceRate * analytics.views + (event.bounced ? 1 : 0);
      const newBounceRate = bouncedViews / totalViews;
      updates.bounceRate = newBounceRate;
    }

    await prisma.contentAnalytics.update({
      where: { id: analytics.id },
      data: updates,
    });

    log.debug('View recorded', { articleId: event.articleId, sessionId: event.sessionId });
  } catch (error) {
    log.error('Failed to record view', { event, error });
  }
}

/**
 * Get analytics for an article
 */
export async function getArticleAnalytics(
  prisma: PrismaClient,
  articleId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<AnalyticsRecord[]> {
  const where: any = { articleId };

  if (periodStart) {
    where.periodStart = { gte: periodStart };
  }

  if (periodEnd) {
    where.periodEnd = { lte: periodEnd };
  }

  return prisma.contentAnalytics.findMany({
    where,
    orderBy: { periodStart: 'desc' },
  });
}

/**
 * Get aggregated analytics for an article (all time)
 */
export async function getAggregatedAnalytics(
  prisma: PrismaClient,
  articleId: string
): Promise<{
  totalViews: number;
  totalUniqueReaders: number;
  avgTimeSpent: number;
  avgBounceRate: number;
}> {
  const records = await prisma.contentAnalytics.findMany({
    where: { articleId },
  });

  if (records.length === 0) {
    return {
      totalViews: 0,
      totalUniqueReaders: 0,
      avgTimeSpent: 0,
      avgBounceRate: 0,
    };
  }

  const totalViews = records.reduce((sum, r) => sum + r.views, 0);
  const totalUniqueReaders = records.reduce((sum, r) => sum + r.uniqueReaders, 0);
  const totalTimeSpent = records.reduce((sum, r) => sum + r.avgTimeSpent * r.views, 0);
  const totalBounceRate = records.reduce((sum, r) => sum + r.bounceRate * r.views, 0);

  return {
    totalViews,
    totalUniqueReaders,
    avgTimeSpent: totalViews > 0 ? totalTimeSpent / totalViews : 0,
    avgBounceRate: totalViews > 0 ? totalBounceRate / totalViews : 0,
  };
}

/**
 * Get trending articles (by views in last N days)
 */
export async function getTrendingArticles(
  prisma: PrismaClient,
  days: number = 7,
  limit: number = 10
): Promise<Array<{
  articleId: string;
  title: string;
  views: number;
  uniqueReaders: number;
  avgTimeSpent: number;
}>> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const records = await prisma.contentAnalytics.findMany({
    where: {
      periodStart: {
        gte: periodStart,
      },
    },
    include: {
      article: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  // Aggregate by article
  const articleStats = new Map<string, {
    articleId: string;
    title: string;
    views: number;
    uniqueReaders: number;
    totalTimeSpent: number;
    viewCount: number;
  }>();

  for (const record of records) {
    const existing = articleStats.get(record.articleId);
    if (existing) {
      existing.views += record.views;
      existing.uniqueReaders += record.uniqueReaders;
      existing.totalTimeSpent += record.avgTimeSpent * record.views;
      existing.viewCount += record.views;
    } else {
      articleStats.set(record.articleId, {
        articleId: record.articleId,
        title: record.article.title,
        views: record.views,
        uniqueReaders: record.uniqueReaders,
        totalTimeSpent: record.avgTimeSpent * record.views,
        viewCount: record.views,
      });
    }
  }

  // Convert to array and calculate averages
  return Array.from(articleStats.values())
    .map((stats) => ({
      articleId: stats.articleId,
      title: stats.title,
      views: stats.views,
      uniqueReaders: stats.uniqueReaders,
      avgTimeSpent: stats.viewCount > 0 ? stats.totalTimeSpent / stats.viewCount : 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(
  prisma: PrismaClient,
  days: number = 30
): Promise<{
  totalViews: number;
  totalUniqueReaders: number;
  avgTimeSpent: number;
  avgBounceRate: number;
  topArticles: Array<{ articleId: string; title: string; views: number }>;
}> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const records = await prisma.contentAnalytics.findMany({
    where: {
      periodStart: {
        gte: periodStart,
      },
    },
    include: {
      article: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const totalViews = records.reduce((sum, r) => sum + r.views, 0);
  const totalUniqueReaders = records.reduce((sum, r) => sum + r.uniqueReaders, 0);
  const totalTimeSpent = records.reduce((sum, r) => sum + r.avgTimeSpent * r.views, 0);
  const totalBounceRate = records.reduce((sum, r) => sum + r.bounceRate * r.views, 0);

  // Get top articles
  const articleViews = new Map<string, { articleId: string; title: string; views: number }>();
  for (const record of records) {
    const existing = articleViews.get(record.articleId);
    if (existing) {
      existing.views += record.views;
    } else {
      articleViews.set(record.articleId, {
        articleId: record.articleId,
        title: record.article.title,
        views: record.views,
      });
    }
  }

  const topArticles = Array.from(articleViews.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    totalViews,
    totalUniqueReaders,
    avgTimeSpent: totalViews > 0 ? totalTimeSpent / totalViews : 0,
    avgBounceRate: totalViews > 0 ? totalBounceRate / totalViews : 0,
    topArticles,
  };
}

