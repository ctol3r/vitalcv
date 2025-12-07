/**
 * B119A-ALLOWED-004: allowed_sinks middleware enforcement
 * B97A-SEC-001: Repo-wide allowed_sinks + detached JWS enforcer
 *
 * Shared middleware implementation for all apps
 *
 * Requirements:
 * - Missing/invalid allowed_sinks → 403
 * - Deny emits DLQ receipt + anchor
 * - AuditScrapbook event recorded for deny events
 * - Detached JWS verification enforced
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { createGuardMiddleware } from './middleware';
import { AuditEvent } from './types';
import { computeHashAnchor, emitAuditDeny } from './dlq';

/**
 * Extract envelope from request
 */
function extractEnvelope(req: Request): {
  sink: string;
  signature?: string;
  payload: unknown;
  allowed_sinks?: string[];
} {
  const body = req.body || {};
  return {
    sink: body.sink || req.headers['x-sink-id'] as string || '',
    signature: body.signature || req.headers['x-signature'] as string,
    payload: body.payload || body,
    allowed_sinks: body.allowed_sinks ||
      (req.headers['x-allowed-sinks'] as string)?.split(',').filter(Boolean),
  };
}

/**
 * Create allowed_sinks enforcer middleware
 *
 * B97A-SEC-001: Enforces that all inbound requests include allowed_sinks.
 * If allowed_sinks is missing or invalid, the request is denied with 403.
 * Deny events emit DLQ receipt + anchor.
 */
export function createAllowedSinksEnforcer(options: {
  allowedSinks: string[];
  requireSignature?: boolean;
  publicKey?: string;
  environment?: string;
  requireAudience?: boolean;
}) {
  const guardMiddleware = createGuardMiddleware({
    allowedSinks: options.allowedSinks,
    requireSignature: options.requireSignature,
    publicKey: options.publicKey,
    environment: options.environment || process.env.NODE_ENV || 'development',
    requireAudience: options.requireAudience,
    emitAudit: async (event: AuditEvent) => {
      // For deny events, emit to DLQ with anchor
      if (event.type === 'MESSAGE_DENIED' || event.type === 'SIGNATURE_INVALID' || event.type === 'SINK_NOT_ALLOWED') {
        const hashAnchor = computeHashAnchor(
          event.sink,
          {},
          event.timestamp
        );
        await emitAuditDeny(
          event.sink,
          event.reason || 'Message denied',
          hashAnchor,
          event.requestId || randomUUID()
        );
      }
    },
    extractEnvelope,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || randomUUID();

    // Extract envelope to check for allowed_sinks
    const envelope = extractEnvelope(req);

    // CRITICAL: Enforce that allowed_sinks is present
    // B119A-ALLOWED-004: Missing/invalid allowed_sinks → 403 + AuditScrapbook event
    if (!envelope.allowed_sinks || envelope.allowed_sinks.length === 0) {
      const timestamp = Date.now();
      const sink = envelope.sink || 'unknown';
      const hashAnchor = computeHashAnchor(sink, envelope.payload, timestamp);

      // Emit to DLQ with receipt + anchor
      const receipt = await emitAuditDeny(
        sink,
        'Missing allowed_sinks',
        hashAnchor,
        requestId,
        envelope.payload
      );

      // B119A-ALLOWED-004: Record AuditScrapbook event
      try {
        // Try to import AuditScrapbook if available
        const { AuditScrapbook } = await import('../../../backend/src/blockchain/audit_scrapbook').catch(() => ({ AuditScrapbook: null }));
        if (AuditScrapbook) {
          const scrapbook = new AuditScrapbook();
          await scrapbook.recordEvent({
            type: 'MESSAGE_DENIED',
            sink,
            reason: 'Missing allowed_sinks',
            hashAnchor,
            requestId,
            timestamp: new Date(timestamp),
            payload: envelope.payload,
          });
        }
      } catch (error) {
        // AuditScrapbook not available or failed - log but don't fail request
        console.warn('[MessagingGuard] Failed to record AuditScrapbook event:', error);
      }

      return res.status(403).json({
        error: 'MESSAGE_DENIED',
        reason: 'Request missing allowed_sinks',
        sink,
        requestId,
        hashAnchor,
        receiptId: receipt.receiptId,
      });
    }

    // B119A-ALLOWED-004: Enforce detached JWS if required + AuditScrapbook event
    if (options.requireSignature !== false && !envelope.signature) {
      const timestamp = Date.now();
      const sink = envelope.sink || 'unknown';
      const hashAnchor = computeHashAnchor(sink, envelope.payload, timestamp);

      // Emit to DLQ with receipt + anchor
      const receipt = await emitAuditDeny(
        sink,
        'Missing detached JWS signature',
        hashAnchor,
        requestId,
        envelope.payload
      );

      // B119A-ALLOWED-004: Record AuditScrapbook event
      try {
        const { AuditScrapbook } = await import('../../../backend/src/blockchain/audit_scrapbook').catch(() => ({ AuditScrapbook: null }));
        if (AuditScrapbook) {
          const scrapbook = new AuditScrapbook();
          await scrapbook.recordEvent({
            type: 'SIGNATURE_INVALID',
            sink,
            reason: 'Missing detached JWS signature',
            hashAnchor,
            requestId,
            timestamp: new Date(timestamp),
            payload: envelope.payload,
          });
        }
      } catch (error) {
        console.warn('[MessagingGuard] Failed to record AuditScrapbook event:', error);
      }

      return res.status(403).json({
        error: 'MESSAGE_DENIED',
        reason: 'Detached JWS signature required but not provided',
        sink,
        requestId,
        hashAnchor,
        receiptId: receipt.receiptId,
      });
    }

    // If allowed_sinks is present, use the guard middleware for full validation
    return guardMiddleware(req, res, next);
  };
}

