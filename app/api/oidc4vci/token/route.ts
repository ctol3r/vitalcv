/**
 * OIDC4VCI Token Endpoint
 *
 * POST /api/oidc4vci/token
 * Exchanges pre-authorized code for access token (OIDC4VCI §6 + §3.5)
 * Supports PKCE S256 and optional tx_code
 *
 * Rate limit: 5 requests per minute
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getOffer, redeemOffer, storeToken, storeNonce } from '@/lib/oidc4vci/storage'
import { generateTokenResponse, validatePKCE, generateNonce, TTL, sanitizeForLog } from '@/lib/oidc4vci/utils'
import type { TokenRequest } from '@/lib/oidc4vci/types'
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rate-limit'

async function handlePost(request: NextRequest) {
  try {
    const body: Partial<TokenRequest> = await request.json()

    // Validation
    if (body.grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Unsupported grant_type' },
        { status: 400 }
      )
    }

    if (!body['pre-authorized_code']) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'pre-authorized_code is required' },
        { status: 400 }
      )
    }

    const preAuthCode = body['pre-authorized_code']

    // Retrieve offer
    const storedOffer = await getOffer(preAuthCode)
    if (!storedOffer) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired pre-authorized code' },
        { status: 401 }
      )
    }

    // Check if already redeemed (replay protection)
    if (storedOffer.redeemed) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Pre-authorized code has already been used' },
        { status: 409 }
      )
    }

    // Validate PKCE if code_challenge was set
    if (storedOffer.code_challenge) {
      if (!body.code_verifier) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'code_verifier is required for PKCE' },
          { status: 400 }
        )
      }

      const pkceValid = validatePKCE(body.code_verifier, storedOffer.code_challenge)
      if (!pkceValid) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
          { status: 401 }
        )
      }
    }

    // Validate tx_code if required
    if (storedOffer.tx_code) {
      if (!body.tx_code) {
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'tx_code is required' },
          { status: 400 }
        )
      }

      if (body.tx_code !== storedOffer.tx_code) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid tx_code' },
          { status: 401 }
        )
      }
    }

    // Mark offer as redeemed (atomic)
    const redeemed = await redeemOffer(preAuthCode)
    if (!redeemed) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Failed to redeem offer' },
        { status: 409 }
      )
    }

    // Generate token response
    const tokenResponse = generateTokenResponse(preAuthCode)
    const now = Date.now()

    // Store access token
    await storeToken(tokenResponse.access_token, {
      access_token: tokenResponse.access_token,
      pre_authorized_code: preAuthCode,
      credential_type: storedOffer.offer.credential_configuration_ids[0],
      created_at: now,
      expires_at: now + TTL.TOKEN,
    })

    // Store c_nonce
    await storeNonce(tokenResponse.c_nonce, {
      c_nonce: tokenResponse.c_nonce,
      created_at: now,
      expires_at: now + TTL.NONCE,
    })

    // Log (sanitized)
    console.log('[OIDC4VCI] Token issued:', sanitizeForLog({
      pre_authorized_code: preAuthCode,
      access_token: tokenResponse.access_token,
      c_nonce: tokenResponse.c_nonce,
    }))

    return NextResponse.json(tokenResponse, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[OIDC4VCI] Token error:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to issue token' },
      { status: 500 }
    )
  }
}

// Apply rate limiting
export const POST = rateLimit(RateLimitPresets.TOKEN)(handlePost)
