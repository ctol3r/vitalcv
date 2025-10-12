/**
 * OIDC4VCI Credential Offer Endpoint
 *
 * POST /api/oidc4vci/offer
 * Creates a credential offer with pre-authorized code (OIDC4VCI §4)
 *
 * Rate limit: 10 requests per minute
 */

import { type NextRequest, NextResponse } from 'next/server'
import { initRedis, storeOffer } from '@/lib/oidc4vci/storage'
import { generatePreAuthorizedCode, buildCredentialOffer, TTL } from '@/lib/oidc4vci/utils'
import type { CredentialOfferRequest, CredentialOfferResponse } from '@/lib/oidc4vci/types'
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rate-limit'
import { createAuditLogger } from '@/lib/logging/audit'

// Initialize Redis on first request
let redisInitialized = false

async function handlePost(request: NextRequest) {
  const logger = createAuditLogger(request)

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

    // Audit log
    logger.logOfferCreated({
      credential_type: body.credentialType,
      issuer_id: body.issuerId,
      pre_auth_code: preAuthCode,
      ttl_seconds: Math.floor(TTL.OFFER / 1000),
    })

    return NextResponse.json(response, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logger.logError({
      message: 'Offer creation failed',
      error,
    })

    return NextResponse.json(
      { error: 'Failed to create credential offer' },
      { status: 500 }
    )
  }
}

// Apply rate limiting
export const POST = rateLimit(RateLimitPresets.OFFER)(handlePost)
