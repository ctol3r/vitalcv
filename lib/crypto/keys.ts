/**
 * Cryptographic Key Management
 *
 * Handles key generation, storage, and DID:key resolution
 * Supports ES256, ES256K, and EdDSA algorithms
 */

import crypto from 'crypto'

export type KeyAlgorithm = 'ES256' | 'ES256K' | 'EdDSA'

export interface KeyPair {
  publicKey: crypto.KeyObject
  privateKey: crypto.KeyObject
  algorithm: KeyAlgorithm
  kid: string
  did: string
}

export interface JWK {
  kty: string
  crv: string
  x: string
  y?: string
  d?: string
  kid?: string
  alg?: string
  use?: string
}

/**
 * Generate a new key pair for the specified algorithm
 */
export function generateKeyPair(algorithm: KeyAlgorithm): KeyPair {
  let publicKey: crypto.KeyObject
  let privateKey: crypto.KeyObject

  switch (algorithm) {
    case 'ES256':
      // P-256 (secp256r1) curve
      ({ publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      }))
      break

    case 'ES256K':
      // secp256k1 curve (Ethereum/Bitcoin compatible)
      ({ publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'secp256k1',
      }))
      break

    case 'EdDSA':
      // Ed25519 curve
      ({ publicKey, privateKey } = crypto.generateKeyPairSync('ed25519'))
      break

    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`)
  }

  const kid = generateKid(publicKey)
  const did = generateDid(publicKey, algorithm)

  return {
    publicKey,
    privateKey,
    algorithm,
    kid,
    did,
  }
}

/**
 * Generate a Key ID (kid) from public key
 */
function generateKid(publicKey: crypto.KeyObject): string {
  const jwk = publicKey.export({ format: 'jwk' })
  const thumbprint = crypto.createHash('sha256').update(JSON.stringify(jwk)).digest('base64url')
  return thumbprint.substring(0, 16)
}

/**
 * Generate a DID:key from public key
 *
 * DID:key uses multicodec prefixes + base58btc encoding
 * For simplicity, using a shortened version with hex encoding
 */
function generateDid(publicKey: crypto.KeyObject, algorithm: KeyAlgorithm): string {
  const jwk = publicKey.export({ format: 'jwk' })

  // Create a fingerprint from the public key
  let keyData: string

  if (algorithm === 'EdDSA') {
    // Ed25519: use x coordinate
    keyData = `ed25519:${jwk.x}`
  } else if (algorithm === 'ES256K') {
    // secp256k1: use x coordinate
    keyData = `secp256k1:${jwk.x}`
  } else {
    // P-256: use x coordinate
    keyData = `p256:${jwk.x}`
  }

  // Create a hash-based DID for simplicity
  const hash = crypto.createHash('sha256').update(keyData).digest('base64url')

  return `did:key:z${hash.substring(0, 32)}`
}

/**
 * Load key pair from environment variables or generate new one
 */
export function loadOrGenerateKeyPair(algorithm: KeyAlgorithm = 'ES256'): KeyPair {
  const privateKeyPem = process.env.ISSUER_PRIVATE_KEY
  const publicKeyPem = process.env.ISSUER_PUBLIC_KEY

  if (privateKeyPem && publicKeyPem) {
    try {
      const privateKey = crypto.createPrivateKey({
        key: Buffer.from(privateKeyPem, 'base64'),
        format: 'pem',
      })

      const publicKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyPem, 'base64'),
        format: 'pem',
      })

      const kid = generateKid(publicKey)
      const did = generateDid(publicKey, algorithm)

      console.log('[Crypto] Loaded key pair from environment')
      return {
        publicKey,
        privateKey,
        algorithm,
        kid,
        did,
      }
    } catch (error) {
      console.warn('[Crypto] Failed to load keys from environment, generating new:', error)
    }
  }

  console.log('[Crypto] Generating new key pair (no keys in environment)')
  return generateKeyPair(algorithm)
}

/**
 * Export key pair to PEM format for storage
 */
export function exportKeyPair(keyPair: KeyPair): {
  privateKeyPem: string
  publicKeyPem: string
  privateKeyBase64: string
  publicKeyBase64: string
} {
  const privateKeyPem = keyPair.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string

  const publicKeyPem = keyPair.publicKey.export({
    type: 'spki',
    format: 'pem',
  }) as string

  return {
    privateKeyPem,
    publicKeyPem,
    privateKeyBase64: Buffer.from(privateKeyPem).toString('base64'),
    publicKeyBase64: Buffer.from(publicKeyPem).toString('base64'),
  }
}

/**
 * Export public key to JWK format
 */
export function exportPublicKeyJWK(keyPair: KeyPair): JWK {
  const jwk = keyPair.publicKey.export({ format: 'jwk' }) as JWK
  jwk.kid = keyPair.kid
  jwk.alg = keyPair.algorithm
  jwk.use = 'sig'
  return jwk
}

/**
 * Resolve DID:key to public key JWK
 *
 * Note: This is a simplified implementation. In production, DID resolution
 * should use a proper DID resolver or maintain a registry mapping DIDs to keys.
 * Since our DIDs are hash-based, they cannot be resolved without the original key.
 *
 * For now, this returns the cached key if the DID matches the issuer's DID.
 */
export function resolveDid(did: string): JWK | null {
  if (!did.startsWith('did:key:z')) {
    return null
  }

  // Check if this is the issuer's DID
  if (cachedKeyPair && cachedKeyPair.did === did) {
    return exportPublicKeyJWK(cachedKeyPair)
  }

  // In production, implement proper DID resolution:
  // - Use a DID resolver library
  // - Query a DID registry/database
  // - Use multicodec decoding for proper did:key resolution

  console.warn('[Crypto] DID resolution not implemented for:', did)
  return null
}

/**
 * Singleton key pair instance
 */
let cachedKeyPair: KeyPair | null = null

export function getIssuerKeyPair(): KeyPair {
  if (!cachedKeyPair) {
    cachedKeyPair = loadOrGenerateKeyPair('ES256')
  }
  return cachedKeyPair
}

/**
 * Clear cached key pair (for testing)
 */
export function clearKeyCache(): void {
  cachedKeyPair = null
}
