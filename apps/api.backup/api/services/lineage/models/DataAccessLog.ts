/**
 * B228B-LIN-007: DataAccessLog model
 *
 * Tracks every read of sensitive data: recordId, accessorId, timestamp, reason, metadata.
 * Supports configurable retention policies.
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const DataAccessLogSchema = z.object({
  id: z.string(),
  recordId: z.string(),
  accessorId: z.string(),
  timestamp: z.date(),
  reason: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DataAccessLog = z.infer<typeof DataAccessLogSchema>;

export interface CreateDataAccessLogInput {
  recordId: string;
  accessorId: string;
  reason: string;
  metadata?: Record<string, unknown> | null;
}

export interface DataAccessLogQuery {
  recordId?: string;
  accessorId?: string;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  limit?: number;
  offset?: number;
}

/**
 * DataAccessLog service
 */
export class DataAccessLogService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Log a data access event
   */
  async logAccess(input: CreateDataAccessLogInput): Promise<DataAccessLog> {
    const log = await this.prisma.dataAccessLog.create({
      data: {
        recordId: input.recordId,
        accessorId: input.accessorId,
        timestamp: new Date(),
        reason: input.reason,
        metadata: input.metadata ?? null,
      },
    });

    return DataAccessLogSchema.parse(log);
  }

  /**
   * Query access logs
   */
  async queryLogs(query: DataAccessLogQuery): Promise<DataAccessLog[]> {
    const where: any = {};

    if (query.recordId) {
      where.recordId = query.recordId;
    }

    if (query.accessorId) {
      where.accessorId = query.accessorId;
    }

    if (query.reason) {
      where.reason = { contains: query.reason };
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = query.startDate;
      }
      if (query.endDate) {
        where.timestamp.lte = query.endDate;
      }
    }

    const logs = await this.prisma.dataAccessLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit ?? 100,
      skip: query.offset ?? 0,
    });

    return logs.map((log) => DataAccessLogSchema.parse(log));
  }

  /**
   * Get access logs for a specific record
   */
  async getLogsForRecord(recordId: string, limit = 100): Promise<DataAccessLog[]> {
    return this.queryLogs({ recordId, limit });
  }

  /**
   * Get access logs for a specific accessor
   */
  async getLogsForAccessor(accessorId: string, limit = 100): Promise<DataAccessLog[]> {
    return this.queryLogs({ accessorId, limit });
  }

  /**
   * Delete logs older than retention period
   */
  async purgeOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.dataAccessLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Get access count for a record
   */
  async getAccessCount(recordId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const where: any = { recordId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    return this.prisma.dataAccessLog.count({ where });
  }
}

