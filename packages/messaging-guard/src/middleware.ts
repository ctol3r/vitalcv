import { Request, Response, NextFunction } from 'express';
import { MessagingGuard } from './guard';
import { SinkConfig, AuditEvent } from './types';
import { randomUUID } from 'crypto';

/**
 * Express middleware for message-level intent binding
 */
export interface GuardMiddlewareOptions extends SinkConfig {
  /** Function to emit audit events */
  emitAudit?: (event: AuditEvent) => void | Promise<void>;
  /** Extract envelope from request (default: from body) */
  extractEnvelope?: (req: Request) => { sink: string; signature?: string; payload: unknown; allowed_sinks?: string[]; audience?: string | string[] };
  /** Environment for env-scoped enforcement */
  environment?: string;
  /** Whether audience claim is required (default: true, fail closed) */
  requireAudience?: boolean;
}

export function createGuardMiddleware(options: GuardMiddlewareOptions) {
  const guard = new MessagingGuard({
    allowedSinks: options.allowedSinks,
    publicKey: options.publicKey,
    requireSignature: options.requireSignature,
    environment: options.environment,
    requireAudience: options.requireAudience,
  });

  const emitAudit = options.emitAudit || (() => {});

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || randomUUID();

    try {
      // Extract envelope from request
      const extractFn = options.extractEnvelope || ((req: Request) => {
        const body = req.body || {};
        const audienceHeader = req.headers['x-audience'] as string;
        const audience = body.audience || (audienceHeader ? audienceHeader.split(',').map(s => s.trim()) : undefined);
        return {
          sink: body.sink || req.headers['x-sink-id'] as string,
          signature: body.signature || req.headers['x-signature'] as string,
          payload: body.payload || body,
          allowed_sinks: body.allowed_sinks || (req.headers['x-allowed-sinks'] as string)?.split(',').filter(Boolean),
          audience: audience,
        };
      });

      const envelope = extractFn(req);

      if (!envelope.sink) {
        const event: AuditEvent = {
          type: 'MESSAGE_DENIED',
          sink: 'unknown',
          reason: 'Missing sink ID in request',
          timestamp: Date.now(),
          requestId,
        };
        await emitAudit(event);
        return res.status(403).json({
          error: 'MESSAGE_DENIED',
          reason: 'Missing sink ID',
          requestId,
        });
      }

      // Verify message
      const result = await guard.verify(envelope);

      // Create audit event
      const auditEvent = guard.createAuditEvent(result, requestId);
      await emitAudit(auditEvent);

      if (!result.allowed) {
        return res.status(403).json({
          error: 'MESSAGE_DENIED',
          reason: result.reason,
          sink: result.sink,
          requestId,
        });
      }

      // Attach verified envelope to request
      (req as any).verifiedEnvelope = envelope;
      (req as any).requestId = requestId;

      next();
    } catch (error) {
      const event: AuditEvent = {
        type: 'MESSAGE_DENIED',
        sink: 'unknown',
        reason: `Guard error: ${error instanceof Error ? error.message : 'unknown error'}`,
        timestamp: Date.now(),
        requestId,
      };
      await emitAudit(event);
      return res.status(500).json({
        error: 'GUARD_ERROR',
        reason: error instanceof Error ? error.message : 'unknown error',
        requestId,
      });
    }
  };
}

