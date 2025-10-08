import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/me
 *
 * Get current authenticated user's profile.
 *
 * Requires authentication.
 *
 * Response:
 * {
 *   "user": {
 *     "id": "user-id",
 *     "did": "did:key:...",
 *     "email": "user@example.com",
 *     "name": "User Name",
 *     "walletAddress": "0x...",
 *     "walletType": "metamask",
 *     "createdAt": "2024-10-08T00:00:00.000Z",
 *     "lastLoginAt": "2024-10-08T12:00:00.000Z"
 *   }
 * }
 */

export async function GET(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    try {
      // Fetch full user profile from database
      const userProfile = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          did: true,
          email: true,
          name: true,
          walletAddress: true,
          walletType: true,
          createdAt: true,
          lastLoginAt: true,
          // Don't expose publicKey or sensitive data
        },
      })

      if (!userProfile) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ user: userProfile })
    } catch (error) {
      console.error('Get user profile error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }
  })
}

/**
 * PATCH /api/auth/me
 *
 * Update current authenticated user's profile.
 *
 * Requires authentication.
 *
 * Request body:
 * {
 *   "email": "newemail@example.com",
 *   "name": "New Name",
 *   "walletAddress": "0x...",
 *   "walletType": "metamask"
 * }
 *
 * Response:
 * {
 *   "user": { ... updated user profile ... }
 * }
 */

export async function PATCH(request: NextRequest) {
  return requireAuth(request, async (req, user) => {
    try {
      const body = await req.json()

      // Only allow updating specific fields
      const allowedFields = ['email', 'name', 'walletAddress', 'walletType']
      const updates: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
      }

      // Validate email if provided
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(updates.email as string)) {
          return NextResponse.json(
            { error: 'Invalid email format' },
            { status: 400 }
          )
        }

        // Check if email is already taken
        const existingUser = await prisma.user.findFirst({
          where: {
            email: updates.email as string,
            NOT: { id: user.id },
          },
        })

        if (existingUser) {
          return NextResponse.json(
            { error: 'Email is already in use' },
            { status: 409 }
          )
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: updates,
        select: {
          id: true,
          did: true,
          email: true,
          name: true,
          walletAddress: true,
          walletType: true,
          createdAt: true,
          lastLoginAt: true,
        },
      })

      return NextResponse.json({ user: updatedUser })
    } catch (error) {
      console.error('Update user profile error:', error)
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      )
    }
  })
}
