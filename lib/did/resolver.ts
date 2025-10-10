/**
 * DID Resolution for VitalCV
 *
 * Resolves Decentralized Identifiers (DIDs) to DID Documents
 * Supports: did:ethr, did:web, did:key
 */

import { Resolver } from 'did-resolver'
import { getResolver as getEthrResolver } from 'ethr-did-resolver'
import { getResolver as getWebResolver } from 'web-did-resolver'
import { getResolver as getKeyResolver } from 'key-did-resolver'

/**
 * DID Document structure
 */
export interface DIDDocument {
  '@context': string | string[]
  id: string
  verificationMethod?: VerificationMethod[]
  authentication?: (string | VerificationMethod)[]
  assertionMethod?: (string | VerificationMethod)[]
  keyAgreement?: (string | VerificationMethod)[]
  service?: ServiceEndpoint[]
}

/**
 * Verification Method (public key)
 */
export interface VerificationMethod {
  id: string
  type: string
  controller: string
  publicKeyBase58?: string
  publicKeyBase64?: string
  publicKeyHex?: string
  publicKeyMultibase?: string
  publicKeyJwk?: {
    kty: string
    crv: string
    x: string
    y?: string
  }
}

/**
 * Service Endpoint
 */
export interface ServiceEndpoint {
  id: string
  type: string
  serviceEndpoint: string
}

/**
 * DID Resolution Result
 */
export interface DIDResolutionResult {
  didDocument: DIDDocument | null
  didDocumentMetadata: any
  didResolutionMetadata: {
    contentType?: string
    error?: string
  }
}

/**
 * In-memory cache for DID documents
 * In production, use Redis or similar
 */
class DIDCache {
  private cache: Map<string, { document: DIDDocument; timestamp: number }>
  private ttl: number // Time to live in milliseconds

  constructor(ttlMinutes: number = 60) {
    this.cache = new Map()
    this.ttl = ttlMinutes * 60 * 1000
  }

  get(did: string): DIDDocument | null {
    const cached = this.cache.get(did)
    if (!cached) return null

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(did)
      return null
    }

    return cached.document
  }

  set(did: string, document: DIDDocument): void {
    this.cache.set(did, {
      document,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }

  delete(did: string): void {
    this.cache.delete(did)
  }
}

// Global cache instance
const didCache = new DIDCache(60) // 60 minute TTL

/**
 * Create DID resolver with support for multiple methods
 */
function createDIDResolver(): Resolver {
  // Ethereum DID resolver configuration
  const ethrResolver = getEthrResolver({
    networks: [
      {
        name: 'mainnet',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      },
      {
        name: 'sepolia',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
      },
      {
        name: 'polygon',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      },
    ],
  })

  // Web DID resolver (did:web)
  const webResolver = getWebResolver()

  // Key DID resolver (did:key)
  const keyResolver = getKeyResolver()

  // Combine all resolvers
  return new Resolver({
    ...ethrResolver,
    ...webResolver,
    ...keyResolver,
  })
}

// Global resolver instance
let resolverInstance: Resolver | null = null

/**
 * Get or create resolver instance
 */
function getResolver(): Resolver {
  if (!resolverInstance) {
    resolverInstance = createDIDResolver()
  }
  return resolverInstance
}

/**
 * Resolve a DID to its DID Document
 *
 * @param did - The DID to resolve (e.g., "did:ethr:0x1234...")
 * @param useCache - Whether to use cache (default: true)
 * @returns DID Resolution Result
 *
 * @example
 * const result = await resolveDID('did:ethr:0x1234...')
 * if (result.didDocument) {
 *   console.log('DID resolved:', result.didDocument.id)
 * }
 */
export async function resolveDID(
  did: string,
  useCache: boolean = true
): Promise<DIDResolutionResult> {
  try {
    // Validate DID format
    if (!did || !did.startsWith('did:')) {
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'invalidDid',
        },
      }
    }

    // Check cache first
    if (useCache) {
      const cached = didCache.get(did)
      if (cached) {
        return {
          didDocument: cached,
          didDocumentMetadata: { cached: true },
          didResolutionMetadata: { contentType: 'application/did+ld+json' },
        }
      }
    }

    // Resolve DID
    const resolver = getResolver()
    const result = await resolver.resolve(did)

    // Cache successful resolution
    if (result.didDocument && useCache) {
      didCache.set(did, result.didDocument as DIDDocument)
    }

    return result as DIDResolutionResult
  } catch (error) {
    console.error('DID resolution error:', error)
    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
      },
    }
  }
}

