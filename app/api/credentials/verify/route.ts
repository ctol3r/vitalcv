import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  verifyCredentialSignature,
  isCredentialExpired,
  validateCredentialStructure,
} from '@/lib/credentials/issue'
import { VerifiableCredential } from '@/lib/credentials/types'
import { z } from 'zod'
import { randomBytes } from 'crypto'

/**
 * POST /api/credentials/verify
 *
 * Verify a verifiable credential.
 *
 * Requires authentication. Creates an audit trail entry.
 *
 * Request body:
 * {
 *   "credential": { ...W3C VC... },
 *   "challenge": "random-string" (optional, for presentation verification)
 *   "presentationType": "full" | "selective" | "zkp" (default: "full")
 *   "revealedFields": ["field1", "field2"] (for selective disclosure)
 * }
 *
 * Response:
 * {
 *   "valid": true/false,
 *   "checks": {
 *     "structure": true/false,
 *     "signature": true/false,
 *     "expiration": true/false,
 *     "revocation": true/false,
 *     "issuerTrust": "basic" | "verified" | "trusted"
 *   },
 *   "errors": [...],
 *   "verificationId": "uuid"
 * }
 */

const requestSchema = z.object({
  credential: z.record(z.unknown()),
  challenge: z.string().optional(),
  presentationType: z.enum(['full', 'selective', 'zkp']).default('full'),
  revealedFields: z.array(z.string()).optional(),
})

export const POST = withRateLimit(
  'credentials:verify',
  RATE_LIMITS['credentials:verify'],
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

        const { credential, challenge, presentationType, revealedFields } = validation.data

        const errors: string[] = []
        const checks = {
          structure: false,
          signature: false,
          expiration: false,
          revocation: false,
          issuerTrust: 'unknown' as 'basic' | 'verified' | 'trusted' | 'unknown',
        }

        // 1. Validate credential structure
        const structureValidation = validateCredentialStructure(credential)
        checks.structure = structureValidation.valid

        if (!structureValidation.valid) {
          errors.push(...structureValidation.errors)
          return NextResponse.json({
            valid: false,
            checks,
            errors,
            message: 'Credential structure validation failed',
          })
        }

        const vc = credential as VerifiableCredential

        // 2. Find credential in database
        let credentialRecord = null
        try {
          credentialRecord = await prisma.credential.findFirst({
            where: { credentialId: vc.id },
            include: { issuer: true },
          })
        } catch (err) {
          // Credential not in our database, but we can still verify signature
          console.log('Credential not found in database, verifying externally')
        }

        // 3. Check revocation status
        if (credentialRecord) {
          checks.revocation = !credentialRecord.revoked

          if (credentialRecord.revoked) {
            errors.push(
              `Credential was revoked on ${credentialRecord.revokedAt?.toISOString()}`
            )
            if (credentialRecord.revocationReason) {
              errors.push(`Reason: ${credentialRecord.revocationReason}`)
            }
          }
        } else {
          // If not in our database, assume not revoked
          // In production, check external revocation lists
          checks.revocation = true
        }

        // 4. Check expiration
        const expired = isCredentialExpired(vc)
        checks.expiration = !expired

        if (expired) {
          errors.push(`Credential expired on ${vc.expirationDate}`)
        }

        // 5. Verify signature
        // Get issuer's public key
        let issuerPublicKey: string | null = null

        if (credentialRecord?.issuer) {
          issuerPublicKey = credentialRecord.issuer.publicKey
          checks.issuerTrust = credentialRecord.issuer.trustLevel as any
        } else {
          // Try to find issuer by DID
          const issuerDid = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id
          const issuer = await prisma.issuer.findUnique({
            where: { did: issuerDid },
          })

          if (issuer) {
            issuerPublicKey = issuer.publicKey
            checks.issuerTrust = issuer.trustLevel as any
          } else {
            errors.push('Issuer not found in trusted registry')
            checks.issuerTrust = 'unknown'
            // In production, resolve public key from DID document
          }
        }

        if (issuerPublicKey) {
          try {
            checks.signature = verifyCredentialSignature(vc, issuerPublicKey)
            if (!checks.signature) {
              errors.push('Invalid signature')
            }
          } catch (err) {
            checks.signature = false
            errors.push('Signature verification failed')
          }
        } else {
          checks.signature = false
          errors.push('Unable to verify signature: issuer public key not available')
        }

        // Overall validity
        const valid =
          checks.structure &&
          checks.signature &&
          checks.expiration &&
          checks.revocation

        // Generate challenge for response
        const verificationChallenge = challenge || randomBytes(32).toString('hex')

        // Create verification audit trail
        const verification = await prisma.verification.create({
          data: {
            credentialId: credentialRecord?.id || '',
            verifierId: user.did,
            verifierUserId: user.id,
            challenge: verificationChallenge,
            presentationType,
            revealedFields: revealedFields || [],
            result: valid ? 'valid' : 'invalid',
            errorMessage: errors.length > 0 ? errors.join('; ') : null,
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
            userAgent: req.headers.get('user-agent') || undefined,
          },
        })

        return NextResponse.json({
          valid,
          checks,
          errors: errors.length > 0 ? errors : undefined,
          message: valid ? 'Credential is valid' : 'Credential verification failed',
          verificationId: verification.id,
          credential: {
            id: vc.id,
            type: vc.type,
            issuer: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer.id,
            issuanceDate: vc.issuanceDate,
            expirationDate: vc.expirationDate,
            subject: vc.credentialSubject.id,
          },
        })
      } catch (error) {
        console.error('Credential verification error:', error)
        return NextResponse.json(
          { error: 'Failed to verify credential' },
          { status: 500 }
        )
      }
    })
  }
)
