/**
 * Credential Issuance Utilities for VitalCV
 *
 * Functions for creating and signing W3C Verifiable Credentials
 */

import { randomBytes, createHash } from 'crypto'
import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import {
  VerifiableCredential,
  Proof,
  CredentialSubject,
  CONTEXTS,
  PROOF_TYPES,
} from './types'

/**
 * Generate a unique credential ID
 */
export function generateCredentialId(): string {
  const randomPart = randomBytes(16).toString('hex')
  return `urn:uuid:${randomPart.substring(0, 8)}-${randomPart.substring(8, 12)}-${randomPart.substring(12, 16)}-${randomPart.substring(16, 20)}-${randomPart.substring(20)}`
}

/**
 * Create a W3C Verifiable Credential
 *
 * @param options - Credential creation options
 * @returns Unsigned verifiable credential
 */
export function createCredential(options: {
  id?: string
  type: string | string[]
  issuer: string
  issuanceDate?: Date
  expirationDate?: Date
  credentialSubject: CredentialSubject
  credentialStatus?: {
    id: string
    type: string
    statusListIndex?: string
    statusListCredential?: string
  }
}): Omit<VerifiableCredential, 'proof'> {
  const {
    id = generateCredentialId(),
    type,
    issuer,
    issuanceDate = new Date(),
    expirationDate,
    credentialSubject,
    credentialStatus,
  } = options

  // Ensure type is an array
  const types = Array.isArray(type) ? type : [type]

  // Always include VerifiableCredential as base type
  if (!types.includes('VerifiableCredential')) {
    types.unshift('VerifiableCredential')
  }

  const credential: Omit<VerifiableCredential, 'proof'> = {
    '@context': [CONTEXTS.VC_V1],
    id,
    type: types,
    issuer,
    issuanceDate: issuanceDate.toISOString(),
    credentialSubject,
  }

  if (expirationDate) {
    credential.expirationDate = expirationDate.toISOString()
  }

  if (credentialStatus) {
    credential.credentialStatus = credentialStatus
  }

  return credential
}

/**
 * Create a canonical representation of the credential for signing
 *
 * This is a simplified version. In production, use JSON-LD canonicalization (RDF Dataset Normalization)
 */
export function canonicalizeCredential(credential: Omit<VerifiableCredential, 'proof'>): string {
  // Sort keys alphabetically for consistent hashing
  const sorted = JSON.stringify(credential, Object.keys(credential).sort())
  return sorted
}

/**
 * Hash credential for signing
 */
export function hashCredential(credential: Omit<VerifiableCredential, 'proof'>): Uint8Array {
  const canonical = canonicalizeCredential(credential)
  return sha256(new TextEncoder().encode(canonical))
}

/**
 * Sign a credential with Ed25519
 *
 * @param credential - Unsigned credential
 * @param privateKey - Hex-encoded private key
 * @param verificationMethod - DID and key ID for verification
 * @returns Signed verifiable credential
 */
export function signCredentialEd25519(
  credential: Omit<VerifiableCredential, 'proof'>,
  privateKey: string,
  verificationMethod: string
): VerifiableCredential {
  // Hash the credential
  const credentialHash = hashCredential(credential)

  // Sign with private key
  const privateKeyBytes = Buffer.from(privateKey, 'hex')
  const signature = ed25519.sign(credentialHash, privateKeyBytes)

  // Create proof
  const proof: Proof = {
    type: PROOF_TYPES.ED25519_SIGNATURE_2020,
    created: new Date().toISOString(),
    verificationMethod,
    proofPurpose: 'assertionMethod',
    proofValue: bytesToHex(signature),
  }

  return {
    ...credential,
    proof,
  }
}

/**
 * Verify a credential signature
 *
 * @param credential - Signed credential
 * @param publicKey - Hex-encoded public key
 * @returns True if signature is valid
 */
export function verifyCredentialSignature(
  credential: VerifiableCredential,
  publicKey: string
): boolean {
  try {
    // Extract proof
    const { proof, ...unsignedCredential } = credential

    if (proof.type !== PROOF_TYPES.ED25519_SIGNATURE_2020) {
      throw new Error(`Unsupported proof type: ${proof.type}`)
    }

    // Hash the unsigned credential
    const credentialHash = hashCredential(unsignedCredential)

    // Verify signature
    const signatureBytes = Buffer.from(proof.proofValue, 'hex')
    const publicKeyBytes = Buffer.from(publicKey, 'hex')

    return ed25519.verify(signatureBytes, credentialHash, publicKeyBytes)
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Check if a credential has expired
 */
export function isCredentialExpired(credential: VerifiableCredential): boolean {
  if (!credential.expirationDate) {
    return false
  }

  const expiryDate = new Date(credential.expirationDate)
  return expiryDate < new Date()
}

/**
 * Check if a credential is revoked
 */
export function isCredentialRevoked(credential: VerifiableCredential): boolean {
  // This is a placeholder. In production, check against the credential status
  // by fetching the status list credential
  return false
}

/**
 * Validate credential structure
 */
export function validateCredentialStructure(
  credential: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!credential || typeof credential !== 'object') {
    return { valid: false, errors: ['Credential must be an object'] }
  }

  const vc = credential as Partial<VerifiableCredential>

  // Check required fields
  if (!vc['@context']) {
    errors.push('Missing @context')
  }
  if (!vc.id) {
    errors.push('Missing id')
  }
  if (!vc.type || !Array.isArray(vc.type)) {
    errors.push('Missing or invalid type (must be array)')
  }
  if (!vc.issuer) {
    errors.push('Missing issuer')
  }
  if (!vc.issuanceDate) {
    errors.push('Missing issuanceDate')
  }
  if (!vc.credentialSubject) {
    errors.push('Missing credentialSubject')
  }
  if (!vc.proof) {
    errors.push('Missing proof')
  }

  // Validate type includes VerifiableCredential
  if (vc.type && !vc.type.includes('VerifiableCredential')) {
    errors.push('Type must include "VerifiableCredential"')
  }

  // Validate credentialSubject has id
  if (vc.credentialSubject && !(vc.credentialSubject as CredentialSubject).id) {
    errors.push('credentialSubject must have an id (DID)')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Generate a deterministic credential ID from content
 *
 * Useful for preventing duplicate credentials
 */
export function generateDeterministicCredentialId(
  issuer: string,
  subjectId: string,
  type: string
): string {
  const content = `${issuer}:${subjectId}:${type}`
  const hash = createHash('sha256').update(content).digest('hex')
  return `urn:uuid:${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`
}
