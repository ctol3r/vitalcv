import { NextRequest, NextResponse } from 'next/server'

/**
 * Individual saved search API endpoint
 * B232C-SEARCH-014: SavedSearches & Alerts API
 *
 * Note: This uses in-memory storage for demo purposes.
 * In production, replace with database operations using Prisma.
 */

// Shared in-memory storage (in production, use database)
// This is a simple approach for demo - in production, use Prisma with user sessions
declare global {
  // eslint-disable-next-line no-var
  var savedSearchesStorage: Array<{
    id: string
    name: string
    query: string
    filters?: Record<string, string[]>
    alertEnabled: boolean
    alertFrequency: 'realtime' | 'daily' | 'weekly'
    notificationChannels: ('email' | 'in-app')[]
    createdAt: string
    lastTriggered?: string
    matchCount?: number
  }>
}

if (!global.savedSearchesStorage) {
  global.savedSearchesStorage = []
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const id = params.id

    // In production, update in database with user authentication
    const index = global.savedSearchesStorage.findIndex((s) => s.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 })
    }

    global.savedSearchesStorage[index] = { ...global.savedSearchesStorage[index], ...body }

    return NextResponse.json({ search: global.savedSearchesStorage[index] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    // In production, delete from database with user authentication
    const index = global.savedSearchesStorage.findIndex((s) => s.id === id)
    if (index === -1) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 })
    }

    global.savedSearchesStorage.splice(index, 1)

    return NextResponse.json({ message: 'Saved search deleted' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

