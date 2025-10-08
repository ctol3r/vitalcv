import { NextRequest, NextResponse } from 'next/server'
import {
  verifyDIDAuth,
  generateAccessToken,
  generateRefreshToken,
  createSession,
} from '@/lib/auth/did'
import { z } from 'zod'

/**
 * POST /api/auth/did/verify
 *
 * Verify a signed challenge and authenticate the user.
 *
 * Request body:
 * {
 *   "did": "did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ8qH3gKFk",
 *   "challenge": "hex-encoded-challenge",
 *   "signature": "hex-encoded-signature",
 *   "publicKey": "hex-encoded-public-key"
 * }
 *
 * Response (success):
 * {
 *   "accessToken": "jwt-token",
 *   "refreshToken": "jwt-refresh-token",
 *   "expiresIn": 604800,
 *   "user": {
 *     "id": "user-id",
 *     "did": "did:key:..."
 *   }
 * }
 *
 * Response (failure):
 * {
 *   "error": "error message"
 * }
 */

const requestSchema = z.object({
  did: z.string().min(1, 'DID is required'),
  challenge: z.string().min(1, 'Challenge is required'),
  signature: z.string().min(1, 'Signature is required'),
  publicKey: z.string().min(1, 'Public key is required'),
})

export async function POST(request: NextRequest) {
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

    const { did, challenge, signature, publicKey } = validation.data

    // Verify DID authentication
    const authResult = await verifyDIDAuth(did, challenge, signature, publicKey)

    if (!authResult.valid) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Generate tokens
    const accessToken = generateAccessToken(authResult.userId!, authResult.did!)
    const refreshToken = generateRefreshToken(authResult.userId!, authResult.did!)

    // Create session in database
    await createSession(authResult.userId!, accessToken, refreshToken, request)

    // Set HTTP-only cookie for access token
    const response = NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      user: {
        id: authResult.userId,
        did: authResult.did,
      },
    })

    // Set secure cookie
    response.cookies.set('auth-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    // Set refresh token cookie
    response.cookies.set('refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Authentication verification error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
