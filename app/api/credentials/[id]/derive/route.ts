import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import {
  deriveCredentialWithSelectiveDisclosure,
  analyzeCredentialForSelectiveDisclosure,
  getRequiredFieldsForType,
  calculatePrivacyScore,
} from '@/lib/credentials/selective-disclosure'
import { VerifiableCredential } from '@/lib/credentials/types'
import { z } from 'zod'

/**
 * POST /api/credentials/[id]/derive
 *
 * Derive a credential with selective disclosure.
 *
 * Creates a new verifiable presentation that only reveals selected fields
 * while maintaining cryptographic proof of the full credential.
 *
 * Requires authentication. User must own the credential.
 *
 * Request body:
 * {
 *   "revealedFields": ["id", "givenName", "familyName"],
 *   "challenge": "verifier-provided-nonce",
 *   "purpose": "age-verification"
 * }
 *
 * Response:
 * {
 *   "derivedCredential": { ...W3C VC with only revealed fields... },
 *   "privacyScore": { score: 85, rating: "high", ... },
 *   "revealedFields": [...],
 *   "hiddenFields": [...]
 * }
 */

const requestSchema = z.object({
  revealedFields: z.array(z.string()).min(1, 'At least one field must be revealed'),
  challenge: z.string().min(1, 'Challenge is required'),
  purpose: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = params

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

      const { revealedFields, challenge, purpose } = validation.data

      // Find credential
      const credential = await prisma.credential.findUnique({
        where: { id },
      })

      if (!credential) {
        return NextResponse.json(
          { error: 'Credential not found' },
          { status: 404 }
        )
      }

      // Check authorization: must be the subject
      if (credential.subjectId !== user.did) {
        return NextResponse.json(
          { error: 'Unauthorized. Only the credential subject can derive it.' },
          { status: 403 }
        )
      }

      // Check if credential is valid (not revoked, not expired)
      if (credential.revoked) {
        return NextResponse.json(
          {
            error: 'Cannot derive from revoked credential',
            revokedAt: credential.revokedAt,
            reason: credential.revocationReason,
          },
          { status: 400 }
        )
      }

      if (credential.expiresAt && credential.expiresAt < new Date()) {
        return NextResponse.json(
          {
            error: 'Cannot derive from expired credential',
            expiresAt: credential.expiresAt,
          },
          { status: 400 }
        )
      }

      // Get W3C VC from database
      const vc = credential.credentialData as unknown as VerifiableCredential

      // Analyze for selective disclosure
      const analysis = analyzeCredentialForSelectiveDisclosure(vc)

      if (!analysis.supportsSelectiveDisclosure) {
        return NextResponse.json(
          {
            error: 'Credential does not support selective disclosure',
            reason: analysis.reason,
            suggestion: 'This credential uses ' + credential.proofType + ' instead of BBS+',
          },
          { status: 400 }
        )
      }

      // Validate that revealed fields exist in credential
      const availableFieldNames = analysis.availableClaims.map((c) => c.name)
      const invalidFields = revealedFields.filter((f) => !availableFieldNames.includes(f))

      if (invalidFields.length > 0) {
        return NextResponse.json(
          {
            error: 'Invalid fields requested',
            invalidFields,
            availableFields: availableFieldNames,
          },
          { status: 400 }
        )
      }

      // Check that required fields are included
      const requiredFields = getRequiredFieldsForType(credential.type)
      const missingRequired = requiredFields.filter((f) => !revealedFields.includes(f))

      if (missingRequired.length > 0) {
        return NextResponse.json(
          {
            error: 'Missing required fields',
            missingFields: missingRequired,
            message: 'These fields must be revealed for this credential type',
          },
          { status: 400 }
        )
      }

      // Derive credential with selective disclosure
      const derivedCredential = await deriveCredentialWithSelectiveDisclosure(
        vc,
        revealedFields,
        challenge
      )

      // Calculate privacy score
      const totalFields = analysis.availableClaims.length
      const privacyScore = calculatePrivacyScore(totalFields, revealedFields.length)

      // Determine hidden fields
      const hiddenFields = availableFieldNames.filter((f) => !revealedFields.includes(f))

      return NextResponse.json({
        derivedCredential,
        metadata: {
          originalCredentialId: credential.credentialId,
          derivedAt: new Date().toISOString(),
          challenge,
          purpose: purpose || 'general',
        },
        privacyScore,
        disclosure: {
          totalFields,
          revealedFields,
          hiddenFields,
          privacyPreserved: `${hiddenFields.length}/${totalFields} fields remain private`,
        },
        warning:
          privacyScore.rating === 'low'
            ? 'Low privacy: Consider revealing fewer fields if possible'
            : undefined,
        usage: {
          message: 'Present this derived credential to the verifier',
          endpoint: 'POST /api/credentials/verify',
          note: 'The derived credential can be verified without revealing hidden fields',
        },
      })
    } catch (error) {
      console.error('Credential derivation error:', error)
      return NextResponse.json(
        {
          error: 'Failed to derive credential',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  })
}
