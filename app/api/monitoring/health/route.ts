import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/monitoring/health
 *
 * Health check endpoint for monitoring and uptime services
 *
 * Returns:
 * - Overall health status
 * - Database connectivity
 * - Basic metrics
 *
 * Public endpoint (no auth required)
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'unknown' as 'healthy' | 'unhealthy' | 'unknown', responseTime: 0 },
    },
    metrics: {
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
    },
  }

  // Check database connectivity
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbResponseTime = Date.now() - dbStart

    health.checks.database = {
      status: dbResponseTime < 1000 ? 'healthy' : 'unhealthy',
      responseTime: dbResponseTime,
    }
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      responseTime: 0,
    }
    health.status = 'unhealthy'
  }

  // Get memory metrics
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memUsage = process.memoryUsage()
    health.metrics.memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    }
  }

  // Determine overall status
  if (health.checks.database.status === 'unhealthy') {
    health.status = 'unhealthy'
  }

  const statusCode = health.status === 'healthy' ? 200 : 503

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
