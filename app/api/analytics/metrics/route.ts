import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

/**
 * GET /api/analytics/metrics
 *
 * Get analytics metrics and statistics
 *
 * Requires authentication
 *
 * Query params:
 * - timeRange: '1h' | '24h' | '7d' | '30d' | '90d'
 * - metric: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP' (optional)
 * - url: specific URL to filter by (optional)
 */

const querySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d', '90d']).optional().default('24h'),
  metric: z.enum(['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP']).optional(),
  url: z.string().optional(),
})

function getTimeRangeDate(timeRange: string): Date {
  const now = new Date()
  const ranges: Record<string, number> = {
    '1h': 1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
  }
  return new Date(now.getTime() - ranges[timeRange])
}

export const GET = async (request: NextRequest) => {
  return requireAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url)
      const validation = querySchema.safeParse({
        timeRange: searchParams.get('timeRange'),
        metric: searchParams.get('metric'),
        url: searchParams.get('url'),
      })

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.errors,
          },
          { status: 400 }
        )
      }

      const { timeRange, metric, url } = validation.data
      const startDate = getTimeRangeDate(timeRange)

      // Build where clause
      const where: any = {
        createdAt: {
          gte: startDate,
        },
      }

      if (metric) {
        where.metric = metric
      }

      if (url) {
        where.url = url
      }

      // Get performance metrics
      const metrics = await prisma.performanceMetric.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 1000, // Limit to prevent overwhelming response
      })

      // Calculate statistics by metric type
      const stats: Record<string, any> = {}
      const metricTypes = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP']

      for (const metricType of metricTypes) {
        const metricData = metrics.filter((m) => m.metric === metricType)

        if (metricData.length > 0) {
          const values = metricData.map((m) => m.value)
          const ratings = metricData.map((m) => m.rating)

          stats[metricType] = {
            count: metricData.length,
            average: values.reduce((a, b) => a + b, 0) / values.length,
            median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
            p75: values.sort((a, b) => a - b)[Math.floor(values.length * 0.75)],
            p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
            min: Math.min(...values),
            max: Math.max(...values),
            ratings: {
              good: ratings.filter((r) => r === 'good').length,
              needsImprovement: ratings.filter((r) => r === 'needs-improvement').length,
              poor: ratings.filter((r) => r === 'poor').length,
            },
          }
        }
      }

      // Get error statistics
      const errors = await prisma.errorLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          errorType: true,
          resolved: true,
          createdAt: true,
        },
      })

      const errorStats = {
        total: errors.length,
        byType: {
          client: errors.filter((e) => e.errorType === 'client').length,
          server: errors.filter((e) => e.errorType === 'server').length,
          api: errors.filter((e) => e.errorType === 'api').length,
          validation: errors.filter((e) => e.errorType === 'validation').length,
        },
        resolved: errors.filter((e) => e.resolved).length,
        unresolved: errors.filter((e) => !e.resolved).length,
      }

      // Get credential statistics
      const credentials = await prisma.credential.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          id: true,
          revoked: true,
          createdAt: true,
        },
      })

      const credentialStats = {
        total: credentials.length,
        active: credentials.filter((c) => !c.revoked).length,
        revoked: credentials.filter((c) => c.revoked).length,
      }

      // Get verification statistics
      const verifications = await prisma.verification.findMany({
        where: {
          verifiedAt: {
            gte: startDate,
          },
        },
        select: {
          result: true,
          presentationType: true,
        },
      })

      const verificationStats = {
        total: verifications.length,
        byResult: {
          valid: verifications.filter((v) => v.result === 'valid').length,
          invalid: verifications.filter((v) => v.result === 'invalid').length,
          expired: verifications.filter((v) => v.result === 'expired').length,
          revoked: verifications.filter((v) => v.result === 'revoked').length,
        },
        byType: {
          full: verifications.filter((v) => v.presentationType === 'full').length,
          selective: verifications.filter((v) => v.presentationType === 'selective').length,
          zkp: verifications.filter((v) => v.presentationType === 'zkp').length,
        },
      }

      // Get fraud detection statistics
      const fraudAlerts = await prisma.fraudAlert.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          severity: true,
          reviewed: true,
          resolution: true,
        },
      })

      const fraudStats = {
        total: fraudAlerts.length,
        bySeverity: {
          low: fraudAlerts.filter((f) => f.severity === 'low').length,
          medium: fraudAlerts.filter((f) => f.severity === 'medium').length,
          high: fraudAlerts.filter((f) => f.severity === 'high').length,
          critical: fraudAlerts.filter((f) => f.severity === 'critical').length,
        },
        reviewed: fraudAlerts.filter((f) => f.reviewed).length,
        unreviewed: fraudAlerts.filter((f) => !f.reviewed).length,
      }

      return NextResponse.json({
        timeRange,
        startDate,
        endDate: new Date(),
        webVitals: stats,
        errors: errorStats,
        credentials: credentialStats,
        verifications: verificationStats,
        fraudAlerts: fraudStats,
      })
    } catch (error) {
      console.error('Analytics error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch analytics' },
        { status: 500 }
      )
    }
  })
}
