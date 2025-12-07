/**
 * B245A-OBS-001: MetricEvent model
 * Defines schema for metrics: id, serviceName, metricName, metricType (counter/gauge/histogram), value, tags (key-value), timestamp
 */

import { PrismaClient, MetricType } from '@prisma/client';

export interface MetricEventInput {
  serviceName: string;
  metricName: string;
  metricType: MetricType;
  value: number;
  tags?: Record<string, string | number | boolean>;
  timestamp?: Date;
}

export interface MetricEventQuery {
  serviceName?: string;
  metricName?: string;
  metricType?: MetricType;
  startTime?: Date;
  endTime?: Date;
  tags?: Record<string, string | number | boolean>;
}

export class MetricEventModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new metric event
   */
  async create(input: MetricEventInput) {
    return this.prisma.metricEvent.create({
      data: {
        serviceName: input.serviceName,
        metricName: input.metricName,
        metricType: input.metricType,
        value: input.value,
        tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : null,
        timestamp: input.timestamp || new Date(),
      },
    });
  }

  /**
   * Find metric events by query
   */
  async findMany(query: MetricEventQuery) {
    const where: any = {};

    if (query.serviceName) {
      where.serviceName = query.serviceName;
    }

    if (query.metricName) {
      where.metricName = query.metricName;
    }

    if (query.metricType) {
      where.metricType = query.metricType;
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

    // Note: Prisma doesn't support JSON field filtering directly in all cases
    // For tags filtering, you'd need to use raw queries or filter in application code

    return this.prisma.metricEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get aggregated metrics (sum, avg, min, max) for a metric name
   */
  async getAggregated(serviceName: string, metricName: string, startTime?: Date, endTime?: Date) {
    const where: any = {
      serviceName,
      metricName,
    };

    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) {
        where.timestamp.gte = startTime;
      }
      if (endTime) {
        where.timestamp.lte = endTime;
      }
    }

    const events = await this.prisma.metricEvent.findMany({
      where,
      select: { value: true },
    });

    if (events.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
      };
    }

    const values = events.map((e) => e.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: events.length,
      sum,
      avg: sum / events.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  /**
   * Delete old metric events (for retention policies)
   */
  async deleteOlderThan(beforeDate: Date) {
    return this.prisma.metricEvent.deleteMany({
      where: {
        timestamp: {
          lt: beforeDate,
        },
      },
    });
  }
}

export default MetricEventModel;

