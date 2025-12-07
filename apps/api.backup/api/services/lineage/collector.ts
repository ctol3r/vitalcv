/**
 * B228A-LIN-002: LineageCollector
 *
 * Intercepts CRUD operations across services (credentials, reputation, finance) via middleware.
 * Records lineage entries with full context. Supports asynchronous logging.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OperationType } from '@prisma/client';
import { DataLineageService, CreateDataLineageInput } from './models/DataLineage';

const prisma = new PrismaClient();
const lineageService = new DataLineageService(prisma);

export interface LineageContext {
  sourceSystem: string;
  sourceRecordId?: string;
  targetRecordId?: string;
  operationType: OperationType;
  operatorId?: string;
  transformationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Queue for asynchronous lineage logging
 */
class LineageQueue {
  private queue: CreateDataLineageInput[] = [];
  private processing = false;
  private readonly batchSize = 10;
  private readonly flushInterval = 5000; // 5 seconds

  constructor() {
    // Start periodic flush
    setInterval(() => this.flush(), this.flushInterval);
  }

  /**
   * Add lineage entry to queue
   */
  enqueue(entry: CreateDataLineageInput): void {
    this.queue.push(entry);

    // Flush if batch size reached
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush queue asynchronously
   */
  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await Promise.all(
        batch.map((entry) => lineageService.createLineage(entry))
      );
    } catch (error) {
      console.error('Error flushing lineage queue:', error);
      // Re-queue failed entries
      this.queue.unshift(...batch);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Force flush all pending entries
   */
  async flushAll(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flush();
    }
  }
}

const lineageQueue = new LineageQueue();

/**
 * Extract record ID from request
 */
function extractRecordId(req: Request): string | undefined {
  // Try various common patterns
  return (
    req.params.id ||
    req.params.recordId ||
    req.body.id ||
    req.body.recordId ||
    req.query.id ||
    req.query.recordId
  );
}

/**
 * Extract source system from request path
 */
function extractSourceSystem(req: Request): string {
  const path = req.path || req.url || '';

  // Extract service name from path patterns like /api/credentials, /api/reputation, etc.
  const match = path.match(/\/api\/([^\/]+)/);
  if (match) {
    return match[1];
  }

  // Fallback to route name if available
  if (req.route?.path) {
    const routeMatch = req.route.path.match(/\/([^\/]+)/);
    if (routeMatch) {
      return routeMatch[1];
    }
  }

  return 'unknown';
}

/**
 * Determine operation type from HTTP method
 */
function getOperationType(method: string): OperationType {
  switch (method.toUpperCase()) {
    case 'POST':
      return OperationType.CREATE;
    case 'PUT':
    case 'PATCH':
      return OperationType.UPDATE;
    case 'DELETE':
      return OperationType.DELETE;
    default:
      return OperationType.UPDATE;
  }
}

/**
 * Extract operator ID from request
 */
function extractOperatorId(req: Request): string | undefined {
  // Try various common patterns for user identification
  return (
    (req as any).user?.id ||
    req.headers['x-user-id'] ||
    req.body.userId ||
    req.body.operatorId ||
    req.query.userId
  );
}

/**
 * Extract transformation ID from request metadata
 */
function extractTransformationId(req: Request): string | undefined {
  return (
    req.headers['x-transformation-id'] ||
    req.body.transformationId ||
    req.query.transformationId
  );
}

/**
 * Middleware to collect lineage for CRUD operations
 */
export function lineageCollectorMiddleware(
  options?: {
    sourceSystem?: string;
    enabled?: boolean;
  }
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip if disabled
    if (options?.enabled === false) {
      return next();
    }

    // Only track CRUD operations
    const method = req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next();
    }

    // Extract context
    const sourceSystem = options?.sourceSystem || extractSourceSystem(req);
    const sourceRecordId = extractRecordId(req);
    const operationType = getOperationType(method);
    const operatorId = extractOperatorId(req);
    const transformationId = extractTransformationId(req);

    // If no record ID, skip
    if (!sourceRecordId) {
      return next();
    }

    // Capture response to get target record ID
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Extract target record ID from response
      const targetRecordId = body?.id || body?.data?.id || sourceRecordId;

      // Build metadata
      const metadata: Record<string, unknown> = {
        method,
        path: req.path,
        statusCode: res.statusCode,
        requestId: req.headers['x-request-id'] || req.headers['x-correlation-id'],
      };

      // Add chain/network info if available
      if (req.body.chainId) {
        metadata.chainId = req.body.chainId;
      }
      if (req.body.network) {
        metadata.network = req.body.network;
      }

      // Queue lineage entry asynchronously
      lineageQueue.enqueue({
        sourceSystem,
        sourceRecordId,
        targetRecordId: targetRecordId || sourceRecordId,
        operationType,
        operatorId: operatorId || undefined,
        transformationId: transformationId || undefined,
        metadata,
      });

      return originalJson(body);
    };

    next();
  };
}

/**
 * Synchronously record lineage entry (for critical operations)
 */
export async function recordLineageSync(context: LineageContext): Promise<void> {
  await lineageService.createLineage({
    sourceSystem: context.sourceSystem,
    sourceRecordId: context.sourceRecordId || '',
    targetRecordId: context.targetRecordId || context.sourceRecordId || '',
    operationType: context.operationType,
    operatorId: context.operatorId,
    transformationId: context.transformationId,
    metadata: context.metadata,
  });
}

/**
 * Asynchronously record lineage entry (for non-critical operations)
 */
export function recordLineageAsync(context: LineageContext): void {
  lineageQueue.enqueue({
    sourceSystem: context.sourceSystem,
    sourceRecordId: context.sourceRecordId || '',
    targetRecordId: context.targetRecordId || context.sourceRecordId || '',
    operationType: context.operationType,
    operatorId: context.operatorId,
    transformationId: context.transformationId,
    metadata: context.metadata,
  });
}

/**
 * Flush all pending lineage entries (useful for graceful shutdown)
 */
export async function flushLineageQueue(): Promise<void> {
  await lineageQueue.flushAll();
}

