/**
 * Rate Limiting Middleware
 *
 * Implements token bucket algorithm with Redis backing for distributed rate limiting.
 * Falls back to in-memory storage for development.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/oidc4vci/storage'

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Custom key generator function (default: uses IP) */
  keyGenerator?: (request: NextRequest) => string
  /** Custom handler for rate limit exceeded */
  onLimitExceeded?: (request: NextRequest) => NextResponse
  /** Skip rate limiting for certain requests */
  skip?: (request: NextRequest) => boolean
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for development
const inMemoryStore = new Map<string, RateLimitEntry>()

/**
 * Default key generator - uses client IP address
 */
function defaultKeyGenerator(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() :
    request.headers.get('x-real-ip') ||
    'unknown'
  return ip
}

/**
 * Default handler for rate limit exceeded
 */
function defaultLimitExceededHandler(_request: NextRequest, retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again later.',
      retry_after_ms: retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil(retryAfter / 1000).toString(),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + retryAfter).toISOString(),
      },
    }
  )
}

/**
 * Get rate limit entry from Redis or in-memory store
 */
async function getEntry(key: string): Promise<RateLimitEntry | null> {
  const redisClient = getRedisClient()

  if (redisClient) {
    try {
      const data = await redisClient.get(`ratelimit:${key}`)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('[RateLimit] Redis get error:', error)
      // Fall through to in-memory
    }
  }

  return inMemoryStore.get(key) || null
}

/**
 * Set rate limit entry in Redis or in-memory store
 */
async function setEntry(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
  const redisClient = getRedisClient()

  if (redisClient) {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000)
      await redisClient.setEx(`ratelimit:${key}`, ttlSeconds, JSON.stringify(entry))
      return
    } catch (error) {
      console.error('[RateLimit] Redis set error:', error)
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  inMemoryStore.set(key, entry)
  setTimeout(() => inMemoryStore.delete(key), ttlMs)
}

/**
 * Increment rate limit counter
 */
async function incrementEntry(key: string, windowMs: number, maxRequests: number): Promise<{
  allowed: boolean
  remaining: number
  resetTime: number
}> {
  const now = Date.now()
  let entry = await getEntry(key)

  // Initialize or reset if window expired
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    }
    await setEntry(key, entry, windowMs)
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: entry.resetTime,
    }
  }

  // Increment counter
  entry.count++
  const ttlMs = entry.resetTime - now
  await setEntry(key, entry, ttlMs)

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetTime: entry.resetTime,
  }
}

/**
 * Rate limiting middleware factory
 *
 * @example
 * ```ts
 * export const POST = rateLimit({
 *   maxRequests: 10,
 *   windowMs: 60 * 1000, // 1 minute
 * })(async (request) => {
 *   // Your handler logic
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    onLimitExceeded = defaultLimitExceededHandler,
    skip,
  } = config

  return function (handler: (request: NextRequest, context?: any) => Promise<NextResponse>) {
    return async function rateLimitedHandler(request: NextRequest, context?: any): Promise<NextResponse> {
      // Skip rate limiting if configured
      if (skip && skip(request)) {
        return handler(request, context)
      }

      const key = keyGenerator(request)
      const result = await incrementEntry(key, windowMs, maxRequests)

      // Add rate limit headers to all responses
      const headers = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      }

      // Check if limit exceeded
      if (!result.allowed) {
        const retryAfter = result.resetTime - Date.now()
        const response = onLimitExceeded(request, retryAfter)

        // Add headers to error response
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })

        return response
      }

      // Execute handler
      const response = await handler(request, context)

      // Add rate limit headers to successful response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }
  }
}

/**
 * Preset rate limit configurations for common use cases
 */
export const RateLimitPresets = {
  /** 10 requests per minute - for credential offer generation */
  OFFER: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  /** 5 requests per minute - for token exchange */
  TOKEN: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  /** 20 requests per minute - for credential requests */
  CREDENTIAL: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  },
  /** 30 requests per minute - for nonce generation */
  NONCE: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  /** 15 requests per minute - for verification */
  VERIFY: {
    maxRequests: 15,
    windowMs: 60 * 1000,
  },
  /** 100 requests per minute - for general API endpoints */
  GENERAL: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
} as const

/**
 * Clear all rate limit entries (for testing)
 */
export async function clearRateLimits(): Promise<void> {
  inMemoryStore.clear()

  const redisClient = getRedisClient()
  if (redisClient) {
    try {
      const keys = await redisClient.keys('ratelimit:*')
      if (keys.length > 0) {
        await redisClient.del(...keys)
      }
    } catch (error) {
      console.error('[RateLimit] Redis clear error:', error)
    }
  }
}
