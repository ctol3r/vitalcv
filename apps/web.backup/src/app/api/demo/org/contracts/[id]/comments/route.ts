import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract comments
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch comments from the database
    const mockComments = [
      {
        id: 'comment-001',
        contractId: id,
        authorId: 'user-001',
        authorName: 'John Doe',
        content: 'Please review the revenue share terms in section 3.2.',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'comment-002',
        contractId: id,
        authorId: 'user-002',
        authorName: 'Jane Smith',
        content: 'I agree with the terms. Ready to proceed with signing.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    return NextResponse.json({ comments: mockComments })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

