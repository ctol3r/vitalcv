import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for revenue recognition schedule
 * B225C-FIN-013: Revenue Recognition Schedule API
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || 'demo-org'
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    // In production, this would fetch from Prisma RevenueRecognition table
    // For now, return mock data
    const mockEntries = [
      {
        id: 'rec-001',
        eventId: 'event-001',
        eventType: 'marketplacePurchase',
        orgId: orgId,
        revenueType: 'FIAT' as const,
        amount: 500000, // $5,000 in cents
        recognizedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'recognized' as const,
        metadata: { listingId: 'listing-001' },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rec-002',
        eventId: 'event-002',
        eventType: 'hireConfirmed',
        orgId: orgId,
        revenueType: 'FIAT' as const,
        amount: 1000000, // $10,000 in cents
        recognizedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        cashSettledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        settlementTxId: 'tx-abc123',
        status: 'settled' as const,
        metadata: { jobId: 'job-001', applicationId: 'app-001' },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rec-003',
        eventId: 'event-003',
        eventType: 'marketplacePurchase',
        orgId: orgId,
        revenueType: 'VITA' as const,
        amount: 25000, // 25,000 VITA tokens
        recognizedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'pending' as const,
        metadata: { listingId: 'listing-002' },
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rec-004',
        eventId: 'event-004',
        eventType: 'applicationCreated',
        orgId: orgId,
        revenueType: 'FIAT' as const,
        amount: 250000, // $2,500 in cents
        recognizedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        cashSettledAt: null,
        settlementTxId: null,
        status: 'recognized' as const,
        metadata: { jobId: 'job-002', applicationId: 'app-002' },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    return NextResponse.json({ entries: mockEntries })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

