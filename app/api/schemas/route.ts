import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optionalAuth } from '@/lib/auth/middleware'
import { CREDENTIAL_SCHEMAS } from '@/lib/credentials/schemas'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'

/**
 * GET /api/schemas
 *
 * List all available credential schemas.
 *
 * Query parameters:
 * - active: Filter by active status (true/false)
 * - type: Filter by credential type
 * - privacy: Filter by privacy mode (plain/bbs/zkp)
 *
 * Response:
 * {
 *   "schemas": [{ ...schema }, ...]
 * }
 */

export const GET = withRateLimit(
  'api:general',
  RATE_LIMITS['api:general'],
  async (request: NextRequest) => {
    return optionalAuth(request, async (req, user) => {
      try {
        const searchParams = req.nextUrl.searchParams
        const active = searchParams.get('active')
        const type = searchParams.get('type')
        const privacy = searchParams.get('privacy')

        // Build filter
        const where: {
          active?: boolean
          type?: string
          privacy?: string
        } = {}

        if (active !== null) {
          where.active = active === 'true'
        }
        if (type) {
          where.type = type
        }
        if (privacy) {
          where.privacy = privacy
        }

        // Fetch schemas from database
        const schemas = await prisma.credentialSchema.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            type: true,
            name: true,
            description: true,
            version: true,
            jsonSchema: true,
            privacy: true,
            active: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        return NextResponse.json({ schemas })
      } catch (error) {
        console.error('Fetch schemas error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch schemas' },
          { status: 500 }
        )
      }
    })
  }
)

/**
 * POST /api/schemas
 *
 * Create a new credential schema.
 *
 * Requires authentication.
 *
 * Request body:
 * {
 *   "type": "DriverLicense",
 *   "name": "Driver License",
 *   "description": "...",
 *   "version": "1.0.0",
 *   "jsonSchema": { ...JSON Schema... },
 *   "privacy": "plain"
 * }
 *
 * Response:
 * {
 *   "schema": { ...created schema... }
 * }
 */

export async function POST(request: NextRequest) {
  return optionalAuth(request, async (req, user) => {
    try {
      // For now, allow unauthenticated creation (in production, require admin)
      // TODO: Add role-based access control

      const body = await req.json()

      // Validate required fields
      const { type, name, description, version, jsonSchema, privacy } = body

      if (!type || !name || !version || !jsonSchema) {
        return NextResponse.json(
          { error: 'Missing required fields: type, name, version, jsonSchema' },
          { status: 400 }
        )
      }

      // Validate privacy mode
      if (privacy && !['plain', 'bbs', 'zkp'].includes(privacy)) {
        return NextResponse.json(
          { error: 'Invalid privacy mode. Must be: plain, bbs, or zkp' },
          { status: 400 }
        )
      }

      // Check if schema type already exists
      const existing = await prisma.credentialSchema.findUnique({
        where: { type },
      })

      if (existing) {
        return NextResponse.json(
          { error: `Schema with type '${type}' already exists` },
          { status: 409 }
        )
      }

      // Create schema
      const schema = await prisma.credentialSchema.create({
        data: {
          type,
          name,
          description: description || null,
          version,
          jsonSchema,
          privacy: privacy || 'plain',
          active: true,
        },
      })

      return NextResponse.json({ schema }, { status: 201 })
    } catch (error) {
      console.error('Create schema error:', error)
      return NextResponse.json(
        { error: 'Failed to create schema' },
        { status: 500 }
      )
    }
  })
}
