/**
 * OIDC4VCI Nonce Endpoint
 *
 * GET/POST /api/oidc4vci/nonce
 * Returns fresh c_nonce for credential requests (OIDC4VCI §7)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { storeNonce } from '@/lib/oidc4vci/storage'
import { generateNonceResponse, TTL } from '@/lib/oidc4vci/utils'

export async function GET() {
  return handleNonceRequest()
}

export async function POST(request: NextRequest) {
  return handleNonceRequest()
}

async function handleNonceRequest() {
  try {
    const nonceResponse = generateNonceResponse()
    const now = Date.now()

    // Store nonce with TTL
    await storeNonce(nonceResponse.c_nonce, {
      c_nonce: nonceResponse.c_nonce,
      created_at: now,
      expires_at: now + TTL.NONCE,
    })

    return NextResponse.json(nonceResponse, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[OIDC4VCI] Nonce error:', error)
    return NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    )
  }
}
