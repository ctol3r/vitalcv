import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract management
 * B231C-CON-011: ContractManager API
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orgId = searchParams.get('orgId') || 'demo-org'
    const status = searchParams.get('status')

    // In production, this would fetch from Prisma/database
    // For now, return mock data that matches the schema
    const mockContracts = [
      {
        id: 'contract-001',
        counterpartyId: 'partner-001',
        counterpartyName: 'Acme Healthcare Inc.',
        templateId: 'template-revenue-share-001',
        templateName: 'Standard Revenue Share Agreement',
        status: 'signed',
        effectiveDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        revenueShareId: 'revenue-share-001',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'contract-002',
        counterpartyId: 'partner-002',
        counterpartyName: 'MedTech Solutions LLC',
        templateId: 'template-service-001',
        templateName: 'Service Agreement',
        status: 'negotiating',
        effectiveDate: null,
        expiryDate: null,
        revenueShareId: null,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'contract-003',
        counterpartyId: 'partner-003',
        counterpartyName: 'HealthData Partners',
        templateId: null,
        templateName: null,
        status: 'draft',
        effectiveDate: null,
        expiryDate: null,
        revenueShareId: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    let filteredContracts = mockContracts
    if (status && status !== 'all') {
      filteredContracts = mockContracts.filter((c) => c.status === status)
    }

    return NextResponse.json({ contracts: filteredContracts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId, counterpartyInfo, templateId, revenueShareTerms, signatories } = body

    // In production, this would create a contract in the database
    // For now, return a mock contract ID
    const contractId = `contract-${Date.now()}`

    return NextResponse.json({
      contractId,
      message: 'Contract created successfully',
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

