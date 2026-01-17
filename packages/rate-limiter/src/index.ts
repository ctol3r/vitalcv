/**
 * @chai-vc/rate-limiter
 *
 * Rate limiting middleware with in-memory and Redis backends
 * for chai-vc platform services.
 *
 * MODE-AWARE:
 * - TEST/DEV: Use InMemoryRateLimiter
 * - PROD: Use RedisRateLimiter with Redis client
 */

export type {
  RateLimiter,
  RateLimiterConfig,
  RateLimitResult,
} from './types';

export { InMemoryRateLimiter } from './inMemory';
export { RedisRateLimiter, type RedisClientLike } from './redis';

export {
  rateLimitMiddleware,
  perEndpointRateLimitMiddleware,
  defaultClientIdExtractor,
  apiKeyClientIdExtractor,
  userIdClientIdExtractor,
  type RateLimitMiddlewareOptions,
} from './middleware';
