/**
 * @chai-vc/idempotency
 *
 * Idempotency middleware with in-memory and Redis backends
 * for chai-vc platform services.
 *
 * MODE-AWARE:
 * - TEST/DEV: Use InMemoryIdempotencyStore
 * - PROD: Use RedisIdempotencyStore with Redis client
 */

export type {
  IdempotencyStore,
  IdempotencyRecord,
} from './types';

export { InMemoryIdempotencyStore } from './inMemory';
export { RedisIdempotencyStore, type RedisClientLike } from './redis';

export {
  idempotencyMiddleware,
  type IdempotencyMiddlewareOptions,
} from './middleware';
