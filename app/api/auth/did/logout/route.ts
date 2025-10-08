import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { invalidateSession } from '@/lib/auth/did'

/**
 * POST /api/auth/did/logout
 *
 * Logout and invalidate the current session.
 *
 * Requires authentication.
 *
 * Response:
 * {
 *   "message": "Logged out successfully"
 * }
 */

export async function POST(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    try {
      // Get token from header or cookie
      const token =
        req.headers.get('authorization')?.substring(7) ||
        req.cookies.get('auth-token')?.value

      if (token) {
        // Invalidate session in database
        await invalidateSession(token)
      }

      // Return response with cleared cookies
      const response = NextResponse.json({
        message: 'Logged out successfully',
      })

      // Clear auth cookies
      response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      })

      response.cookies.set('refresh-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/api/auth',
      })

      return response
    } catch (error) {
      console.error('Logout error:', error)
      return NextResponse.json(
        { error: 'Failed to logout' },
        { status: 500 }
      )
    }
  })
}
