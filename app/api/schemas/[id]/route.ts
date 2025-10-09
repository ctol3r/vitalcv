import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { optionalAuth } from '@/lib/auth/middleware'

/**
 * GET /api/schemas/[id]
 *
 * Get a specific credential schema by ID or type.
 *
 * Response:
 * {
 *   "schema": { ...schema... }
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      const { id } = params

      // Try to find by ID or type
      const schema = await prisma.credentialSchema.findFirst({
        where: {
          OR: [{ id }, { type: id }],
        },
      })

      if (!schema) {
        return NextResponse.json(
          { error: 'Schema not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ schema })
    } catch (error) {
      console.error('Fetch schema error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch schema' },
        { status: 500 }
      )
    }
  })
}

/**
 * PATCH /api/schemas/[id]
 *
 * Update a credential schema.
 *
 * Requires authentication.
 *
 * Request body:
 * {
 *   "name": "New Name",
 *   "description": "New description",
 *   "active": false
 * }
 *
 * Response:
 * {
 *   "schema": { ...updated schema... }
 * }
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      // TODO: Require authentication and admin role
      // if (!user) {
      //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      // }

      const { id } = params
      const body = await req.json()

      // Find existing schema
      const existing = await prisma.credentialSchema.findUnique({
        where: { id },
      })

      if (!existing) {
        return NextResponse.json(
          { error: 'Schema not found' },
          { status: 404 }
        )
      }

      // Only allow updating specific fields
      const allowedFields = ['name', 'description', 'active']
      const updates: Record<string, unknown> = {}

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field]
        }
      }

      // Update schema
      const schema = await prisma.credentialSchema.update({
        where: { id },
        data: updates,
      })

      return NextResponse.json({ schema })
    } catch (error) {
      console.error('Update schema error:', error)
      return NextResponse.json(
        { error: 'Failed to update schema' },
        { status: 500 }
      )
    }
  })
}

/**
 * DELETE /api/schemas/[id]
 *
 * Delete (deactivate) a credential schema.
 *
 * Requires authentication.
 *
 * Response:
 * {
 *   "message": "Schema deactivated successfully"
 * }
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return optionalAuth(request, async (req, user) => {
    try {
      // TODO: Require authentication and admin role
      // if (!user) {
      //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      // }

      const { id } = params

      // Check if schema exists
      const existing = await prisma.credentialSchema.findUnique({
        where: { id },
        include: {
          _count: {
            select: { credentials: true },
          },
        },
      })

      if (!existing) {
        return NextResponse.json(
          { error: 'Schema not found' },
          { status: 404 }
        )
      }

      // If credentials exist using this schema, deactivate instead of delete
      if (existing._count.credentials > 0) {
        await prisma.credentialSchema.update({
          where: { id },
          data: { active: false },
        })

        return NextResponse.json({
          message: `Schema deactivated. ${existing._count.credentials} credentials still reference this schema.`,
        })
      }

      // If no credentials, safe to delete
      await prisma.credentialSchema.delete({
        where: { id },
      })

      return NextResponse.json({
        message: 'Schema deleted successfully',
      })
    } catch (error) {
      console.error('Delete schema error:', error)
      return NextResponse.json(
        { error: 'Failed to delete schema' },
        { status: 500 }
      )
    }
  })
}
