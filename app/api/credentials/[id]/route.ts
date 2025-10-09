import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'

/**
 * GET /api/credentials/[id]
 *
 * Get a specific credential by ID.
 *
 * Requires authentication. User must be the issuer or subject.
 *
 * Response:
 * {
 *   "credential": { ...W3C VC... },
 *   "metadata": { ...database metadata... }
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = params

      // Find credential
      const credential = await prisma.credential.findUnique({
        where: { id },
        include: {
          schema: true,
          issuer: true,
        },
      })

      if (!credential) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 404 }
        )
      }

      // Check authorization: must be issuer or subject
      const isIssuer = credential.issuerUserId === user.id
      const isSubject = credential.subjectId === user.did

      if (!isIssuer && !isSubject) {
        return NextResponse.json(
          { error: 'Unauthorized to view this credential' },
          { status: 403 }
        )
      }

      return NextResponse.json({
        credential: credential.credentialData,
        metadata: {
          id: credential.id,
          credentialId: credential.credentialId,
          type: credential.type,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
          revoked: credential.revoked,
          revokedAt: credential.revokedAt,
          revocationReason: credential.revocationReason,
          privacyMode: credential.privacyMode,
          schema: {
            name: credential.schema.name,
            version: credential.schema.version,
          },
          issuer: {
            did: credential.issuer.did,
            name: credential.issuer.name,
            verified: credential.issuer.verified,
            trustLevel: credential.issuer.trustLevel,
          },
        },
      })
    } catch (error) {
      console.error('Fetch credential error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch credential' },
        { status: 500 }
      )
    }
  })
}
