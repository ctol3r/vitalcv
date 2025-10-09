import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

/**
 * GET /api/credentials
 *
 * List credentials.
 *
 * Requires authentication.
 *
 * Query parameters:
 * - issued: Show credentials issued by the user (true/false)
 * - received: Show credentials received by the user (true/false)
 * - type: Filter by credential type
 * - revoked: Filter by revoked status (true/false)
 *
 * Response:
 * {
 *   "credentials": [...]
 * }
 */

export const GET = withRateLimit(
  'api:general',
  RATE_LIMITS['api:general'],
  async (request: NextRequest) => {
    return requireAuth(request, async (req, user) => {
      try {
        const searchParams = req.nextUrl.searchParams
        const issued = searchParams.get('issued') === 'true'
        const received = searchParams.get('received') === 'true'
        const type = searchParams.get('type')
        const revoked = searchParams.get('revoked')

        // Build filter
        const where: {
          OR?: Array<{ issuerUserId?: string; subjectId?: string }>
          issuerUserId?: string
          subjectId?: string
          type?: string
          revoked?: boolean
        } = {}

        // Filter by issued/received
        if (issued && received) {
          where.OR = [
            { issuerUserId: user.id },
            { subjectId: user.did },
          ]
        } else if (issued) {
          where.issuerUserId = user.id
        } else if (received) {
          where.subjectId = user.did
        } else {
          // Default: show all user's credentials (issued or received)
          where.OR = [
            { issuerUserId: user.id },
            { subjectId: user.did },
          ]
        }

        if (type) {
          where.type = type
        }

        if (revoked !== null) {
          where.revoked = revoked === 'true'
        }

        // Fetch credentials
        const credentials = await prisma.credential.findMany({
          where,
          include: {
            schema: {
              select: {
                type: true,
                name: true,
                version: true,
              },
            },
            issuer: {
              select: {
                did: true,
                name: true,
                verified: true,
                trustLevel: true,
              },
            },
          },
          orderBy: {
            issuedAt: 'desc',
          },
        })

        return NextResponse.json({ credentials })
      } catch (error) {
        console.error('Fetch credentials error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch credentials' },
          { status: 500 }
        )
      }
    })
  }
)
