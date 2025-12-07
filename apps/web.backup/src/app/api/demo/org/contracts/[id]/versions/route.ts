import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract versions
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch versions from the database
    const mockVersions = [
      {
        id: 'version-001',
        version: '1.0',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-001',
        createdByName: 'John Doe',
        changes: 'Initial contract version',
      },
      {
        id: 'version-002',
        version: '1.1',
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-002',
        createdByName: 'Jane Smith',
        changes: 'Updated revenue share terms',
      },
      {
        id: 'version-003',
        version: '1.2',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-001',
        createdByName: 'John Doe',
        changes: 'Final signed version',
      },
    ]

    return NextResponse.json({ versions: mockVersions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

