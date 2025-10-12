/**
 * OIDC4VCI Deferred Credential Endpoint
 *
 * POST /api/oidc4vci/deferred
 * Placeholder for deferred credential issuance (OIDC4VCI §9)
 */

import { type NextRequest, NextResponse } from 'next/server'
import type { DeferredCredentialRequest, DeferredCredentialResponse } from '@/lib/oidc4vci/types'

export async function POST(request: NextRequest) {
  try {
    const body: Partial<DeferredCredentialRequest> = await request.json()

    if (!body.transaction_id) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'transaction_id is required' },
        { status: 400 }
      )
    }

    // Placeholder: return pending status with polling hint
    const response: DeferredCredentialResponse = {
      transaction_id: body.transaction_id,
      // In production: return credential if ready, otherwise keep transaction_id for polling
    }

    return NextResponse.json(response, {
      status: 202, // Accepted
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '5', // Poll after 5 seconds
      },
    })
  } catch (error) {
    console.error('[OIDC4VCI] Deferred error:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to process deferred request' },
      { status: 500 }
    )
  }
}
