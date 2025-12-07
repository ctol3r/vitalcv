/**
 * Idempotency Middleware
 * Tagged: cursor-batch-1107 (Task 0004)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Prevents duplicate VC creation on retry using idempotency keys
 * Stores results in Redis with TTL
 */

import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import { log } from '../lib/logging';
import { createProblemDetail } from '../lib/http/errors';

// ============================================================================
// REDIS CLIENT
// ============================================================================

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = createClient({ url });
    await redisClient.connect();
  }
  return redisClient;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface IdempotencyConfig {
  headerName: string;        // Header containing idempotency key
  ttlSeconds: number;        // How long to store results
  keyPrefix: string;         // Redis key prefix
  enforceOnMethods: string[]; // HTTP methods to enforce idempotency
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  headerName: 'Idempotency-Key',
  ttlSeconds: 86400, // 24 hours
  keyPrefix: 'idempotency:',
  enforceOnMethods: ['POST', 'PUT'],
};

// ============================================================================
// TYPES
// ============================================================================

interface StoredResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Idempotency middleware factory
 * Checks if request has been processed before and returns cached result
 *
 * @param config - Idempotency configuration
 * @returns Express middleware
 */
export function createIdempotencyMiddleware(config: Partial<IdempotencyConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only enforce on specified methods
    if (!fullConfig.enforceOnMethods.includes(req.method)) {
      return next();
    }

    // Get idempotency key from header
    const idempotencyKey = req.headers[fullConfig.headerName.toLowerCase()] as string;

    if (!idempotencyKey) {
      // No idempotency key provided - proceed normally
      return next();
    }

    // Validate idempotency key format
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return res.status(400).json(
        createProblemDetail(
          400,
          'E_IDEMPOTENCY_KEY_INVALID',
          'Invalid Idempotency Key',
          'Idempotency key must be a valid UUID or base64 string (min 16 chars)',
          { requestId: req.id },
        ),
      );
    }

    const redis = await getRedisClient();
    const redisKey = `${fullConfig.keyPrefix}${idempotencyKey}`;

    try {
      // Check if we've seen this key before
      const cached = await redis.get(redisKey);

      if (cached) {
        // We've processed this request before - return cached response
        const storedResponse: StoredResponse = JSON.parse(cached);

        log.info('Idempotency hit - returning cached response', {
          requestId: req.id,
          idempotencyKey,
          originalTimestamp: storedResponse.timestamp,
          age: Date.now() - storedResponse.timestamp,
        });

        // Set response headers
        Object.entries(storedResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        // Add idempotency-specific headers
        res.setHeader('X-Idempotency-Hit', 'true');
        res.setHeader('X-Idempotency-Original-Timestamp', storedResponse.timestamp.toString());

        // Return cached response
        return res.status(storedResponse.status).json(storedResponse.body);
      }

      // First time seeing this key - process request and cache result
      log.info('Idempotency miss - processing request', {
        requestId: req.id,
        idempotencyKey,
      });

      // Intercept response to cache it
      const originalSend = res.send;
      res.send = function (data: any) {
        // Only cache successful responses (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const responseToStore: StoredResponse = {
            status: res.statusCode,
            headers: {
              'Content-Type': res.getHeader('Content-Type') as string,
              'X-Request-ID': res.getHeader('X-Request-ID') as string,
            },
            body: typeof data === 'string' ? JSON.parse(data) : data,
            timestamp: Date.now(),
          };

          // Store in Redis with TTL
          redis
            .setEx(redisKey, fullConfig.ttlSeconds, JSON.stringify(responseToStore))
            .then(() => {
              log.info('Idempotency response cached', {
                requestId: req.id,
                idempotencyKey,
                ttl: fullConfig.ttlSeconds,
              });
            })
            .catch((error) => {
              log.error('Failed to cache idempotency response', {
                requestId: req.id,
                idempotencyKey,
                error: error.message,
              });
            });
        }

        // Call original send
        return originalSend.call(this, data);
      };

      next();
    } catch (error: any) {
      log.error('Idempotency middleware error', {
        requestId: req.id,
        idempotencyKey,
        error: error.message,
      });

      // Don't block request on Redis errors - proceed without idempotency
      next();
    }
  };
}

/**
 * Validate idempotency key format
 * Should be a UUID or base64 string (min 16 chars for sufficient entropy)
 */
function isValidIdempotencyKey(key: string): boolean {
  // UUID format (with or without hyphens)
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (uuidRegex.test(key)) {
    return true;
  }

  // Base64 string with minimum length
  if (key.length >= 16 && /^[A-Za-z0-9+/=_-]+$/.test(key)) {
    return true;
  }

  return false;
}

/**
 * Generate a new idempotency key (helper for clients)
 */
export function generateIdempotencyKey(): string {
  // Generate UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Default idempotency middleware for issuer endpoints
 */
export const issuerIdempotencyMiddleware = createIdempotencyMiddleware({
  headerName: 'Idempotency-Key',
  ttlSeconds: 86400, // 24 hours
  keyPrefix: 'idempotency:issuer:',
  enforceOnMethods: ['POST'],
});

export default createIdempotencyMiddleware;

