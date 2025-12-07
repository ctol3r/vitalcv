import { NextResponse } from 'next/server'

import { IssuerStoreError, issueClaimViaAries } from '@/lib/issuer/store'

export async function POST(
  _request: Request,
  { params }: { params: { claimId: string } },
) {
  try {
    const result = issueClaimViaAries(params.claimId)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('issuer.issue.aries', error)
    return NextResponse.json({ error: 'Failed to issue via ACA-Py' }, { status: 500 })
  }
}










