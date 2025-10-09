import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optionalAuth } from '@/lib/auth/middleware'

/**
 * GET /api/issuers/[id]
 *
 * Get issuer details by ID or DID.
 *
 * Response:
 * {
 *   "issuer": { ...issuer details... },
 *   "stats": {
 *     "credentialsIssued": 123,
 *     "activeCredentials": 100
 *   }
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      const { id } = params

      // Find by ID or DID
      const issuer = await prisma.issuer.findFirst({
        where: {
          OR: [{ id }, { did: id }],
        },
        include: {
          _count: {
            select: {
              credentials: true,
            },
          },
        },
      })

      if (!issuer) {
        return NextResponse.json(
          { error: 'Issuer not found' },
          { status: 404 }
        )
      }

      // Get active credentials count
      const activeCredentialsCount = await prisma.credential.count({
        where: {
          issuerId: issuer.id,
          revoked: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      })

      return NextResponse.json({
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
          createdAt: issuer.createdAt,
          updatedAt: issuer.updatedAt,
        },
        stats: {
          credentialsIssued: issuer._count.credentials,
          activeCredentials: activeCredentialsCount,
        },
      })
    } catch (error) {
      console.error('Fetch issuer error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch issuer' },
        { status: 500 }
      )
    }
  })
}

/**
 * PATCH /api/issuers/[id]
 *
 * Update issuer profile.
 *
 * Requires authentication. User must own the issuer profile.
 *
 * Request body:
 * {
 *   "name": "New Name",
 *   "description": "New description",
 *   "website": "https://newsite.com",
 *   "logoUrl": "https://newsite.com/logo.png",
 *   "supportedSchemas": ["Type1", "Type2"]
 * }
 *
 * Response:
 * {
 *   "issuer": { ...updated issuer... }
 * }
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      const { id } = params
      const body = await req.json()

      // Find issuer
      const issuer = await prisma.issuer.findUnique({
        where: { id },
      })

      if (!issuer) {
        return NextResponse.json(
          { error: 'Issuer not found' },
          { status: 404 }
        )
      }

      // Check authorization
      if (issuer.did !== user.did) {
        return NextResponse.json(
          { error: 'Unauthorized to update this issuer' },
          { status: 403 }
        )
      }

      // Only allow updating specific fields
      const allowedFields = ['name', 'description', 'website', 'logoUrl', 'supportedSchemas']
      const updates: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
      }

      // Update issuer
      const updated = await prisma.issuer.update({
        where: { id },
        data: updates,
      })

      return NextResponse.json({
        issuer: {
          id: updated.id,
          did: updated.did,
          name: updated.name,
          description: updated.description,
          website: updated.website,
          logoUrl: updated.logoUrl,
          verified: updated.verified,
          trustLevel: updated.trustLevel,
          supportedSchemas: updated.supportedSchemas,
        },
      })
    } catch (error) {
      console.error('Update issuer error:', error)
      return NextResponse.json(
        { error: 'Failed to update issuer' },
        { status: 500 }
      )
    }
  })
}
