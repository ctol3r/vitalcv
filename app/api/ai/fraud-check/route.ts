import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { detectFraud } from '@/lib/ai/fraud-detection'
import { VerifiableCredential } from '@/lib/credentials/types'
import { z } from 'zod'

/**
 * POST /api/ai/fraud-check
 *
 * Check credential for fraud indicators using AI/ML
 *
 * Requires authentication
 *
 * Request body:
 * {
 *   "credential": { ...W3C VC... },
 *   "saveAlert": boolean (optional, default: false)
 * }
 *
 * Response:
 * {
 *   "score": 0.45,
 *   "risk": "medium",
 *   "confidence": 0.85,
 *   "reasons": [...],
 *   "recommendations": [...],
 *   "metadata": { ... }
 * }
 */

const requestSchema = z.object({
  credential: z.record(z.unknown()),
  saveAlert: z.boolean().optional().default(false),
})

export const POST = withRateLimit(
  'ai:fraud-check',
  RATE_LIMITS['api:general'],
  async (request: NextRequest) => {
    return requireAuth(request, async (req, user) => {
      try {
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

        const { credential, saveAlert } = validation.data
        const vc = credential as VerifiableCredential

        // Get issuer history for context
        const issuerDid = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id

        let issuerHistory
        try {
          const issuer = await prisma.issuer.findUnique({
            where: { did: issuerDid },
            include: {
              _count: {
                select: {
                  credentials: true,
                },
              },
              credentials: {
                where: { revoked: true },
                select: { id: true },
              },
            },
          })

          if (issuer) {
            const accountAge = Math.floor(
              (Date.now() - issuer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
            issuerHistory = {
              totalIssued: issuer._count.credentials,
              totalRevoked: issuer.credentials.length,
              accountAge,
            }
          }
        } catch (error) {
          // Issuer not in database, continue without history
          console.log('Issuer not found, proceeding without history')
        }

        // Run fraud detection
        const result = await detectFraud(vc, {
          issuerHistory,
        })

        // Get recommendations
        const { getRecommendedActions, getRiskDescription } = await import(
          '@/lib/ai/fraud-detection'
        )
        const recommendations = getRecommendedActions(result.risk)
        const riskDescription = getRiskDescription(result.risk)

        // Save fraud alert if requested and score is concerning
        if (saveAlert && result.score >= 0.3) {
          try {
            // Find credential in database
            const credentialRecord = await prisma.credential.findFirst({
              where: { credentialId: vc.id },
            })

            if (credentialRecord) {
              await prisma.fraudAlert.create({
                data: {
                  credentialId: credentialRecord.id,
                  score: result.score,
                  reasons: result.reasons,
                  severity: result.risk,
                  reviewed: false,
                },
              })
            }
          } catch (error) {
            console.error('Failed to save fraud alert:', error)
            // Don't fail the request if we can't save the alert
          }
        }

        return NextResponse.json({
          score: result.score,
          risk: result.risk,
          riskDescription,
          confidence: result.confidence,
          reasons: result.reasons,
          recommendations,
          metadata: result.metadata,
        })
      } catch (error) {
        console.error('Fraud detection error:', error)
        return NextResponse.json(
          { error: 'Failed to check credential for fraud' },
          { status: 500 }
        )
      }
    })
  }
)
