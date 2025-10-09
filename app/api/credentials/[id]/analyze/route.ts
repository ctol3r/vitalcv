import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import {
  analyzeCredentialForSelectiveDisclosure,
  suggestFieldsToReveal,
  calculatePrivacyScore,
} from '@/lib/credentials/selective-disclosure'
import { VerifiableCredential } from '@/lib/credentials/types'

/**
 * GET /api/credentials/[id]/analyze
 *
 * Analyze a credential for selective disclosure capability.
 *
 * Returns information about which fields can be selectively disclosed,
 * and suggestions for privacy-preserving presentations.
 *
 * Requires authentication. User must own the credential.
 *
 * Query parameters:
 * - purpose: Verification purpose (optional, for field suggestions)
 *
 * Response:
 * {
 *   "supportsSelectiveDisclosure": true/false,
 *   "availableClaims": [...],
 *   "suggestions": {
 *     "required": [...],
 *     "suggested": [...],
 *     "optional": [...]
 *   },
 *   "privacyAnalysis": {
 *     "totalFields": 10,
 *     "minimumRequired": 3,
 *     "privacyScore": { ... }
 *   }
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return requireAuth(request, async (req, user) => {
    try {
      const { id } = params
      const searchParams = req.nextUrl.searchParams
      const purpose = searchParams.get('purpose') || 'general'

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

      // Check authorization: must be the subject
      if (credential.subjectId !== user.did) {
        return NextResponse.json(
          { error: 'Unauthorized. Only the credential subject can analyze it.' },
          { status: 403 }
        )
      }

      // Get W3C VC from database
      const vc = credential.credentialData as unknown as VerifiableCredential

      // Analyze for selective disclosure
      const analysis = analyzeCredentialForSelectiveDisclosure(vc)

      if (!analysis.supportsSelectiveDisclosure) {
        return NextResponse.json({
          supportsSelectiveDisclosure: false,
          reason: analysis.reason,
          message: 'This credential does not support selective disclosure. Consider requesting a BBS+ version from the issuer.',
          credentialType: credential.type,
          proofType: credential.proofType,
        })
      }

      // Get field suggestions
      const suggestions = suggestFieldsToReveal(vc, purpose)

      // Calculate privacy scores for different disclosure levels
      const totalFields = analysis.availableClaims.length
      const minimumFields = suggestions.required.length

      const privacyScores = {
        minimumDisclosure: calculatePrivacyScore(totalFields, minimumFields),
        suggestedDisclosure: calculatePrivacyScore(
          totalFields,
          minimumFields + suggestions.suggested.length
        ),
        fullDisclosure: calculatePrivacyScore(totalFields, totalFields),
      }

      return NextResponse.json({
        supportsSelectiveDisclosure: true,
        credentialId: credential.credentialId,
        credentialType: credential.type,
        proofType: credential.proofType,
        availableClaims: analysis.availableClaims.map((claim) => ({
          name: claim.name,
          required: claim.required,
          sensitive: claim.sensitive,
          description: claim.description,
          // Don't expose actual values in analysis
        })),
        suggestions: {
          required: suggestions.required,
          suggested: suggestions.suggested,
          optional: suggestions.optional,
        },
        privacyAnalysis: {
          totalFields,
          minimumRequired: minimumFields,
          privacyScores,
          recommendation: privacyScores.suggestedDisclosure.description,
        },
        nextSteps: {
          message: 'Use POST /api/credentials/:id/derive to create a derived credential with selected fields',
          example: {
            revealedFields: [...suggestions.required, ...suggestions.suggested],
          },
        },
      })
    } catch (error) {
      console.error('Credential analysis error:', error)
      return NextResponse.json(
        { error: 'Failed to analyze credential' },
        { status: 500 }
      )
    }
  })
}
