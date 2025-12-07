/**
 * B250B-DOC-016: DocumentAnalyticsService
 * Collects and aggregates metrics: document views, downloads, time spent reading, edit counts
 * Stores anonymized data; provides report generation methods
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const TrackEventSchema = z.object({
  documentId: z.string(),
  eventType: z.enum(['VIEW', 'DOWNLOAD', 'EDIT', 'TIME_SPENT']),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export interface TrackEventParams {
  documentId: string;
  eventType: 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'TIME_SPENT';
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsReport {
  documentId: string;
  totalViews: number;
  totalDownloads: number;
  totalEdits: number;
  averageTimeSpent: number;
  uniqueViewers: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export class DocumentAnalyticsService {
  /**
   * Track an analytics event
   */
  async trackEvent(params: TrackEventParams) {
    // Validate input
    const validated = TrackEventSchema.parse(params);

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
      select: { id: true },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Anonymize userId if provided (store hash for privacy)
    let anonymizedUserId: string | undefined;
    if (validated.userId) {
      // In production, use proper hashing
      const crypto = await import('crypto');
      anonymizedUserId = crypto.createHash('sha256').update(validated.userId).digest('hex').substring(0, 16);
    }

    // Store event
    await prisma.documentAnalytics.create({
      data: {
        documentId: validated.documentId,
        eventType: validated.eventType,
        userId: anonymizedUserId,
        metadata: validated.metadata,
      },
    });
  }

  /**
   * Get analytics report for a document
   */
  async getReport(documentId: string, startDate?: Date, endDate?: Date): Promise<AnalyticsReport> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate || new Date();

    // Get all events in date range
    const events = await prisma.documentAnalytics.findMany({
      where: {
        documentId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // Aggregate metrics
    const views = events.filter((e) => e.eventType === 'VIEW');
    const downloads = events.filter((e) => e.eventType === 'DOWNLOAD');
    const edits = events.filter((e) => e.eventType === 'EDIT');
    const timeSpentEvents = events.filter((e) => e.eventType === 'TIME_SPENT');

    // Calculate average time spent
    let averageTimeSpent = 0;
    if (timeSpentEvents.length > 0) {
      const totalTime = timeSpentEvents.reduce((sum, event) => {
        const time = (event.metadata as any)?.timeSpent || 0;
        return sum + time;
      }, 0);
      averageTimeSpent = totalTime / timeSpentEvents.length;
    }

    // Count unique viewers
    const uniqueViewers = new Set(views.map((e) => e.userId).filter(Boolean)).size;

    return {
      documentId,
      totalViews: views.length,
      totalDownloads: downloads.length,
      totalEdits: edits.length,
      averageTimeSpent: Math.round(averageTimeSpent),
      uniqueViewers,
      dateRange: {
        start,
        end,
      },
    };
  }

  /**
   * Get aggregated metrics across all documents
   */
  async getAggregatedMetrics(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const events = await prisma.documentAnalytics.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const views = events.filter((e) => e.eventType === 'VIEW').length;
    const downloads = events.filter((e) => e.eventType === 'DOWNLOAD').length;
    const edits = events.filter((e) => e.eventType === 'EDIT').length;

    const timeSpentEvents = events.filter((e) => e.eventType === 'TIME_SPENT');
    const totalTime = timeSpentEvents.reduce((sum, event) => {
      const time = (event.metadata as any)?.timeSpent || 0;
      return sum + time;
    }, 0);
    const averageTimeSpent = timeSpentEvents.length > 0 ? totalTime / timeSpentEvents.length : 0;

    return {
      totalViews: views,
      totalDownloads: downloads,
      totalEdits: edits,
      averageTimeSpent: Math.round(averageTimeSpent),
      dateRange: {
        start,
        end,
      },
    };
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();

