import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optionalAuth } from '@/lib/auth/middleware'

/**
 * GET /api/credentials/[id]/status
 *
 * Check the status of a credential (revoked, expired, etc.)
 *
 * This endpoint is public and does not require authentication.
 * It follows the W3C Verifiable Credentials specification for status checking.
 *
 * Response:
 * {
 *   "credentialId": "urn:uuid:...",
 *   "status": "active" | "revoked" | "expired" | "suspended",
 *   "revoked": true/false,
 *   "revokedAt": "2024-10-08T12:00:00.000Z",
 *   "revocationReason": "Credential was compromised",
 *   "expired": true/false,
 *   "expiresAt": "2025-12-31T23:59:59.000Z"
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      const { id } = params

      // Find credential by ID or credentialId
      const credential = await prisma.credential.findFirst({
        where: {
          OR: [
            { id },
            { credentialId: id },
          ],
        },
        select: {
          id: true,
          credentialId: true,
          type: true,
          revoked: true,
          revokedAt: true,
          revocationReason: true,
          expiresAt: true,
          issuedAt: true,
        },
      })

      if (!credential) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 404 }
        )
      }

      // Check if expired
      const now = new Date()
      const expired = credential.expiresAt ? credential.expiresAt < now : false

      // Determine overall status
      let status: 'active' | 'revoked' | 'expired' | 'suspended' = 'active'
      if (credential.revoked) {
        status = 'revoked'
      } else if (expired) {
        status = 'expired'
      }

      return NextResponse.json({
        credentialId: credential.credentialId,
        type: credential.type,
        status,
        revoked: credential.revoked,
        revokedAt: credential.revokedAt,
        revocationReason: credential.revocationReason,
        expired,
        expiresAt: credential.expiresAt,
        issuedAt: credential.issuedAt,
      })
    } catch (error) {
      console.error('Credential status check error:', error)
      return NextResponse.json(
        { error: 'Failed to check credential status' },
        { status: 500 }
      )
    }
  })
}
