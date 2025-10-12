/**
 * JWT Signing and Verification
 *
 * Implements proper JWT signing with ES256, ES256K, and EdDSA algorithms
 */

import crypto from 'crypto'
import { getIssuerKeyPair, type KeyPair } from './keys'

export interface JWTHeader {
  alg: string
  typ: 'JWT'
  kid: string
}

export interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  nonce?: string
  [key: string]: unknown
}

/**
 * Sign a JWT with the issuer's private key
 */
export async function signJWT(
  payload: JWTPayload,
  keyPair?: KeyPair
): Promise<string> {
  const keys = keyPair || getIssuerKeyPair()

  // Build header
  const header: JWTHeader = {
    alg: keys.algorithm,
    typ: 'JWT',
    kid: keys.kid,
  }

  // Encode header and payload
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')

  // Create signature input
  const signatureInput = `${headerB64}.${payloadB64}`

  // Sign
  const signature = crypto.sign(
    getNodeAlgorithm(keys.algorithm),
    Buffer.from(signatureInput),
    {
      key: keys.privateKey,
      dsaEncoding: keys.algorithm.startsWith('ES') ? 'ieee-p1363' : undefined,
    }
  )

  const signatureB64 = signature.toString('base64url')

  return `${signatureInput}.${signatureB64}`
}

/**
 * Verify a JWT signature
 */
export async function verifyJWT(
  jwt: string,
  keyPair?: KeyPair
): Promise<{ valid: boolean; header?: JWTHeader; payload?: JWTPayload; error?: string }> {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' }
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // Decode header and payload
    const header: JWTHeader = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
    const payload: JWTPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return { valid: false, header, payload, error: 'JWT expired' }
    }

    // Check not before
    if (payload.nbf && Date.now() / 1000 < payload.nbf) {
      return { valid: false, header, payload, error: 'JWT not yet valid' }
    }

    // Verify signature if key pair provided
    if (keyPair) {
      const signatureInput = `${headerB64}.${payloadB64}`
      const signature = Buffer.from(signatureB64, 'base64url')

      const verified = crypto.verify(
        getNodeAlgorithm(header.alg as any),
        Buffer.from(signatureInput),
        {
          key: keyPair.publicKey,
          dsaEncoding: header.alg.startsWith('ES') ? 'ieee-p1363' : undefined,
        },
        signature
      )

      if (!verified) {
        return { valid: false, header, payload, error: 'Invalid signature' }
      }
    }

    return { valid: true, header, payload }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}

/**
 * Decode JWT without verification (use with caution)
 */
export function decodeJWT(jwt: string): {
  header?: JWTHeader
  payload?: JWTPayload
  error?: string
} {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) {
      return { error: 'Invalid JWT format' }
    }

    const header: JWTHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const payload: JWTPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())

    return { header, payload }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Decode failed',
    }
  }
}

/**
 * Map JWT algorithm to Node.js crypto algorithm
 */
function getNodeAlgorithm(alg: 'ES256' | 'ES256K' | 'EdDSA'): string {
  switch (alg) {
    case 'ES256':
      return 'sha256'
    case 'ES256K':
      return 'sha256'
    case 'EdDSA':
      return undefined as any // Ed25519 doesn't need a hash algorithm
    default:
      throw new Error(`Unsupported algorithm: ${alg}`)
  }
}

/**
 * Create a signed credential JWT
 */
export async function signCredentialJWT(params: {
  credential: Record<string, unknown>
  issuerId: string
  subjectId?: string
  expiresIn?: number
}): Promise<string> {
  const keyPair = getIssuerKeyPair()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (params.expiresIn || 365 * 24 * 60 * 60) // Default 1 year

  const payload: JWTPayload = {
    vc: params.credential,
    iss: params.issuerId,
    sub: params.subjectId || params.credential.credentialSubject?.id,
    iat: now,
    exp,
    jti: crypto.randomBytes(16).toString('hex'),
  }

  return signJWT(payload, keyPair)
}

/**
 * Create a signed proof JWT (for credential requests)
 */
export async function signProofJWT(params: {
  nonce: string
  audience: string
  holder: string
  issuedAt?: number
}): Promise<string> {
  const keyPair = getIssuerKeyPair()
  const now = Math.floor(Date.now() / 1000)

  const payload: JWTPayload = {
    iss: params.holder,
    aud: params.audience,
    nonce: params.nonce,
    iat: params.issuedAt || now,
    exp: now + 5 * 60, // 5 minutes
  }

  return signJWT(payload, keyPair)
}

/**
 * Verify proof JWT for credential requests
 */
export async function verifyProofJWT(params: {
  jwt: string
  expectedNonce: string
  expectedAudience: string
}): Promise<{ valid: boolean; holder?: string; error?: string }> {
  const result = await verifyJWT(params.jwt)

  if (!result.valid) {
    return { valid: false, error: result.error }
  }

  const { payload } = result

  if (payload!.nonce !== params.expectedNonce) {
    return { valid: false, error: 'Invalid nonce' }
  }

  if (payload!.aud !== params.expectedAudience) {
    return { valid: false, error: 'Invalid audience' }
  }

  return {
    valid: true,
    holder: payload!.iss as string,
  }
}
