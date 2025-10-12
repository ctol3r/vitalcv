/**
 * StatusList2021 Credential Endpoint
 *
 * GET /api/status/:id/credential
 * Returns a StatusList2021 credential (VC DM 2.0 §4.8)
 */

import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const ENABLE_STATUS_LIST = process.env.ENABLE_STATUS_LIST === 'true'

  if (!ENABLE_STATUS_LIST) {
    return NextResponse.json(
      { error: 'Status list feature is disabled' },
      { status: 501 }
    )
  }

  const listId = params.id

  // Mock StatusList2021 credential
  // In production: fetch from database, generate bitmap
  const statusListCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1',
    ],
    id: `${process.env.NEXT_PUBLIC_ISSUER_URL}/api/status/${listId}/credential`,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer: `${process.env.NEXT_PUBLIC_ISSUER_URL}/issuers/vitalcv-issuer-001`,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `${process.env.NEXT_PUBLIC_ISSUER_URL}/api/status/${listId}`,
      type: 'StatusList2021',
      statusPurpose: 'revocation',
      encodedList: 'H4sIAAAAAAAA_-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA', // Base64-encoded GZIP bitstring
    },
  }

  return NextResponse.json(statusListCredential, {
    headers: {
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
  })
}
