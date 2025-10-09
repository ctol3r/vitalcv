/**
 * BBS+ Signature Implementation for VitalCV
 *
 * Production implementation using @mattrglobal/jsonld-signatures-bbs
 * Replaces framework/mock implementation with real BBS+ cryptography
 */

import {
  blsSign,
  blsVerify,
  blsCreateProof,
  blsVerifyProof,
  generateBls12381G2KeyPair,
  BbsBlsSignature2020,
  BbsBlsSignatureProof2020,
  Bls12381G2KeyPair,
} from '@mattrglobal/jsonld-signatures-bbs'
import jsonld from 'jsonld'
import { VerifiableCredential, DerivedCredential } from './types'

/**
 * BBS+ Key Pair
 */
export interface BBSKeyPair {
  publicKey: Uint8Array
  privateKey: Uint8Array
  id: string
  controller: string
}

/**
 * Generate BBS+ key pair
 *
 * @example
 * const keyPair = await generateBBSKeyPair('did:example:123')
 */
export async function generateBBSKeyPair(did: string): Promise<BBSKeyPair> {
  const keyPair = await generateBls12381G2KeyPair()

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey!,
    id: `${did}#bbs-key-1`,
    controller: did,
  }
}

/**
 * Sign credential with BBS+ signature
 *
 * @param credential - Unsigned credential
 * @param keyPair - BBS+ key pair
 * @returns Signed credential with BBS+ signature
 *
 * @example
 * const signed = await signCredentialBBS(unsignedCredential, keyPair)
 */
export async function signCredentialBBS(
  credential: Omit<VerifiableCredential, 'proof'>,
  keyPair: BBSKeyPair
): Promise<VerifiableCredential> {
  // Create key pair object for the library
  const key = new Bls12381G2KeyPair({
    id: keyPair.id,
    controller: keyPair.controller,
    publicKeyBase58: Buffer.from(keyPair.publicKey).toString('base64'),
    privateKeyBase58: Buffer.from(keyPair.privateKey).toString('base64'),
  })

  // Create signature suite
  const suite = new BbsBlsSignature2020({ key })

  // Sign the credential
  const signedCredential = await suite.sign({
    document: credential,
    purpose: {
      validate: () => ({ valid: true }),
      update: (proof: any) => {
        proof.proofPurpose = 'assertionMethod'
        return proof
      },
    },
    documentLoader: customDocumentLoader,
  })

  return signedCredential as VerifiableCredential
}

/**
 * Verify BBS+ signature on credential
 *
 * @param credential - Credential to verify
 * @param publicKey - Public key to verify with
 * @returns Verification result
 *
 * @example
 * const { verified } = await verifyCredentialBBS(credential, publicKey)
 */
