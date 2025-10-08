import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, JWTPayload } from './did'
import { prisma } from '@/lib/prisma'

/**
 * Authentication middleware for API routes
 *
 * Extracts and verifies JWT token from Authorization header or cookie.
 */

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string
    did: string
    email?: string
    name?: string
  }
}

/**
 * Extract token from request
 *
 * Checks Authorization header (Bearer token) and auth-token cookie
 */
function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check cookie
  const cookieToken = request.cookies.get('auth-token')?.value
  if (cookieToken) {
    return cookieToken
  }

  return null
}

/**
 * Authenticate request and return user data
 *
 * @param request - Next.js request object
 * @returns User data if authenticated, null otherwise
 */
export async function authenticate(
  request: NextRequest
): Promise<{ id: string; did: string; email?: string; name?: string } | null> {
  try {
    // Extract token
    const token = extractToken(request)
    if (!token) {
      return null
    }

    // Verify token
    const payload = verifyToken(token)
    if (!payload || payload.type !== 'access') {
      return null
    }

    // Verify session exists and is valid
    const session = await prisma.session.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    })

    if (!session) {
      return null
    }

    // Update last active time
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    })

    return {
      id: session.user.id,
      did: session.user.did,
      email: session.user.email || undefined,
      name: session.user.name || undefined,
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

/**
 * Require authentication middleware
 *
 * Returns 401 if not authenticated, otherwise calls handler with user data
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return requireAuth(request, async (req, user) => {
 *     return NextResponse.json({ message: `Hello ${user.did}` })
 *   })
 * }
 */
export async function requireAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    user: { id: string; did: string; email?: string; name?: string }
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await authenticate(request)

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please authenticate with a valid DID.' },
      { status: 401 }
    )
  }

  return handler(request, user)
}

/**
 * Optional authentication middleware
 *
 * Calls handler with user data if authenticated, otherwise with null
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return optionalAuth(request, async (req, user) => {
 *     if (user) {
 *       return NextResponse.json({ message: `Hello ${user.did}` })
 *     }
 *     return NextResponse.json({ message: 'Hello guest' })
 *   })
 * }
 */
export async function optionalAuth(
  request: NextRequest,
  handler: (
    request: NextRequest,
    user: { id: string; did: string; email?: string; name?: string } | null
  ) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await authenticate(request)
  return handler(request, user)
}
