import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optionalAuth } from '@/lib/auth/middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { z } from 'zod'

/**
 * GET /api/issuers
 *
 * List trusted issuers.
 *
 * Query parameters:
 * - verified: Filter by verified status (true/false)
 * - trustLevel: Filter by trust level (basic/verified/trusted)
 *
 * Response:
 * {
 *   "issuers": [...]
 * }
 */

export const GET = withRateLimit(
  'api:general',
  RATE_LIMITS['api:general'],
  async (request: NextRequest) => {
    return optionalAuth(request, async (req, user) => {
      try {
        const searchParams = req.nextUrl.searchParams
        const verified = searchParams.get('verified')
        const trustLevel = searchParams.get('trustLevel')

        // Build filter
        const where: {
          verified?: boolean
          trustLevel?: string
        } = {}

        if (verified !== null) {
          where.verified = verified === 'true'
        }

        if (trustLevel) {
          where.trustLevel = trustLevel
        }

        // Fetch issuers
        const issuers = await prisma.issuer.findMany({
          where,
          select: {
            id: true,
            did: true,
            name: true,
            description: true,
            website: true,
            logoUrl: true,
            verified: true,
            trustLevel: true,
            supportedSchemas: true,
            createdAt: true,
            updatedAt: true,
            // Don't expose publicKey for security
          },
          orderBy: [
            { verified: 'desc' },
            { trustLevel: 'desc' },
            { createdAt: 'desc' },
          ],
        })

        return NextResponse.json({ issuers })
      } catch (error) {
        console.error('Fetch issuers error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch issuers' },
          { status: 500 }
        )
      }
    })
  }
)

/**
 * POST /api/issuers
 *
 * Register as an issuer.
 *
 * Requires authentication.
 *
 * Request body:
 * {
 *   "name": "Issuer Name",
 *   "description": "Description",
 *   "website": "https://example.com",
 *   "logoUrl": "https://example.com/logo.png",
 *   "supportedSchemas": ["DriverLicense", "HealthPass"]
 * }
 *
 * Response:
 * {
 *   "issuer": { ...created issuer... }
 * }
 */

const requestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  website: z.string().url('Invalid URL').optional(),
  logoUrl: z.string().url('Invalid URL').optional(),
  supportedSchemas: z.array(z.string()).default([]),
})

export async function POST(request: NextRequest) {
  return optionalAuth(request, async (req, user) => {
    try {
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Parse and validate request
      const body = await req.json()
      const validation = requestSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.error.errors,
          },
          { status: 400 }
        )
      }

      const { name, description, website, logoUrl, supportedSchemas } = validation.data

      // Check if user is already an issuer
      const existing = await prisma.issuer.findUnique({
        where: { did: user.did },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'User is already registered as an issuer' },
          { status: 409 }
        )
      }

      // Get user's public key
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { publicKey: true },
      })

      if (!userRecord?.publicKey) {
        return NextResponse.json(
          { error: 'User public key not found. Please re-authenticate.' },
          { status: 400 }
        )
      }

      // Create issuer
      const issuer = await prisma.issuer.create({
        data: {
          did: user.did,
          name,
          description: description || null,
          website: website || null,
          logoUrl: logoUrl || null,
          publicKey: userRecord.publicKey,
          verified: false, // Admin verification required
          trustLevel: 'basic',
          supportedSchemas,
        },
      })

      return NextResponse.json(
        {
          issuer: {
            id: issuer.id,
            did: issuer.did,
            name: issuer.name,
            description: issuer.description,
            website: issuer.website,
            logoUrl: issuer.logoUrl,
            verified: issuer.verified,
            trustLevel: issuer.trustLevel,
            supportedSchemas: issuer.supportedSchemas,
          },
          message: 'Issuer registered successfully. Verification pending.',
        },
        { status: 201 }
      )
    } catch (error) {
      console.error('Create issuer error:', error)
      return NextResponse.json(
        { error: 'Failed to create issuer' },
        { status: 500 }
      )
    }
  })
}
