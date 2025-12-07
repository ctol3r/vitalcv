import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract timeline events
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch timeline events from the database
    const mockEvents = [
      {
        id: 'event-001',
        contractId: id,
        eventType: 'created',
        description: 'Contract created',
        userId: 'user-001',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: {},
      },
      {
        id: 'event-002',
        contractId: id,
        eventType: 'status_changed',
        description: 'Status changed from draft to negotiating',
        userId: 'user-001',
        userName: 'John Doe',
        timestamp: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { from: 'draft', to: 'negotiating' },
      },
      {
        id: 'event-003',
        contractId: id,
        eventType: 'comment_added',
        description: 'Comment added: "Please review the revenue share terms"',
        userId: 'user-002',
        userName: 'Jane Smith',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { commentId: 'comment-001' },
      },
      {
        id: 'event-004',
        contractId: id,
        eventType: 'signed',
        description: 'Contract signed by all parties',
        userId: 'system',
        userName: 'System',
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { signatures: ['signature-001', 'signature-002'] },
      },
    ]

    return NextResponse.json({ events: mockEvents })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

