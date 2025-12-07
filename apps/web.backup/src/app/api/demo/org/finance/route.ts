import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for finance dashboard data
 * B225C-FIN-011: Finance Dashboard API
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || 'demo-org'
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    // In production, this would fetch from Prisma/database
    // For now, return mock data that matches the schema
    const mockData = {
      summary: {
        totalRevenue: 12500000, // $125,000 in cents
        deferredRevenue: 2500000, // $25,000 in cents
        recognizedRevenue: 10000000, // $100,000 in cents
        pendingPayouts: 500000, // $5,000 in cents
        completedPayouts: 2000000, // $20,000 in cents
        outstandingRecognitionEvents: 12,
        currency: 'USD',
      },
      revenueBreakdown: {
        fiat: 10000000, // $100,000 in cents
        vita: 2500000, // 25,000 VITA tokens
        pending: 2500000, // $25,000 in cents
        recognized: 7500000, // $75,000 in cents
        settled: 5000000, // $50,000 in cents
      },
      recentEvents: [
        {
          id: 'rec-001',
          eventType: 'marketplacePurchase',
          amount: 500000, // $5,000 in cents
          currency: 'USD',
          status: 'recognized',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-002',
          eventType: 'hireConfirmed',
          amount: 1000000, // $10,000 in cents
          currency: 'USD',
          status: 'settled',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'rec-003',
          eventType: 'marketplacePurchase',
          amount: 250000, // $2,500 in cents
          currency: 'USD',
          status: 'pending',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    }

    return NextResponse.json(mockData)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

