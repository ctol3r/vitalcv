/**
 * OIDC4VCI Credential Endpoint
 *
 * POST /api/oidc4vci/credential
 * Issues credentials with access token + proof (OIDC4VCI §8)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { getToken, getNonce } from '@/lib/oidc4vci/storage'
import { generateMockCredential } from '@/lib/oidc4vci/utils'
import type { CredentialRequest, CredentialResponse } from '@/lib/oidc4vci/types'

export async function POST(request: NextRequest) {
  try {
    // Extract access token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.slice(7)

    // Validate access token
    const tokenData = await getToken(accessToken)
    if (!tokenData) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Invalid or expired access token' },
        { status: 401 }
      )
    }

    const body: Partial<CredentialRequest> = await request.json()

    // Validation
    if (!body.format) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'format is required' },
        { status: 400 }
      )
    }

    // Validate proof if provided (simplified - production should verify JWT signature)
    if (body.proof) {
      if (!body.proof.jwt) {
        return NextResponse.json(
          { error: 'invalid_proof', error_description: 'proof.jwt is required' },
          { status: 400 }
        )
      }

      // In production: verify JWT signature, check c_nonce binding
      // For now, just check c_nonce exists
      try {
        const jwtParts = body.proof.jwt.split('.')
        if (jwtParts.length !== 3) {
          throw new Error('Invalid JWT format')
        }
        const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString())

        if (payload.nonce) {
          const nonceData = await getNonce(payload.nonce)
          if (!nonceData) {
            return NextResponse.json(
              { error: 'invalid_proof', error_description: 'Invalid or expired c_nonce' },
              { status: 400 }
            )
          }
        }
      } catch (err) {
        console.warn('[OIDC4VCI] Proof validation error:', err)
      }
    }

    // Generate mock credential
    const credential = await generateMockCredential({
      credentialType: tokenData.credential_type,
      subjectId: tokenData.subject_id,
      issuerId: 'vitalcv-issuer-001',
    })

    const response: CredentialResponse = {
      credential,
      format: body.format,
    }

    console.log('[OIDC4VCI] Credential issued:', {
      credentialType: tokenData.credential_type,
      format: body.format,
    })

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[OIDC4VCI] Credential error:', error)
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to issue credential' },
      { status: 500 }
    )
  }
}
