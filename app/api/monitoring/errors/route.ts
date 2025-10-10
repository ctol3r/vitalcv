import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

/**
 * GET /api/monitoring/errors
 *
 * Get error logs with filtering and pagination
 *
 * Requires authentication
 *
 * Query params:
 * - errorType: 'client' | 'server' | 'api' | 'validation'
 * - resolved: 'true' | 'false'
 * - limit: number (default 50, max 200)
 * - offset: number (default 0)
 * - timeRange: '1h' | '24h' | '7d' | '30d'
 */

const querySchema = z.object({
  errorType: z.enum(['client', 'server', 'api', 'validation']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  timeRange: z.enum(['1h', '24h', '7d', '30d']).optional(),
})

function getTimeRangeDate(timeRange?: string): Date | undefined {
  if (!timeRange) return undefined

  const now = new Date()
  const ranges: Record<string, number> = {
    '1h': 1 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  return new Date(now.getTime() - ranges[timeRange])
}

export const GET = async (request: NextRequest) => {
  return requireAuth(request, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url)
      const validation = querySchema.safeParse({
        errorType: searchParams.get('errorType'),
        resolved: searchParams.get('resolved'),
        limit: searchParams.get('limit'),
        offset: searchParams.get('offset'),
        timeRange: searchParams.get('timeRange'),
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

      const { errorType, resolved, limit, offset, timeRange } = validation.data

      // Build where clause
      const where: any = {}

      if (errorType) {
        where.errorType = errorType
      }

      if (resolved !== undefined) {
        where.resolved = resolved === 'true'
      }

      if (timeRange) {
        const startDate = getTimeRangeDate(timeRange)
        if (startDate) {
          where.createdAt = { gte: startDate }
        }
      }

      // Get errors with pagination
      const [errors, total] = await Promise.all([
        prisma.errorLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            errorType: true,
            message: true,
            url: true,
            method: true,
            statusCode: true,
            resolved: true,
            createdAt: true,
            // Don't return full stack trace or metadata to reduce response size
          },
        }),
        prisma.errorLog.count({ where }),
      ])

      return NextResponse.json({
        errors,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      })
    } catch (error) {
      console.error('Error fetching error logs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch error logs' },
        { status: 500 }
      )
    }
  })
}

/**
 * PATCH /api/monitoring/errors
 *
 * Mark error as resolved
 *
 * Request body:
 * {
 *   "errorId": "uuid",
 *   "resolved": boolean
 * }
 */

const patchSchema = z.object({
  errorId: z.string().uuid(),
  resolved: z.boolean(),
})

export const PATCH = async (request: NextRequest) => {
  return requireAuth(request, async (req, user) => {
    try {
      const body = await req.json()
      const validation = patchSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.errors,
          },
          { status: 400 }
        )
      }

      const { errorId, resolved } = validation.data

      // Update error
      const error = await prisma.errorLog.update({
        where: { id: errorId },
        data: { resolved },
      })

      return NextResponse.json({ success: true, error })
    } catch (error) {
      console.error('Error updating error log:', error)
      return NextResponse.json(
        { error: 'Failed to update error log' },
        { status: 500 }
      )
    }
  })
}
