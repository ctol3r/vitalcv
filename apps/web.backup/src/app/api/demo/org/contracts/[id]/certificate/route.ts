import { NextRequest, NextResponse } from 'next/server'

/**
 * API route for contract certificate of completion
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // In production, this would fetch certificate data from the database
    const mockCertificate = {
      contractId: id,
      version: '1.2',
      completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      allSignaturesComplete: true,
      signatures: [
        {
          id: 'signature-001',
          signatoryName: 'John Doe',
          signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'signature-002',
          signatoryName: 'Jane Smith',
          signedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      documentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      certificateUrl: `/api/demo/org/contracts/${id}/certificate/download`,
      signedPdfUrl: `/api/demo/org/contracts/${id}/download`,
    }

    return NextResponse.json({ certificate: mockCertificate })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

