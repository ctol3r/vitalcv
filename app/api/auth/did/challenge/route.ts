import { NextRequest, NextResponse } from 'next/server'
import { generateAuthChallenge, createAuthMessage } from '@/lib/auth/did'
import { withRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit'
import { z } from 'zod'

/**
 * POST /api/auth/did/challenge
 *
 * Generate a cryptographic challenge for DID authentication.
 *
 * Rate limited: 5 requests per minute per IP address
 *
 * Request body:
 * {
 *   "did": "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ8qH3gKFk"
 * }
 *
 * Response:
 * {
 *   "challenge": "hex-encoded-challenge",
 *   "message": "formatted message for signing",
 *   "expiresAt": "2024-10-08T16:00:00.000Z"
 * }
 */

const requestSchema = z.object({
  did: z.string().min(1, 'DID is required'),
})

export const POST = withRateLimit(
  'auth:challenge',
  RATE_LIMITS['auth:challenge'],
  async (request: NextRequest) => {
  try {
    // Parse and validate request body
    const body = await request.json()
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

    const { did } = validation.data

    // Validate DID format (basic check)
    if (!did.startsWith('did:')) {
      return NextResponse.json(
        { error: 'Invalid DID format. Must start with "did:"' },
        { status: 400 }
      )
    }

    // Generate challenge
    const { challenge, nonce, expiresAt } = await generateAuthChallenge(did)

    // Create the message to be signed
    const message = createAuthMessage(did, challenge, nonce)

    return NextResponse.json({
      challenge,
      message,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Challenge generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate challenge' },
      { status: 500 }
    )
  }
})
