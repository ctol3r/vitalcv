import { NextResponse } from 'next/server'

import { IssuerStoreError, rejectClaim } from '@/lib/issuer/store'
import type { RejectClaimPayload } from '@/lib/issuer/types'

export async function POST(
  request: Request,
  { params }: { params: { claimId: string } },
) {
  try {
    const payload = (await request.json()) as RejectClaimPayload
    const claim = rejectClaim(params.claimId, payload)
    return NextResponse.json({ claim }, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('issuer.reject', error)
    return NextResponse.json({ error: 'Unable to reject claim' }, { status: 500 })
  }
}










