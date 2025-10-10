import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * POST /api/analytics/web-vitals
 *
 * Collect Core Web Vitals metrics from clients
 *
 * Public endpoint (no auth required) with rate limiting
 *
 * Request body:
 * {
 *   "name": "LCP",
 *   "value": 1234.56,
 *   "rating": "good",
 *   "id": "v1-...",
 *   "delta": 123.45,
 *   "navigationType": "navigate"
 * }
 */

const webVitalSchema = z.object({
  id: z.string(),
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  delta: z.number(),
  navigationType: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json()
    const validation = webVitalSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { name, value, rating } = validation.data

    // Get user ID from session if available
    const sessionToken = request.cookies.get('session-token')?.value
    let userId: string | undefined

    if (sessionToken) {
      try {
        const session = await prisma.session.findUnique({
          where: { token: sessionToken },
          select: { userId: true },
        })
        userId = session?.userId
      } catch {
        // Continue without user ID
      }
    }

    // Extract URL from referer
    const referer = request.headers.get('referer')
    const url = referer ? new URL(referer).pathname : '/'

    // Get user agent
    const userAgent = request.headers.get('user-agent') || undefined

    // Save metric to database
    await prisma.performanceMetric.create({
      data: {
        userId,
        metric: name,
        value,
        rating,
        url,
        userAgent,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Web vitals tracking error:', error)
    // Return success even on error - don't interrupt user experience
    return NextResponse.json({ success: true })
  }
}
