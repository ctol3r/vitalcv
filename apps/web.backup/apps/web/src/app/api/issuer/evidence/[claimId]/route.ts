import { NextResponse } from 'next/server'

import { IssuerStoreError, getClaimEvidence } from '@/lib/issuer/store'

export async function GET(
  _request: Request,
  { params }: { params: { claimId: string } },
) {
  try {
    const bundle = getClaimEvidence(params.claimId)
    return NextResponse.json({ evidence: bundle }, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('issuer.evidence', error)
    return NextResponse.json({ error: 'Failed to load claim evidence' }, { status: 500 })
  }
}










