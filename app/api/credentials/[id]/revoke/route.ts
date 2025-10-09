import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

/**
 * POST /api/credentials/[id]/revoke
 *
 * Revoke a credential.
 *
 * Requires authentication. User must be the issuer.
 *
 * Request body:
 * {
 *   "reason": "Reason for revocation"
 * }
 *
 * Response:
 * {
 *   "message": "Credential revoked successfully",
 *   "credential": { ...updated credential... }
 * }
 */

const requestSchema = z.object({
  reason: z.string().min(1, 'Revocation reason is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = params

      // Parse request body
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

      const { reason } = validation.data

      // Find credential
      const credential = await prisma.credential.findUnique({
        where: { id },
        include: { issuer: true },
      })

      if (!credential) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 404 }
        )
      }

      // Check authorization: must be the issuer
      if (credential.issuerUserId !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized. Only the issuer can revoke this credential.' },
          { status: 403 }
        )
      }

      // Check if already revoked
      if (credential.revoked) {
        return NextResponse.json(
          {
            error: 'Credential is already revoked',
            revokedAt: credential.revokedAt,
            reason: credential.revocationReason,
          },
          { status: 400 }
        )
      }

      // Revoke credential
      const updatedCredential = await prisma.credential.update({
        where: { id },
        data: {
          revoked: true,
          revokedAt: new Date(),
          revocationReason: reason,
        },
      })

      return NextResponse.json({
        message: 'Credential revoked successfully',
        credential: {
          id: updatedCredential.id,
          credentialId: updatedCredential.credentialId,
          type: updatedCredential.type,
          revoked: updatedCredential.revoked,
          revokedAt: updatedCredential.revokedAt,
          revocationReason: updatedCredential.revocationReason,
        },
      })
    } catch (error) {
      console.error('Credential revocation error:', error)
      return NextResponse.json(
        { error: 'Failed to revoke credential' },
        { status: 500 }
      )
    }
  })
}
