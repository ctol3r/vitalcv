import { NextResponse } from 'next/server'

import { IssuerStoreError, listClaims, savePsv } from '@/lib/issuer/store'
import type { BoardLookupPayload, LicenseLookupPayload, NpdbSnapshotPayload } from '@/lib/issuer/types'

interface PsvRequestBody {
  boardLookup: BoardLookupPayload
  licenseLookup: LicenseLookupPayload
  npdbSnapshot: NpdbSnapshotPayload
  notes?: string
  verifiedBy: string
}

export async function POST(request: Request, { params }: { params: { claimId: string } }) {
  try {
    const payload = (await request.json()) as PsvRequestBody
    const psv = savePsv(params.claimId, payload)
    const updatedClaim = listClaims(params.claimId)

    return NextResponse.json(
      {
        claimId: params.claimId,
        status: 'ready-to-issue',
        psv,
        claim: updatedClaim,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      )
    }

    console.error('issuer.psv', error)
    return NextResponse.json({ error: 'Failed to persist PSV results' }, { status: 500 })
  }
}

