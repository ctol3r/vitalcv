import './tracing';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createHash } from 'crypto';
import net from 'net';
import { MessagingGuard, AuditEvent } from '@vitalcv/messaging-guard';
import { allowedSinksEnforcer } from './middleware/allowedSinksEnforcer';
import { RouterDenyCode, getDenyReason, mapReasonToCode, DENY_REASON_CATALOG } from './deny-reasons';
import { createLogger } from '@chai-vc/logging-core';
import { requestIdMiddleware } from './middleware/requestId';

const log = createLogger({
  service: process.env.SERVICE_NAME || 'router-api',
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware());

// B93-SEC-001: Enforce allowed_sinks on all inbound routes (repo-wide)
// Apply middleware to all routes except health checks and selected read-only endpoints
app.use((req, res, next) => {
  // Skip health checks and read-only query endpoints
  const isHealth = req.path === '/health';
  const isDlqRead = req.method === 'GET' && req.path.startsWith('/router/dlq');
  const isAuditRead = req.method === 'GET' && (req.path.startsWith('/router/audit') || req.path === '/audit/summary');
  const isBuildInfoRead = req.method === 'GET' && req.path === '/build-info';
  if (isHealth || isDlqRead || isAuditRead || isBuildInfoRead) {
    return next();
  }
  return allowedSinksEnforcer(req, res, next);
});

// Dead-letter queue storage (in production, use Redis/Kafka)
interface DLQEntry {
  id: string;
  sink: string;
  reason: string;
  hashAnchor: string;
  receiptHash: string; // Failure receipt hash
  timestamp: number;
  payload: unknown;
  metadata?: {
    requestId?: string;
    source?: string;
    retryCount?: number;
  };
}

const deadLetterQueue: DLQEntry[] = [];

/**
 * Compute hash anchor for audit trail
 */
function computeHashAnchor(sink: string, payload: unknown, timestamp: number): string {
  const data = JSON.stringify({ sink, payload, timestamp });
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute failure receipt hash
 */
function computeFailureReceipt(sink: string, reason: string, hashAnchor: string, timestamp: number): string {
  const receipt = {
    sink,
    reason,
    hashAnchor,
    timestamp,
    type: 'DLQ_RECEIPT',
  };
  return createHash('sha256').update(JSON.stringify(receipt)).digest('hex');
}

/**
 * Emit audit event (in production, send to audit service)
 */
async function emitAudit(event: AuditEvent & { hashAnchor?: string }) {
  log.info('Audit event', { event });

  // If message was denied, also log to dead-letter queue
  if (event.type === 'MESSAGE_DENIED' || event.type === 'SINK_NOT_ALLOWED' || event.type === 'SIGNATURE_INVALID') {
    const hashAnchor = event.hashAnchor || computeHashAnchor(event.sink, {}, event.timestamp);
    const receiptHash = computeFailureReceipt(event.sink, event.reason || 'Unknown', hashAnchor, event.timestamp);

    deadLetterQueue.push({
      id: event.requestId || `dlq-${Date.now()}`,
      sink: event.sink,
      reason: event.reason || 'Unknown',
      hashAnchor,
      receiptHash,
      timestamp: event.timestamp,
      payload: {}, // In production, store actual payload
      metadata: {
        requestId: event.requestId,
        source: 'router',
        retryCount: 0,
      },
    });
  }

  // TODO: Emit to audit service
}

/**
 * Router guard - checks all incoming messages
 */
const routerGuard = new MessagingGuard({
  allowedSinks: process.env.ROUTER_ALLOWED_SINKS?.split(',') || [
    'svc.issuer-api',
    'svc.verifier-api',
    'svc.trust-registry',
    'svc.audit-log',
    'etl.fhir-gateway',
  ],
  requireSignature: process.env.MESSAGING_GUARD_REQUIRE_SIGNATURE !== 'false',
  publicKey: process.env.MESSAGING_GUARD_PUBLIC_KEY,
  environment: process.env.NODE_ENV || 'development', // Env-scoped enforcement
});

/**
 * Router middleware - enforces guard and handles dead-letter queue
 */
app.post('/route', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}`;

  try {
    const envelope = {
      sink: req.body.sink || req.headers['x-sink-id'] as string,
      signature: req.body.signature || req.headers['x-signature'] as string,
      payload: req.body.payload || req.body,
      timestamp: Date.now(),
    };

    if (!envelope.sink) {
      const denyCode = RouterDenyCode.MISSING_SINK_ID;
      const denyReason = getDenyReason(denyCode);
      const hashAnchor = computeHashAnchor('unknown', envelope.payload, envelope.timestamp);
      const auditEvent: AuditEvent & { hashAnchor: string } = {
        type: 'MESSAGE_DENIED',
        sink: 'unknown',
        reason: denyReason.message,
        timestamp: envelope.timestamp,
        requestId,
        hashAnchor,
      };
      await emitAudit(auditEvent);

      return res.status(denyReason.httpStatus).json({
        error: 'ROUTER_DENY',
        code: denyCode,
        reason: denyReason.message,
        description: denyReason.description,
        requestId,
        hashAnchor,
        retryable: denyReason.retryable,
        clientActionable: denyReason.clientActionable,
      });
    }

    // Verify message with guard
    const result = await routerGuard.verify(envelope);

    // Create audit event with hash anchor
    const hashAnchor = computeHashAnchor(envelope.sink, envelope.payload, envelope.timestamp);
    const auditEvent = routerGuard.createAuditEvent(result, requestId);
    (auditEvent as any).hashAnchor = hashAnchor;

    await emitAudit(auditEvent as AuditEvent & { hashAnchor: string });

    if (!result.allowed) {
      const denyCode = mapReasonToCode(result.reason);
      const denyReason = getDenyReason(denyCode);
      return res.status(denyReason.httpStatus).json({
        error: 'ROUTER_DENY',
        code: denyCode,
        reason: denyReason.message,
        description: denyReason.description,
        sink: result.sink,
        requestId,
        hashAnchor,
        retryable: denyReason.retryable,
        clientActionable: denyReason.clientActionable,
      });
    }

    // Message allowed - route to destination
    // TODO: Implement actual routing logic
    res.json({
      status: 'routed',
      sink: envelope.sink,
      requestId,
      hashAnchor,
    });
  } catch (error) {
    const denyCode = RouterDenyCode.ROUTER_ERROR;
    const denyReason = getDenyReason(denyCode);
    const hashAnchor = computeHashAnchor('unknown', {}, Date.now());
    const auditEvent: AuditEvent & { hashAnchor: string } = {
      type: 'MESSAGE_DENIED',
      sink: 'unknown',
      reason: denyReason.message,
      timestamp: Date.now(),
      requestId,
      hashAnchor,
    };
    await emitAudit(auditEvent);

    return res.status(denyReason.httpStatus).json({
      error: 'ROUTER_DENY',
      code: denyCode,
      reason: denyReason.message,
      description: denyReason.description,
      details: error instanceof Error ? error.message : 'unknown error',
      requestId,
      hashAnchor,
      retryable: denyReason.retryable,
      clientActionable: denyReason.clientActionable,
    });
  }
});

/**
 * Dead-letter queue endpoint
 * GET /router/dlq
 */
app.get('/router/dlq', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({
    count: deadLetterQueue.length,
    items: deadLetterQueue.slice(-limit).map(item => ({
      id: item.id,
      sink: item.sink,
      reason: item.reason,
      hashAnchor: item.hashAnchor,
      receiptHash: item.receiptHash,
      timestamp: item.timestamp,
      metadata: item.metadata,
    })),
  });
});

/**
 * Get failure receipt by ID
 * GET /router/dlq/:id/receipt
 */
app.get('/router/dlq/:id/receipt', (req: Request, res: Response) => {
  const entry = deadLetterQueue.find(item => item.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'DLQ entry not found' });
  }

  res.json({
    id: entry.id,
    receiptHash: entry.receiptHash,
    hashAnchor: entry.hashAnchor,
    reason: entry.reason,
    sink: entry.sink,
    timestamp: entry.timestamp,
  });
});

/**
 * B95B-SEC-002: Get receipt by ID
 * GET /router/receipts/:id
 *
 * Returns receipt with hash, reason, and timestamp for denied messages.
 */
app.get('/router/receipts/:id', (req: Request, res: Response) => {
  const receiptId = req.params.id;

  // Try to find by receipt hash first
  let entry = deadLetterQueue.find(item => item.receiptHash === receiptId);

  // If not found by receipt hash, try by entry ID
  if (!entry) {
    entry = deadLetterQueue.find(item => item.id === receiptId);
  }

  if (!entry) {
    return res.status(404).json({
      error: 'Receipt not found',
      receiptId,
    });
  }

  // B95B-SEC-002: Return receipt with hash, reason, and timestamp
  res.json({
    id: entry.id,
    receiptHash: entry.receiptHash,
    hashAnchor: entry.hashAnchor,
    reason: entry.reason,
    sink: entry.sink,
    timestamp: entry.timestamp,
    metadata: entry.metadata,
  });
});

/**
 * Audit anchors endpoint
 * GET /router/audit/anchors
 */
app.get('/router/audit/anchors', (req: Request, res: Response) => {
  // Return hash anchors from dead-letter queue
  const anchors = deadLetterQueue.map(item => ({
    id: item.id,
    hashAnchor: item.hashAnchor,
    sink: item.sink,
    timestamp: item.timestamp,
    reason: item.reason,
  }));

  res.json({
    anchors,
    count: anchors.length,
  });
});

/**
 * B98C-SEC-001: Get deny reason catalog
 * GET /router/deny-reasons
 *
 * Returns the complete catalog of standardized deny reason codes with metadata.
 */
app.get('/router/deny-reasons', (req: Request, res: Response) => {
  res.json({
    catalog: DENY_REASON_CATALOG,
    codes: Object.values(RouterDenyCode),
    version: '1.0.0',
  });
});

/**
 * B98C-SEC-001: Get specific deny reason by code
 * GET /router/deny-reasons/:code
 */
app.get('/router/deny-reasons/:code', (req: Request, res: Response) => {
  const code = req.params.code as RouterDenyCode;

  const reason = getDenyReason(code);
  if (!reason) {
    return res.status(404).json({
      error: 'Deny reason not found',
      code,
    });
  }

  res.json(reason);
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'router' });
});

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  log.info('Router listening', { port: PORT });
});

export default app;

