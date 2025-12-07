/**
 * B245A-OBS-003: LogEvent model
 * Schema: id, serviceName, level (info/warn/error), message, context (JSON), timestamp
 */

import { PrismaClient, LogLevel } from '@prisma/client';

export interface LogEventInput {
  serviceName: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  correlationId?: string;
  timestamp?: Date;
}

export interface LogEventQuery {
  serviceName?: string;
  level?: LogLevel;
  correlationId?: string;
  startTime?: Date;
  endTime?: Date;
  messageContains?: string;
}

export class LogEventModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new log event
   */
  async create(input: LogEventInput) {
    return this.prisma.logEvent.create({
      data: {
        serviceName: input.serviceName,
        level: input.level,
        message: input.message,
        context: input.context ? JSON.parse(JSON.stringify(input.context)) : null,
        correlationId: input.correlationId,
        timestamp: input.timestamp || new Date(),
      },
    });
  }

  /**
   * Find log events by query
   */
  async findMany(query: LogEventQuery, limit: number = 100) {
    const where: any = {};

    if (query.serviceName) {
      where.serviceName = query.serviceName;
    }

    if (query.level) {
      where.level = query.level;
    }

    if (query.correlationId) {
      where.correlationId = query.correlationId;
    }

    if (query.startTime || query.endTime) {
      where.timestamp = {};
      if (query.startTime) {
        where.timestamp.gte = query.startTime;
      }
      if (query.endTime) {
        where.timestamp.lte = query.endTime;
      }
    }

    if (query.messageContains) {
      where.message = {
        contains: query.messageContains,
        mode: 'insensitive',
      };
    }

    return this.prisma.logEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Get logs by correlation ID (for distributed tracing)
   */
  async findByCorrelationId(correlationId: string) {
    return this.prisma.logEvent.findMany({
      where: { correlationId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Get error logs for a service
   */
  async getErrors(serviceName: string, limit: number = 50) {
    return this.prisma.logEvent.findMany({
      where: {
        serviceName,
        level: LogLevel.ERROR,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Delete old log events (for retention policies)
   */
  async deleteOlderThan(beforeDate: Date) {
    return this.prisma.logEvent.deleteMany({
      where: {
        timestamp: {
          lt: beforeDate,
        },
      },
    });
  }
}

export default LogEventModel;

