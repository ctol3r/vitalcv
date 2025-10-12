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
import { generateTokenResponse, validatePKCE, generateNonce, TTL } from '@/lib/oidc4vci/utils'
import type { TokenRequest } from '@/lib/oidc4vci/types'
import { rateLimit, RateLimitPresets } from '@/lib/middleware/rate-limit'
import { createAuditLogger } from '@/lib/logging/audit'

async function handlePost(request: NextRequest) {
  const logger = createAuditLogger(request)

  try {
    const body: Partial<TokenRequest> = await request.json()

    // Validation
    if (body.grant_type !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
      logger.logTokenRejected({
        reason: 'Unsupported grant_type',
        error_code: 'invalid_grant',
        status_code: 400,
      })
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Unsupported grant_type' },
        { status: 400 }
      )
    }

    if (!body['pre-authorized_code']) {
      logger.logTokenRejected({
        reason: 'Missing pre-authorized_code',
        error_code: 'invalid_request',
        status_code: 400,
      })
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'pre-authorized_code is required' },
        { status: 400 }
      )
    }

    const preAuthCode = body['pre-authorized_code']

    // Retrieve offer
    const storedOffer = await getOffer(preAuthCode)
    if (!storedOffer) {
      logger.logTokenRejected({
        reason: 'Invalid or expired pre-authorized code',
        error_code: 'invalid_grant',
        status_code: 401,
      })
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or expired pre-authorized code' },
        { status: 401 }
      )
    }

    // Check if already redeemed (replay protection)
    if (storedOffer.redeemed) {
      logger.logTokenRejected({
        reason: 'Pre-authorized code already used (replay attack)',
        error_code: 'invalid_grant',
        status_code: 409,
      })
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Pre-authorized code has already been used' },
        { status: 409 }
      )
    }

    // Validate PKCE if code_challenge was set
    if (storedOffer.code_challenge) {
      if (!body.code_verifier) {
        logger.logTokenRejected({
          reason: 'Missing code_verifier for PKCE',
          error_code: 'invalid_request',
          status_code: 400,
        })
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'code_verifier is required for PKCE' },
          { status: 400 }
        )
      }

      const pkceValid = validatePKCE(body.code_verifier, storedOffer.code_challenge)
      if (!pkceValid) {
        logger.logPKCEFailed()
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid code_verifier' },
          { status: 401 }
        )
      }
    }

    // Validate tx_code if required
    if (storedOffer.tx_code) {
      if (!body.tx_code) {
        logger.logTokenRejected({
          reason: 'Missing tx_code',
          error_code: 'invalid_request',
          status_code: 400,
        })
        return NextResponse.json(
          { error: 'invalid_request', error_description: 'tx_code is required' },
          { status: 400 }
        )
      }

      if (body.tx_code !== storedOffer.tx_code) {
        logger.logTokenRejected({
          reason: 'Invalid tx_code',
          error_code: 'invalid_grant',
          status_code: 401,
        })
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid tx_code' },
          { status: 401 }
        )
      }
    }

    // Mark offer as redeemed (atomic)
    const redeemed = await redeemOffer(preAuthCode)
    if (!redeemed) {
      logger.logTokenRejected({
        reason: 'Failed to redeem offer (race condition)',
        error_code: 'invalid_grant',
        status_code: 409,
      })
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

    // Audit log
    logger.logTokenIssued({
      credential_type: storedOffer.offer.credential_configuration_ids[0],
      pkce_used: !!storedOffer.code_challenge,
      tx_code_used: !!storedOffer.tx_code,
    })

    return NextResponse.json(tokenResponse, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logger.logError({
      message: 'Token issuance failed',
      error,
    })

    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to issue token' },
      { status: 500 }
    )
  }
}

// Apply rate limiting
export const POST = rateLimit(RateLimitPresets.TOKEN)(handlePost)
