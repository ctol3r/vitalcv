import { NextRequest, NextResponse } from 'next/server'

/**
 * Saved searches API endpoint
 * B232C-SEARCH-014: SavedSearches & Alerts API
 *
 * Note: This uses in-memory storage for demo purposes.
 * In production, replace with database operations using Prisma.
 */

interface SavedSearch {
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
}

// Shared in-memory storage (in production, use database)
// This is a simple approach for demo - in production, use Prisma with user sessions
declare global {
  // eslint-disable-next-line no-var
  var savedSearchesStorage: SavedSearch[]
}

if (!global.savedSearchesStorage) {
  global.savedSearchesStorage = []
}

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from database with user authentication
    // Example: const searches = await prisma.savedSearch.findMany({ where: { userId } })
    return NextResponse.json({ searches: global.savedSearchesStorage })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, query, alertEnabled, alertFrequency, notificationChannels, filters } = body

    if (!name || !query) {
      return NextResponse.json({ error: 'Name and query are required' }, { status: 400 })
    }

    const newSearch: SavedSearch = {
      id: `saved-${Date.now()}`,
      name,
      query,
      filters,
      alertEnabled: alertEnabled || false,
      alertFrequency: alertFrequency || 'daily',
      notificationChannels: notificationChannels || ['email'],
      createdAt: new Date().toISOString(),
      matchCount: 0,
    }

    // In production, save to database with user authentication
    // Example: const saved = await prisma.savedSearch.create({ data: { ...newSearch, userId } })
    global.savedSearchesStorage.push(newSearch)

    return NextResponse.json({ search: newSearch }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

