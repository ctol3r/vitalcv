import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Rate Limiting for VitalCV API
 *
 * Implements sliding window rate limiting with database tracking.
 */

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
}

/**
 * Default rate limit configurations for different endpoints
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication endpoints
  'auth:challenge': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 challenges per minute
    message: 'Too many authentication attempts. Please try again later.',
  },
  'auth:verify': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 verification attempts per minute
    message: 'Too many authentication attempts. Please try again later.',
  },
  'auth:refresh': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 refresh attempts per minute
    message: 'Too many token refresh attempts. Please try again later.',
  },

  // Credential endpoints
  'credentials:create': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 credentials per minute
    message: 'Too many credential issuance requests.',
  },
  'credentials:verify': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 verifications per minute
    message: 'Too many verification requests.',
  },

  // General API
  'api:general': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    message: 'Too many requests. Please try again later.',
  },
}

/**
 * Get client identifier from request
 *
 * Tries to get IP address, falls back to user ID if authenticated
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP address from headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a default identifier
  return 'unknown'
}

/**
 * Check if request should be rate limited
 *
 * @param request - Next.js request object
 * @param endpoint - Endpoint identifier (e.g., "auth:challenge")
 * @param config - Rate limit configuration
 * @returns Object with isLimited flag and remaining requests
 */
export async function checkRateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMITS['api:general']
): Promise<{
  isLimited: boolean
  remaining: number
  resetAt: Date
}> {
  const identifier = getClientIdentifier(request)
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMs)

  try {
    // Clean up old rate limit records (older than window)
    await prisma.rateLimit.deleteMany({
      where: {
        identifier,
        endpoint,
        windowEnd: {
          lt: windowStart,
        },
      },
    })

    // Get active rate limit windows
    const activeLimits = await prisma.rateLimit.findMany({
      where: {
        identifier,
        endpoint,
        windowEnd: {
          gte: windowStart,
        },
      },
      orderBy: {
        windowStart: 'asc',
      },
    })

    // Calculate total requests in current window
    const totalRequests = activeLimits.reduce((sum, limit) => sum + limit.count, 0)

    // Check if limit exceeded
    if (totalRequests >= config.maxRequests) {
      // Mark as blocked
      const oldestWindow = activeLimits[0]
      if (oldestWindow && !oldestWindow.blocked) {
        await prisma.rateLimit.update({
          where: { id: oldestWindow.id },
          data: { blocked: true },
        })
      }

      return {
        isLimited: true,
        remaining: 0,
        resetAt: activeLimits[0]?.windowEnd || new Date(now.getTime() + config.windowMs),
      }
    }

    // Increment request count
    const currentWindow = activeLimits.find(
      (limit) =>
        limit.windowStart <= now &&
        limit.windowEnd > now
    )

    if (currentWindow) {
      await prisma.rateLimit.update({
        where: { id: currentWindow.id },
        data: { count: { increment: 1 } },
      })
    } else {
      // Create new window
      await prisma.rateLimit.create({
        data: {
          identifier,
          endpoint,
          count: 1,
          windowStart: now,
          windowEnd: new Date(now.getTime() + config.windowMs),
          blocked: false,
        },
      })
    }

    return {
      isLimited: false,
      remaining: config.maxRequests - totalRequests - 1,
      resetAt: new Date(now.getTime() + config.windowMs),
    }
  } catch (error) {
    console.error('Rate limit check error:', error)
    // On error, allow request to prevent blocking legitimate users
    return {
      isLimited: false,
      remaining: config.maxRequests,
      resetAt: new Date(now.getTime() + config.windowMs),
    }
  }
}

/**
 * Rate limit middleware wrapper
 *
 * @param endpoint - Endpoint identifier
 * @param config - Rate limit configuration
 * @param handler - Request handler
 * @returns Response with rate limit headers
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return withRateLimit('auth:challenge', RATE_LIMITS['auth:challenge'], async (req) => {
 *     // Your handler logic here
 *     return NextResponse.json({ success: true })
 *   })(request)
 * }
 */
export function withRateLimit(
  endpoint: string,
  config: RateLimitConfig,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Check rate limit
    const { isLimited, remaining, resetAt } = await checkRateLimit(request, endpoint, config)

    // If rate limited, return 429 Too Many Requests
    if (isLimited) {
      const response = NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
        },
        { status: 429 }
      )

      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
      response.headers.set('X-RateLimit-Remaining', '0')
      response.headers.set('X-RateLimit-Reset', resetAt.toISOString())
      response.headers.set('Retry-After', Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString())

      return response
    }

    // Execute handler
    const response = await handler(request)

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetAt.toISOString())

    return response
  }
}

/**
 * Clean up expired rate limit records
 *
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: {
      windowEnd: {
        lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Older than 24 hours
      },
    },
  })
  return result.count
}
