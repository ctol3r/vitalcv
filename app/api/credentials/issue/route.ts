import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth/middleware'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import {
  createCredential,
  signCredentialEd25519,
  validateCredentialStructure,
} from '@/lib/credentials/issue'
import { validateCredentialSubject } from '@/lib/credentials/schemas'
import { z } from 'zod'

/**
 * POST /api/credentials/issue
 *
 * Issue a new verifiable credential.
 *
 * Requires authentication. User must be registered as an issuer.
 *
 * Request body:
 * {
 *   "schemaId": "uuid",
 *   "subjectId": "did:ethr:0x...",
 *   "credentialSubject": {
 *     "id": "did:ethr:0x...",
 *     "licenseNumber": "DL123456",
 *     ...
 *   },
 *   "expirationDate": "2025-12-31T23:59:59Z" (optional)
 * }
 *
 * Response:
 * {
 *   "credential": { ...W3C VC... },
 *   "credentialId": "uuid"
 * }
 */

const requestSchema = z.object({
  schemaId: z.string().uuid('Invalid schema ID'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  credentialSubject: z.record(z.unknown()),
  expirationDate: z.string().datetime().optional(),
})

export const POST = withRateLimit(
  'credentials:create',
  RATE_LIMITS['credentials:create'],
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

        const { schemaId, subjectId, credentialSubject, expirationDate } = validation.data

        // Validate subject ID in credentialSubject matches
        if (credentialSubject.id !== subjectId) {
          return NextResponse.json(
            { error: 'credentialSubject.id must match subjectId' },
            { status: 400 }
          )
        }

        // Find credential schema
        const schema = await prisma.credentialSchema.findUnique({
          where: { id: schemaId },
        })

        if (!schema) {
          return NextResponse.json(
            { error: 'Credential schema not found' },
            { status: 404 }
          )
        }

        if (!schema.active) {
          return NextResponse.json(
            { error: 'Credential schema is not active' },
            { status: 400 }
          )
        }

        // Validate credential subject against schema
        const schemaValidation = validateCredentialSubject(
          credentialSubject,
          schema.jsonSchema as any
        )

        if (!schemaValidation.valid) {
          return NextResponse.json(
            {
              error: 'Credential subject validation failed',
              details: schemaValidation.errors,
            },
            { status: 400 }
          )
        }

        // Find or create issuer
        let issuer = await prisma.issuer.findUnique({
          where: { did: user.did },
        })

        if (!issuer) {
          // Auto-create issuer for authenticated users
          // TODO: In production, require explicit issuer registration
          issuer = await prisma.issuer.create({
            data: {
              did: user.did,
              name: user.name || 'Unnamed Issuer',
              publicKey: '', // Will be set from user's public key
              verified: false,
              trustLevel: 'basic',
              supportedSchemas: [schema.type],
            },
          })
        }

        // Create unsigned credential
        const unsignedCredential = createCredential({
          type: schema.type,
          issuer: issuer.did,
          issuanceDate: new Date(),
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          credentialSubject,
        })

        // Get user's public key for signing
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

        // For demo purposes, we'll use a placeholder private key
        // TODO: In production, use proper key management (HSM, KMS, etc.)
        // The private key should NEVER be stored or transmitted
        const demoPrivateKey = '0'.repeat(64) // Placeholder

        // Sign the credential
        const verificationMethod = `${user.did}#key-1`
        const signedCredential = signCredentialEd25519(
          unsignedCredential,
          demoPrivateKey,
          verificationMethod
        )

        // Validate the signed credential
        const structureValidation = validateCredentialStructure(signedCredential)
        if (!structureValidation.valid) {
          return NextResponse.json(
            {
              error: 'Invalid credential structure',
              details: structureValidation.errors,
            },
            { status: 500 }
          )
        }

        // Store credential in database
        const credential = await prisma.credential.create({
          data: {
            credentialId: signedCredential.id,
            schemaId: schema.id,
            issuerId: issuer.id,
            issuerUserId: user.id,
            subjectId,
            type: schema.type,
            credentialData: signedCredential as any,
            proofType: signedCredential.proof.type,
            signatureValue: signedCredential.proof.proofValue,
            issuedAt: new Date(signedCredential.issuanceDate),
            expiresAt: signedCredential.expirationDate
              ? new Date(signedCredential.expirationDate)
              : null,
            privacyMode: schema.privacy,
            revoked: false,
          },
        })

        return NextResponse.json(
          {
            credential: signedCredential,
            credentialId: credential.id,
            message: 'Credential issued successfully',
          },
          { status: 201 }
        )
      } catch (error) {
        console.error('Credential issuance error:', error)
        return NextResponse.json(
          { error: 'Failed to issue credential' },
          { status: 500 }
        )
      }
    })
  }
)
