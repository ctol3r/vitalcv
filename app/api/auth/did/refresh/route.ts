import { NextRequest, NextResponse } from 'next/server'
import { refreshAccessToken } from '@/lib/auth/did'
import { z } from 'zod'

/**
 * POST /api/auth/did/refresh
 *
 * Refresh an expired access token using a valid refresh token.
 *
 * Request body:
 * {
 *   "refreshToken": "jwt-refresh-token"
 * }
 *
 * Response (success):
 * {
 *   "accessToken": "new-jwt-token",
 *   "refreshToken": "new-jwt-refresh-token",
 *   "expiresIn": 604800
 * }
 *
 * Response (failure):
 * {
 *   "error": "Invalid or expired refresh token"
 * }
 */

const requestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export async function POST(request: NextRequest) {
  try {
    // Try to get refresh token from body or cookie
    let refreshToken: string | undefined

    try {
      const body = await request.json()
      const validation = requestSchema.safeParse(body)
      if (validation.success) {
        refreshToken = validation.data.refreshToken
      }
    } catch {
      // If body parsing fails, try cookie
    }

    // Fallback to cookie if not in body
    if (!refreshToken) {
      refreshToken = request.cookies.get('refresh-token')?.value
    }

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Refresh the token
    const result = await refreshAccessToken(refreshToken)

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    // Return new tokens
    const response = NextResponse.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    })

    // Update cookies
    response.cookies.set('auth-token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    response.cookies.set('refresh-token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/api/auth',
    })

    return response
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}
