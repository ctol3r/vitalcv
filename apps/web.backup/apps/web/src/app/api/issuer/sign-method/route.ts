import { NextResponse } from 'next/server'

import { IssuerStoreError, getSignatureMethod, setSignatureMethod } from '@/lib/issuer/store'
import type { SignatureMethod } from '@/lib/issuer/types'

export async function GET() {
  try {
    const state = getSignatureMethod()
    return NextResponse.json(state, { status: 200 })
  } catch (error) {
    console.error('issuer.sign-method.get', error)
    return NextResponse.json({ error: 'Failed to load signature method' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { method?: SignatureMethod }
    if (!body?.method) {
      throw new IssuerStoreError('Signature method is required')
    }
    if (!['ed25519-local', 'kms-managed'].includes(body.method)) {
      throw new IssuerStoreError('Unsupported signature method', 422)
    }
    const state = setSignatureMethod(body.method)
    return NextResponse.json(state, { status: 200 })
  } catch (error) {
    if (error instanceof IssuerStoreError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('issuer.sign-method.patch', error)
    return NextResponse.json({ error: 'Failed to update signature method' }, { status: 500 })
  }
}










