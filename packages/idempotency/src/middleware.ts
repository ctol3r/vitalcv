/**
 * Idempotency Express Middleware
 *
 * Prevents duplicate processing of mutating requests.
 * Only applies to POST, PUT, PATCH, DELETE methods.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { IdempotencyStore, IdempotencyRecord } from './types';

// UUID v4 regex pattern
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate if a string is a valid UUID v4
 */
function isValidUUID(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

/**
 * Check if HTTP method is a mutation
 */
function isMutationMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export interface IdempotencyMiddlewareOptions {
  /**
   * Idempotency store instance
   */
  store: IdempotencyStore;

  /**
   * TTL for idempotency records in seconds
   * Default: 86400 (24 hours)
   */
  ttlSeconds?: number;

  /**
   * Header name for idempotency key
   * Default: 'idempotency-key'
   */
  headerName?: string;

  /**
   * Whether to skip idempotency for certain requests
   * Default: never skip
   */
  skip?: (req: Request) => boolean;
}

/**
 * Create idempotency middleware
 *
 * Usage:
 * ```typescript
 * const store = new InMemoryIdempotencyStore();
 *
 * app.use(idempotencyMiddleware({ store }));
 * ```
 *
 * @param options - Middleware options
 * @returns Express middleware
 */
export function idempotencyMiddleware(options: IdempotencyMiddlewareOptions): RequestHandler {
  const {
    store,
    ttlSeconds = 86400, // 24 hours default
    headerName = 'idempotency-key',
    skip,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if should skip
      if (skip && skip(req)) {
        return next();
      }

      // Only apply to mutation methods
      if (!isMutationMethod(req.method)) {
        return next();
      }

      // Extract idempotency key from header
      const headerValue = req.headers[headerName.toLowerCase()];
      const idempotencyKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

      // If no idempotency key provided, proceed without idempotency
      if (!idempotencyKey) {
        return next();
      }

      // Validate UUID format
      if (!isValidUUID(idempotencyKey)) {
        res.status(400).json({
          error: 'invalid_idempotency_key',
          message: 'Idempotency-Key must be a valid UUID v4',
        });
        return;
      }

      // Check if we've seen this key before
      const existingRecord = await store.get(idempotencyKey);

      if (existingRecord) {
        // Duplicate request detected - return cached response with 409
        res.status(409)
          .set(existingRecord.headers)
          .json({
            error: 'duplicate_request',
            message: 'Request with this idempotency key has already been processed',
            original_request_id: existingRecord.request_id,
            result: existingRecord.response_body,
          });
        return;
      }

      // First time seeing this key - intercept the response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalStatus = res.status.bind(res);
      const originalSetHeader = res.setHeader.bind(res);

      let capturedStatusCode = 200;
      let capturedHeaders: Record<string, string | string[]> = {};
      let capturedBody: any = null;

      // Override status() to capture status code
      res.status = function(code: number) {
        capturedStatusCode = code;
        return originalStatus(code);
      };

      // Override setHeader() to capture headers
      res.setHeader = function(name: string, value: string | number | readonly string[]) {
        capturedHeaders[name] = value as string | string[];
        return originalSetHeader(name, value);
      };

      // Override json() to capture body
      res.json = function(body: any) {
        capturedBody = body;

        // Only store successful responses (2xx)
        if (capturedStatusCode >= 200 && capturedStatusCode < 300) {
          const requestId = (req as any).requestId || 'unknown';

          const record: IdempotencyRecord = {
            request_id: requestId,
            status_code: capturedStatusCode,
            headers: capturedHeaders,
            response_body: body,
            created_at: Date.now(),
            expires_at: Date.now() + ttlSeconds * 1000,
          };

          // Store in background (don't await to avoid delaying response)
          store.set(idempotencyKey, record, ttlSeconds).catch((error) => {
            console.error('[Idempotency] Failed to store record:', error);
          });
        }

        return originalJson(body);
      };

      // Override send() as fallback
      res.send = function(body: any) {
        capturedBody = body;

        // Only store successful responses (2xx)
        if (capturedStatusCode >= 200 && capturedStatusCode < 300) {
          const requestId = (req as any).requestId || 'unknown';

          const record: IdempotencyRecord = {
            request_id: requestId,
            status_code: capturedStatusCode,
            headers: capturedHeaders,
            response_body: body,
            created_at: Date.now(),
            expires_at: Date.now() + ttlSeconds * 1000,
          };

          // Store in background (don't await to avoid delaying response)
          store.set(idempotencyKey, record, ttlSeconds).catch((error) => {
            console.error('[Idempotency] Failed to store record:', error);
          });
        }

        return originalSend(body);
      };

      // Proceed with request
      next();
    } catch (error) {
      // On idempotency error, fail open (allow request)
      console.error('[Idempotency] Error in middleware:', error);
      next();
    }
  };
}
