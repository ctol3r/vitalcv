/**
 * Redis Health Check Endpoint
 *
 * GET /api/health/redis
 * Checks Redis connectivity (feature-flagged)
 */

import { NextResponse } from 'next/server'
import { checkRedisHealth } from '@/lib/oidc4vci/storage'

export async function GET() {
  const REDIS_ENABLED = process.env.ENABLE_REDIS === 'true'

  if (!REDIS_ENABLED) {
    return NextResponse.json({
      status: 'disabled',
      redis_enabled: false,
      message: 'Redis is not enabled',
    })
  }

  try {
    const healthy = await checkRedisHealth()

    if (healthy) {
      return NextResponse.json({
        status: 'healthy',
        redis_enabled: true,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        status: 'unhealthy',
        redis_enabled: true,
        message: 'Redis ping failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        redis_enabled: true,
        message: error instanceof Error ? error.message : 'Redis health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