/**
 * Extract public key from DID Document
 *
 * @param didDocument - DID Document
 * @param keyId - Specific key ID to extract (optional)
 * @param purpose - Key purpose (authentication, assertionMethod, etc.)
 * @returns Public key in hex format
 *
 * @example
 * const publicKey = extractPublicKey(didDocument, undefined, 'assertionMethod')
 */
export function extractPublicKey(
  didDocument: DIDDocument,
  keyId?: string,
  purpose: 'authentication' | 'assertionMethod' | 'keyAgreement' = 'assertionMethod'
): string | null {
  try {
    // Get verification methods for the specified purpose
    const purposeMethods = didDocument[purpose] || []

    // Find the verification method
    let verificationMethod: VerificationMethod | undefined

    if (keyId) {
      // Look for specific key ID
      verificationMethod = didDocument.verificationMethod?.find((vm) => vm.id === keyId)
    } else {
      // Use first method from purpose array
      const firstMethod = purposeMethods[0]
      if (typeof firstMethod === 'string') {
        // It's a reference, need to look it up
        verificationMethod = didDocument.verificationMethod?.find((vm) => vm.id === firstMethod)
      } else {
        // It's embedded
        verificationMethod = firstMethod as VerificationMethod
      }
    }

    if (!verificationMethod) {
      return null
    }

    // Extract public key in various formats
    if (verificationMethod.publicKeyHex) {
      return verificationMethod.publicKeyHex
    }

    if (verificationMethod.publicKeyBase58) {
      // Convert base58 to hex
      return Buffer.from(verificationMethod.publicKeyBase58, 'base64').toString('hex')
    }

    if (verificationMethod.publicKeyBase64) {
      return Buffer.from(verificationMethod.publicKeyBase64, 'base64').toString('hex')
    }

    if (verificationMethod.publicKeyJwk) {
      // JWK format - would need conversion based on key type
      // For now, return null (implement JWK conversion if needed)
      return null
    }

    return null
  } catch (error) {
    console.error('Error extracting public key:', error)
    return null
  }
}

/**
 * Resolve DID and extract public key
 *
 * @param did - DID to resolve
 * @param keyId - Specific key ID (optional)
 * @param purpose - Key purpose (default: assertionMethod)
 * @returns Public key in hex format or null
 *
 * @example
 * const publicKey = await resolvePublicKey('did:ethr:0x1234...')
 * if (publicKey) {
 *   // Use public key for verification
 * }
 */
export async function resolvePublicKey(
  did: string,
  keyId?: string,
  purpose: 'authentication' | 'assertionMethod' | 'keyAgreement' = 'assertionMethod'
): Promise<string | null> {
  const result = await resolveDID(did)

  if (!result.didDocument) {
    return null
  }

  return extractPublicKey(result.didDocument, keyId, purpose)
}

/**
 * Clear DID cache
 */
export function clearDIDCache(): void {
  didCache.clear()
}

/**
 * Remove specific DID from cache
 */
export function removeDIDFromCache(did: string): void {
  didCache.delete(did)
}

/**
 * Validate DID format
 *
 * @param did - DID string to validate
 * @returns True if valid DID format
 *
 * @example
 * if (isValidDID('did:ethr:0x1234...')) {
 *   // Valid DID
 * }
 */
export function isValidDID(did: string): boolean {
  // Basic DID format: did:method:method-specific-id
  const didRegex = /^did:[a-z0-9]+:[a-zA-Z0-9._%-]+$/
  return didRegex.test(did)
}

/**
 * Parse DID into components
 *
 * @param did - DID to parse
 * @returns DID components or null if invalid
 *
 * @example
 * const parts = parseDID('did:ethr:0x1234...')
 * // { method: 'ethr', methodSpecificId: '0x1234...' }
 */
export function parseDID(did: string): {
  method: string
  methodSpecificId: string
  network?: string
} | null {
  if (!isValidDID(did)) {
    return null
  }

  const parts = did.split(':')

  // did:method:method-specific-id
  if (parts.length >= 3) {
    return {
      method: parts[1],
      methodSpecificId: parts.slice(2).join(':'),
    }
  }

  return null
}

/**
 * Get supported DID methods
 */
export function getSupportedDIDMethods(): string[] {
  return ['ethr', 'web', 'key']
}

/**
 * Check if DID method is supported
 */
export function isSupportedDIDMethod(method: string): boolean {
  return getSupportedDIDMethods().includes(method.toLowerCase())
}
