import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for ledger entries
 * B225C-FIN-012: Ledger Viewer API
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || 'demo-org'
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()
    const sortField = searchParams.get('sortField') || 'createdAt'
    const sortDirection = searchParams.get('sortDirection') || 'desc'
    const filterType = searchParams.get('filterType')
    const filterCurrency = searchParams.get('filterCurrency')
    const search = searchParams.get('search')

    // In production, this would fetch from Prisma LedgerEntry table
    // For now, return mock data
    const mockEntries = [
      {
        id: 'ledger-001',
        orgId: orgId,
        amount: 500000, // $5,000 in cents
        currency: 'USD',
        type: 'credit' as const,
        referenceId: 'purchase-001',
        relatedEventId: 'event-001',
        metadata: { source: 'marketplace' },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        relatedPurchase: {
          id: 'purchase-001',
          listingId: 'listing-001',
          status: 'completed',
        },
      },
      {
        id: 'ledger-002',
        orgId: orgId,
        amount: 1000000, // $10,000 in cents
        currency: 'USD',
        type: 'credit' as const,
        referenceId: 'recognition-001',
        relatedEventId: 'event-002',
        metadata: { source: 'revenue_recognition' },
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        relatedRecognition: {
          id: 'recognition-001',
          eventType: 'hireConfirmed',
          status: 'settled',
        },
      },
      {
        id: 'ledger-003',
        orgId: orgId,
        amount: 25000, // 25,000 VITA tokens
        currency: 'VITA',
        type: 'debit' as const,
        referenceId: 'settlement-001',
        relatedEventId: 'event-003',
        metadata: { source: 'settlement' },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        relatedSettlement: {
          id: 'settlement-001',
          txId: 'tx-abc123',
          status: 'completed',
        },
      },
    ]

    // Apply filters
    let filtered = mockEntries
    if (filterType && filterType !== 'all') {
      filtered = filtered.filter((e) => e.type === filterType)
    }
    if (filterCurrency && filterCurrency !== 'all') {
      filtered = filtered.filter((e) => e.currency === filterCurrency)
    }
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.id.toLowerCase().includes(searchLower) ||
          e.referenceId?.toLowerCase().includes(searchLower) ||
          e.relatedEventId?.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a]
      let bVal: any = b[sortField as keyof typeof b]
      if (sortField === 'createdAt') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    return NextResponse.json({ entries: filtered })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

