/**
 * OIDC4VCI Utilities
 *
 * Core utilities for OpenID for Verifiable Credential Issuance
 */

import crypto from 'crypto'
import type { CredentialOffer, TokenResponse, NonceResponse } from './types'

const ISSUER_BASE_URL = process.env.NEXT_PUBLIC_ISSUER_URL || 'https://vitalcv.com'
const OFFER_TTL_MS = 10 * 60 * 1000 // 10 minutes
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour
const NONCE_TTL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Generate a cryptographically secure pre-authorized code
 */
export function generatePreAuthorizedCode(): string {
  return `pre-auth_${crypto.randomBytes(32).toString('base64url')}`
}

/**
 * Generate a cryptographically secure access token
 */
export function generateAccessToken(): string {
  return `at_${crypto.randomBytes(32).toString('base64url')}`
}

/**
 * Generate a cryptographically secure c_nonce
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Build a credential offer
 */
export function buildCredentialOffer(params: {
  credentialType: string
  issuerId: string
  preAuthorizedCode: string
  txCode?: string
}): CredentialOffer {
  return {
    credential_issuer: `${ISSUER_BASE_URL}`,
    credential_configuration_ids: [params.credentialType],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': params.preAuthorizedCode,
        ...(params.txCode && {
          tx_code: {
            input_mode: 'numeric' as const,
            length: 6,
            description: 'Enter the 6-digit code from your email',
          },
        }),
      },
    },
  }
}

/**
 * Validate PKCE S256 code_verifier
 */
export function validatePKCE(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false

  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return hash === codeChallenge
}

/**
 * Generate a token response
 */
export function generateTokenResponse(preAuthCode: string): TokenResponse {
  const accessToken = generateAccessToken()
  const cNonce = generateNonce()

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: Math.floor(TOKEN_TTL_MS / 1000),
    c_nonce: cNonce,
    c_nonce_expires_in: Math.floor(NONCE_TTL_MS / 1000),
  }
}

/**
 * Generate a nonce response
 */
export function generateNonceResponse(): NonceResponse {
  return {
    c_nonce: generateNonce(),
    c_nonce_expires_in: Math.floor(NONCE_TTL_MS / 1000),
  }
}

/**
 * Get TTL constants
 */
export const TTL = {
  OFFER: OFFER_TTL_MS,
  TOKEN: TOKEN_TTL_MS,
  NONCE: NONCE_TTL_MS,
} as const

/**
 * Generate a signed credential with real cryptographic keys
 */
export async function generateSignedCredential(params: {
  credentialType: string
  subjectId?: string
  issuerId: string
}): Promise<string> {
  const { signCredentialJWT } = await import('@/lib/crypto/jwt')
  const { getIssuerKeyPair } = await import('@/lib/crypto/keys')

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 365 * 24 * 60 * 60 // 1 year
  const keyPair = getIssuerKeyPair()

  const issuerDid = keyPair.did
  const issuerId = `${ISSUER_BASE_URL}/issuers/${params.issuerId}`

  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1',
    ],
    type: ['VerifiableCredential', params.credentialType],
    issuer: {
      id: issuerDid,
      name: 'VitalCV Credential Issuer',
    },
    issuanceDate: new Date(now * 1000).toISOString(),
    expirationDate: new Date(exp * 1000).toISOString(),
    credentialSubject: {
      id: params.subjectId || `did:example:${crypto.randomBytes(16).toString('hex')}`,
      type: params.credentialType,
      licenseNumber: `LIC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      issuer: 'California Medical Board',
      issuedDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(exp * 1000).toISOString().split('T')[0],
    },
    credentialStatus: {
      id: `${ISSUER_BASE_URL}/api/status/1#${Math.floor(Math.random() * 100000)}`,
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: String(Math.floor(Math.random() * 100000)),
      statusListCredential: `${ISSUER_BASE_URL}/api/status/1/credential`,
    },
  }

  // Sign the credential with real keys
  const jwt = await signCredentialJWT({
    credential,
    issuerId: issuerDid,
    subjectId: credential.credentialSubject.id,
    expiresIn: 365 * 24 * 60 * 60,
  })

  return jwt
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use generateSignedCredential instead
 */
export const generateMockCredential = generateSignedCredential

/**
 * Sanitize sensitive data for logging
 */
export function sanitizeForLog(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...data }
  const sensitiveFields = ['pre-authorized_code', 'access_token', 'c_nonce', 'code_verifier', 'tx_code']

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}
