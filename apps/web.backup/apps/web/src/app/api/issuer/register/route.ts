import { NextResponse } from 'next/server'

import { IssuerStoreError, registerIssuer } from '@/lib/issuer/store'
import type { IssuerRegistrationPayload } from '@/lib/issuer/types'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as IssuerRegistrationPayload
    const result = registerIssuer(payload)
    return NextResponse.json(result, { status: 200 })
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

    console.error('issuer.register', error)
    return NextResponse.json({ error: 'Failed to register issuer' }, { status: 500 })
  }
}