export async function verifyCredentialBBS(
  credential: VerifiableCredential,
  publicKey: Uint8Array
): Promise<{ verified: boolean; error?: string }> {
  try {
    // Create key pair object (public key only)
    const keyPair = new Bls12381G2KeyPair({
      id: credential.proof.verificationMethod,
      controller: typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id,
      publicKeyBase58: Buffer.from(publicKey).toString('base64'),
    })

    // Create signature suite
    const suite = new BbsBlsSignature2020({ key: keyPair })

    // Verify the signature
    const result = await suite.verify({
      document: credential,
      purpose: {
        validate: () => ({ valid: true }),
        update: (proof: any) => proof,
      },
      documentLoader: customDocumentLoader,
    })

    return { verified: result.verified }
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create derived credential with selective disclosure
 *
 * @param credential - Original credential (must have BBS+ signature)
 * @param revealedAttributes - Attributes to reveal
 * @param challenge - Challenge/nonce for the proof
 * @returns Derived credential with BBS+ proof
 *
 * @example
 * const derived = await deriveCredentialBBS(
 *   credential,
 *   ['id', 'givenName', 'familyName'],
 *   'challenge-123'
 * )
 */
export async function deriveCredentialBBS(
  credential: VerifiableCredential,
  revealedAttributes: string[],
  challenge: string
): Promise<DerivedCredential> {
  // Verify original credential has BBS+ signature
  if (credential.proof.type !== 'BbsBlsSignature2020') {
    throw new Error('Credential must have BBS+ signature for selective disclosure')
  }

  // Create reveal document (specify which fields to reveal)
  const revealDocument = createRevealDocument(credential, revealedAttributes)

  // Create signature suite for proof generation
  const suite = new BbsBlsSignatureProof2020()

  // Derive credential
  const derivedCredential = await suite.deriveProof({
    document: credential,
    revealDocument,
    purpose: {
      validate: () => ({ valid: true }),
      update: (proof: any) => {
        proof.proofPurpose = 'assertionMethod'
        proof.nonce = challenge
        return proof
      },
    },
    documentLoader: customDocumentLoader,
  })

  // Add metadata
  return {
    ...derivedCredential,
    derivedFrom: credential.id,
    revealedAttributes,
  } as DerivedCredential
}

/**
 * Verify derived credential with BBS+ proof
 *
 * @param derivedCredential - Derived credential to verify
 * @param challenge - Original challenge/nonce
 * @param publicKey - Issuer's public key
 * @returns Verification result
 *
 * @example
 * const { verified } = await verifyDerivedCredentialBBS(
 *   derivedCredential,
 *   'challenge-123',
 *   publicKey
 * )
 */
export async function verifyDerivedCredentialBBS(
  derivedCredential: DerivedCredential,
  challenge: string,
  publicKey: Uint8Array
): Promise<{ verified: boolean; error?: string }> {
  try {
    // Verify proof type
    if (derivedCredential.proof.type !== 'BbsBlsSignatureProof2020') {
      return {
        verified: false,
        error: 'Invalid proof type. Expected BbsBlsSignatureProof2020',
      }
    }

    // Verify nonce matches
    if (derivedCredential.proof.nonce !== challenge) {
      return {
        verified: false,
        error: 'Challenge mismatch',
      }
    }

    // Create key pair object
    const keyPair = new Bls12381G2KeyPair({
      id: derivedCredential.proof.verificationMethod,
      controller: typeof derivedCredential.issuer === 'string'
        ? derivedCredential.issuer
        : derivedCredential.issuer.id,
      publicKeyBase58: Buffer.from(publicKey).toString('base64'),
    })

    // Create proof suite
    const suite = new BbsBlsSignatureProof2020({ key: keyPair })

    // Verify the proof
    const result = await suite.verify({
      document: derivedCredential,
      purpose: {
        validate: () => ({ valid: true }),
        update: (proof: any) => proof,
      },
      documentLoader: customDocumentLoader,
    })

    return { verified: result.verified }
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create reveal document for selective disclosure
 * Specifies which fields should be revealed in the derived credential
 */
function createRevealDocument(
  credential: VerifiableCredential,
  revealedAttributes: string[]
): any {
  // Build JSON-LD frame that reveals only specified attributes
  const frame = {
    '@context': credential['@context'],
    type: credential.type,
    credentialSubject: {
      '@explicit': true,
      id: revealedAttributes.includes('id'),
      ...Object.fromEntries(
        revealedAttributes
          .filter(attr => attr !== 'id')
          .map(attr => [attr, {}])
      ),
    },
  }

  return frame
}

/**
 * Custom document loader for JSON-LD processing
 * Loads W3C contexts and custom schemas
 */
async function customDocumentLoader(url: string): Promise<any> {
  // Cache of JSON-LD contexts
  const contexts: Record<string, any> = {
    'https://www.w3.org/2018/credentials/v1': {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        'id': '@id',
        'type': '@type',
        'VerifiableCredential': {
          '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
          '@context': {
            '@version': 1.1,
            '@protected': true,
            'id': '@id',
            'type': '@type',
            'credentialSubject': {
              '@id': 'https://www.w3.org/2018/credentials#credentialSubject',
              '@type': '@id',
            },
            'issuer': {
              '@id': 'https://www.w3.org/2018/credentials#issuer',
              '@type': '@id',
            },
            'issuanceDate': {
              '@id': 'https://www.w3.org/2018/credentials#issuanceDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            },
            'expirationDate': {
              '@id': 'https://www.w3.org/2018/credentials#expirationDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            },
            'proof': {
              '@id': 'https://w3id.org/security#proof',
              '@type': '@id',
              '@container': '@graph',
            },
          },
        },
      },
    },
    'https://w3id.org/security/v1': {
      '@context': {
        '@version': 1.1,
        'id': '@id',
        'type': '@type',
        'proof': {
          '@id': 'https://w3id.org/security#proof',
          '@type': '@id',
          '@container': '@graph',
        },
      },
    },
    'https://w3id.org/security/v2': {
      '@context': {
        '@version': 1.1,
        'id': '@id',
        'type': '@type',
        'proof': {
          '@id': 'https://w3id.org/security#proof',
          '@type': '@id',
          '@container': '@graph',
        },
      },
    },
  }

  // Check cache first
  if (contexts[url]) {
    return {
      contextUrl: null,
      document: contexts[url],
      documentUrl: url,
    }
  }

  // Fallback to default loader (for production, implement caching and remote fetching)
  try {
    const response = await fetch(url)
    const document = await response.json()
    return {
      contextUrl: null,
      document,
      documentUrl: url,
    }
  } catch (error) {
    throw new Error(`Failed to load document: ${url}`)
  }
}

/**
 * Convert key pair to exportable format
 */
export function exportKeyPair(keyPair: BBSKeyPair): {
  publicKeyBase58: string
  privateKeyBase58?: string
} {
  return {
    publicKeyBase58: Buffer.from(keyPair.publicKey).toString('base64'),
    privateKeyBase58: keyPair.privateKey
      ? Buffer.from(keyPair.privateKey).toString('base64')
      : undefined,
  }
}

/**
 * Import key pair from exportable format
 */
export function importKeyPair(
  exported: {
    publicKeyBase58: string
    privateKeyBase58?: string
  },
  id: string,
  controller: string
): BBSKeyPair {
  return {
    publicKey: Buffer.from(exported.publicKeyBase58, 'base64'),
    privateKey: exported.privateKeyBase58
      ? Buffer.from(exported.privateKeyBase58, 'base64')
      : new Uint8Array(),
    id,
    controller,
  }
}
