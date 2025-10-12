/**
 * OIDC4VCI Credential Offer Endpoint
 *
 * POST /api/oidc4vci/offer
 * Creates a credential offer with pre-authorized code (OIDC4VCI §4)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { initRedis, storeOffer } from '@/lib/oidc4vci/storage'
import { generatePreAuthorizedCode, buildCredentialOffer, TTL, sanitizeForLog } from '@/lib/oidc4vci/utils'
import type { CredentialOfferRequest, CredentialOfferResponse } from '@/lib/oidc4vci/types'

// Initialize Redis on first request
let redisInitialized = false

export async function POST(request: NextRequest) {
  try {
    // Lazy Redis initialization
    if (!redisInitialized) {
      await initRedis()
      redisInitialized = true
    }

    const body: CredentialOfferRequest = await request.json()

    // Validation
    if (!body.credentialType || !body.issuerId) {
      return NextResponse.json(
        { error: 'credentialType and issuerId are required' },
        { status: 400 }
      )
    }

    // Generate pre-authorized code
    const preAuthCode = generatePreAuthorizedCode()
    const now = Date.now()
    const expiresAt = now + TTL.OFFER

    // Build credential offer
    const offer = buildCredentialOffer({
      credentialType: body.credentialType,
      issuerId: body.issuerId,
      preAuthorizedCode: preAuthCode,
      txCode: body.txCode,
    })

    // Store offer with TTL
    await storeOffer(preAuthCode, {
      offer,
      pre_authorized_code: preAuthCode,
      tx_code: body.txCode,
      created_at: now,
      expires_at: expiresAt,
      redeemed: false,
    })

    // Build response
    const encodedOffer = Buffer.from(JSON.stringify(offer)).toString('base64url')
    const issuerUrl = process.env.NEXT_PUBLIC_ISSUER_URL || 'https://vitalcv.com'
    const credentialOfferUri = `${issuerUrl}/api/oidc4vci/offer/${preAuthCode}`

    const response: CredentialOfferResponse = {
      offer,
      credential_offer_uri: credentialOfferUri,
      pre_authorized_code: preAuthCode,
      expires_at: new Date(expiresAt).toISOString(),
      expires_in: Math.floor(TTL.OFFER / 1000),
    }

    // Log (sanitized)
    console.log('[OIDC4VCI] Offer created:', sanitizeForLog({
      credentialType: body.credentialType,
      issuerId: body.issuerId,
      pre_authorized_code: preAuthCode,
      expires_at: response.expires_at,
    }))

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[OIDC4VCI] Offer creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create credential offer' },
      { status: 500 }
    )
  }
}
