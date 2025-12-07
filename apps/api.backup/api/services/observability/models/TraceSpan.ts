/**
 * B245A-OBS-004: TraceSpan model
 * Schema: id, traceId, spanId, parentSpanId, serviceName, operationName, startTime, endTime, duration, tags (JSON), status
 */

import { PrismaClient, TraceSpanStatus } from '@prisma/client';

export interface TraceSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  tags?: Record<string, string | number | boolean>;
  status?: TraceSpanStatus;
  errorMessage?: string;
}

export interface TraceSpanQuery {
  traceId?: string;
  serviceName?: string;
  operationName?: string;
  status?: TraceSpanStatus;
  startTime?: Date;
  endTime?: Date;
}

export class TraceSpanModel {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new trace span
   */
  async create(input: TraceSpanInput) {
    const duration = input.duration ?? (input.endTime && input.startTime
      ? input.endTime.getTime() - input.startTime.getTime()
      : null);

    return this.prisma.traceSpan.create({
      data: {
        traceId: input.traceId,
        spanId: input.spanId,
        parentSpanId: input.parentSpanId,
        serviceName: input.serviceName,
        operationName: input.operationName,
        startTime: input.startTime,
        endTime: input.endTime,
        duration,
        tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : null,
        status: input.status || TraceSpanStatus.UNSET,
        errorMessage: input.errorMessage,
      },
    });
  }

  /**
   * Update an existing trace span (typically to set endTime and duration)
   */
  async update(id: string, data: Partial<TraceSpanInput>) {
    const updateData: any = {};

    if (data.endTime !== undefined) {
      updateData.endTime = data.endTime;
    }

    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    } else if (data.endTime && data.startTime) {
      // Calculate duration if endTime and startTime are provided
      updateData.duration = data.endTime.getTime() - data.startTime.getTime();
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.errorMessage !== undefined) {
      updateData.errorMessage = data.errorMessage;
    }

    if (data.tags !== undefined) {
      updateData.tags = JSON.parse(JSON.stringify(data.tags));
    }

    return this.prisma.traceSpan.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Find trace spans by query
   */
  async findMany(query: TraceSpanQuery, limit: number = 100) {
    const where: any = {};

    if (query.traceId) {
      where.traceId = query.traceId;
    }

    if (query.serviceName) {
      where.serviceName = query.serviceName;
    }

    if (query.operationName) {
      where.operationName = query.operationName;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startTime || query.endTime) {
      where.startTime = {};
      if (query.startTime) {
        where.startTime.gte = query.startTime;
      }
      if (query.endTime) {
        where.startTime.lte = query.endTime;
      }
    }

    return this.prisma.traceSpan.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all spans for a trace (for reconstructing full trace)
   */
  async getTrace(traceId: string) {
    return this.prisma.traceSpan.findMany({
      where: { traceId },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Get child spans for a parent span
   */
  async getChildren(parentSpanId: string) {
    return this.prisma.traceSpan.findMany({
      where: { parentSpanId },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Delete old trace spans (for retention policies)
   */
  async deleteOlderThan(beforeDate: Date) {
    return this.prisma.traceSpan.deleteMany({
      where: {
        startTime: {
          lt: beforeDate,
        },
      },
    });
  }
}

export default TraceSpanModel;

