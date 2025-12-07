/**
 * B245A-OBS-005: DistributedTracingService
 * Manages trace spans: starts/ends spans, links parent & child spans, calculates durations; exports traces to external tracer (e.g. Zipkin); retrieves traces by traceId
 */

import { PrismaClient, TraceSpanStatus } from '@prisma/client';
import { TraceSpanModel, TraceSpanInput } from '../models/TraceSpan.js';
import { v4 as uuidv4 } from 'uuid';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SpanTags {
  [key: string]: string | number | boolean;
}

export class DistributedTracingService {
  private traceSpanModel: TraceSpanModel;
  private serviceName: string;
  private activeSpans: Map<string, { id: string; startTime: Date; traceId: string; parentSpanId?: string }> = new Map();

  constructor(prisma: PrismaClient, serviceName: string = 'default-service') {
    this.traceSpanModel = new TraceSpanModel(prisma);
    this.serviceName = serviceName;
  }

  /**
   * Generate a new trace ID
   */
  generateTraceId(): string {
    return uuidv4();
  }

  /**
   * Generate a new span ID
   */
  generateSpanId(): string {
    return uuidv4();
  }

  /**
   * Start a new span
   */
  async startSpan(
    operationName: string,
    traceId?: string,
    parentSpanId?: string,
    tags?: SpanTags
  ): Promise<SpanContext> {
    const spanId = this.generateSpanId();
    const finalTraceId = traceId || this.generateTraceId();
    const startTime = new Date();

    // Create span in database
    const createdSpan = await this.traceSpanModel.create({
      traceId: finalTraceId,
      spanId,
      parentSpanId,
      serviceName: this.serviceName,
      operationName,
      startTime,
      tags,
      status: TraceSpanStatus.UNSET,
    });

    // Store active span info with database id
    this.activeSpans.set(spanId, {
      id: createdSpan.id,
      startTime,
      traceId: finalTraceId,
      parentSpanId,
    });

    return {
      traceId: finalTraceId,
      spanId,
      parentSpanId,
    };
  }

  /**
   * End a span
   */
  async endSpan(
    spanId: string,
    status: TraceSpanStatus = TraceSpanStatus.OK,
    errorMessage?: string,
    tags?: SpanTags
  ): Promise<void> {
    const activeSpan = this.activeSpans.get(spanId);
    if (!activeSpan) {
      throw new Error(`Span ${spanId} not found or already ended`);
    }

    const endTime = new Date();
    const duration = endTime.getTime() - activeSpan.startTime.getTime();

    // Update span in database using the stored id
    await this.traceSpanModel.update(activeSpan.id, {
      endTime,
      duration,
      status,
      errorMessage,
      tags,
    });

    // Remove from active spans
    this.activeSpans.delete(spanId);
  }

  /**
   * Get all spans for a trace
   */
  async getTrace(traceId: string) {
    return this.traceSpanModel.getTrace(traceId);
  }

  /**
   * Get child spans for a parent span
   */
  async getChildSpans(parentSpanId: string) {
    return this.traceSpanModel.getChildren(parentSpanId);
  }

  /**
   * Export trace to Zipkin format
   */
  async exportToZipkin(traceId: string): Promise<any[]> {
    const spans = await this.getTrace(traceId);

    return spans.map((span) => ({
      traceId: span.traceId,
      id: span.spanId,
      parentId: span.parentSpanId || undefined,
      name: span.operationName,
      timestamp: span.startTime.getTime() * 1000, // Convert to microseconds
      duration: span.duration ? span.duration * 1000 : undefined, // Convert to microseconds
      tags: span.tags as Record<string, string> || {},
      localEndpoint: {
        serviceName: span.serviceName,
      },
      annotations: span.errorMessage
        ? [
            {
              timestamp: span.endTime ? span.endTime.getTime() * 1000 : span.startTime.getTime() * 1000,
              value: span.errorMessage,
            },
          ]
        : [],
    }));
  }

  /**
   * Query spans
   */
  async query(
    traceId?: string,
    operationName?: string,
    status?: TraceSpanStatus,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ) {
    return this.traceSpanModel.findMany(
      {
        traceId,
        serviceName: this.serviceName,
        operationName,
        status,
        startTime,
        endTime,
      },
      limit
    );
  }

  /**
   * Helper: Execute a function within a span
   */
  async trace<T>(
    operationName: string,
    fn: (span: SpanContext) => Promise<T>,
    traceId?: string,
    parentSpanId?: string,
    tags?: SpanTags
  ): Promise<T> {
    const span = await this.startSpan(operationName, traceId, parentSpanId, tags);

    try {
      const result = await fn(span);
      await this.endSpan(span.spanId, TraceSpanStatus.OK);
      return result;
    } catch (error) {
      await this.endSpan(
        span.spanId,
        TraceSpanStatus.ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }
}

export default DistributedTracingService;

