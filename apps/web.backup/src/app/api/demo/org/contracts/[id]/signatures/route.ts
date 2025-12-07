import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract signatures
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch signatures from the database
    const mockSignatures = [
      {
        id: 'signature-001',
        signatoryId: 'user-001',
        signatoryName: 'John Doe',
        signatoryEmail: 'john@example.com',
        role: 'CEO',
        signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        signatureMethod: 'digital',
        certificateUrl: '/api/demo/org/contracts/certificates/signature-001',
      },
      {
        id: 'signature-002',
        signatoryId: 'user-002',
        signatoryName: 'Jane Smith',
        signatoryEmail: 'jane@example.com',
        role: 'Legal Counsel',
        signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        signatureMethod: 'electronic',
      },
    ]

    return NextResponse.json({ signatures: mockSignatures })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

