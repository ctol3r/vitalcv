import { NextResponse } from 'next/server'

import { IssuerStoreError, listClaims } from '@/lib/issuer/store'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const claimId = searchParams.get('claimId') ?? undefined
    const claims = listClaims(claimId ?? undefined)

    if (claimId) {
      return NextResponse.json({ claim: claims }, { status: 200 })
    }

    return NextResponse.json({ claims }, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error('issuer.claims', error)
    return NextResponse.json({ error: 'Failed to load claims' }, { status: 500 })
  }
}

