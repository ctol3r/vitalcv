/**
 * Selective Disclosure Utilities for VitalCV
 *
 * Implements selective disclosure using BBS+ signatures
 *
 * Production implementation using @mattrglobal/jsonld-signatures-bbs
 */

import { VerifiableCredential, Proof, CredentialSubject } from './types'
import {
  deriveCredentialBBS,
  verifyDerivedCredentialBBS,
} from './bbs-plus'

/**
 * Selective disclosure configuration
 */
export interface SelectiveDisclosureConfig {
  credentialId: string
  availableClaims: CredentialClaim[]
  requestedClaims: string[]  // Required by verifier
  optionalClaims: string[]   // Optional additional claims
  selectedClaims: string[]   // User's selection
}

/**
 * Credential claim definition
 */
export interface CredentialClaim {
  name: string
  value: unknown
  required: boolean
  sensitive: boolean
  description?: string
}

/**
 * Derived credential (with selective disclosure)
 */
export interface DerivedCredential extends VerifiableCredential {
  derivedFrom: string  // Original credential ID
  revealedAttributes: string[]
  proof: BBSPlusProof
}

/**
 * BBS+ Proof
 */
export interface BBSPlusProof extends Proof {
  type: 'BbsBlsSignature2020' | 'BbsBlsSignatureProof2020'
  nonce: string
  proofValue: string
}

/**
 * Analyze a credential for selective disclosure capability
 */
export function analyzeCredentialForSelectiveDisclosure(
  credential: VerifiableCredential
): {
  supportsSelectiveDisclosure: boolean
  reason?: string
  availableClaims: CredentialClaim[]
} {
  // Check if credential has BBS+ signature
  if (credential.proof.type !== 'BbsBlsSignature2020') {
    return {
      supportsSelectiveDisclosure: false,
      reason: 'Credential does not use BBS+ signature. Proof type: ' + credential.proof.type,
      availableClaims: [],
    }
  }

  // Extract claims from credential subject
  const availableClaims: CredentialClaim[] = []
  const subject = credential.credentialSubject

  // Always include id (DID) - required
  availableClaims.push({
    name: 'id',
    value: subject.id,
    required: true,
    sensitive: false,
    description: 'Subject DID',
  })

  // Extract other claims
  for (const [key, value] of Object.entries(subject)) {
    if (key === 'id') continue

    // Determine if sensitive (heuristic)
    const isSensitive = [
      'ssn',
      'birthDate',
      'birthdate',
      'dateOfBirth',
      'address',
      'phone',
      'email',
      'licenseNumber',
    ].some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))

    availableClaims.push({
      name: key,
      value,
      required: false,
      sensitive: isSensitive,
      description: `Credential subject ${key}`,
    })
  }

  return {
    supportsSelectiveDisclosure: true,
    availableClaims,
  }
}

/**
 * Create a reveal document for selective disclosure
 *
 * This defines which attributes should be revealed in the derived credential.
 */
export function createRevealDocument(
  credential: VerifiableCredential,
  revealedAttributes: string[]
): Record<string, unknown> {
  const revealDoc: Record<string, unknown> = {
    '@context': credential['@context'],
    type: credential.type,
    credentialSubject: {
      '@explicit': true,
      id: credential.credentialSubject.id, // Always reveal subject DID
    },
  }

  // Add revealed attributes
  for (const attr of revealedAttributes) {
    if (attr in credential.credentialSubject) {
      ;(revealDoc.credentialSubject as Record<string, unknown>)[attr] =
        credential.credentialSubject[attr as keyof CredentialSubject]
    }
  }

  return revealDoc
}

/**
 * Derive a credential with selective disclosure
 *
 * Production implementation using @mattrglobal/jsonld-signatures-bbs
 *
 * @param credential - Original credential with BBS+ signature
 * @param revealedAttributes - Attributes to reveal
 * @param challenge - Verification challenge/nonce
 * @returns Derived credential with only revealed attributes
 */
export async function deriveCredentialWithSelectiveDisclosure(
  credential: VerifiableCredential,
  revealedAttributes: string[],
  challenge: string
): Promise<DerivedCredential> {
  // Use real BBS+ derivation
  return deriveCredentialBBS(credential, revealedAttributes, challenge)
}

/**
 * Verify a derived credential
 *
 * Production implementation using @mattrglobal/jsonld-signatures-bbs
 *
 * @param derivedCredential - Derived credential to verify
 * @param challenge - Original challenge/nonce
 * @param publicKey - Issuer's BBS+ public key (optional, will be resolved from DID if not provided)
 * @returns Verification result
 */
export async function verifyDerivedCredential(
  derivedCredential: DerivedCredential,
  challenge: string,
  publicKey?: Uint8Array
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check proof type
    if (derivedCredential.proof.type !== 'BbsBlsSignatureProof2020') {
      return {
        valid: false,
        error: 'Invalid proof type for derived credential',
      }
    }

    // If no public key provided, need to resolve from DID
    if (!publicKey) {
      return {
        valid: false,
        error: 'Public key required for verification. DID resolution not yet implemented.',
      }
    }

    // Use real BBS+ proof verification
    const result = await verifyDerivedCredentialBBS(derivedCredential, challenge, publicKey)
    return { valid: result.verified, error: result.error }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    }
  }
}

/**
 * Get minimum required fields for a credential type
 */
export function getRequiredFieldsForType(credentialType: string): string[] {
  const requiredFieldsMap: Record<string, string[]> = {
    DriverLicense: ['id', 'licenseNumber', 'licenseClass', 'givenName', 'familyName'],
    HealthPass: ['id', 'givenName', 'familyName', 'birthDate'],
    ProfessionalLicense: ['id', 'licenseNumber', 'profession', 'givenName', 'familyName'],
    UniversityDegree: ['id', 'givenName', 'familyName', 'degree'],
    AgeVerification: ['id'], // Very minimal for privacy
  }

  return requiredFieldsMap[credentialType] || ['id']
}

/**
 * Suggest fields to reveal based on verification request
 */
export function suggestFieldsToReveal(
  credential: VerifiableCredential,
  verificationPurpose: string
): {
  required: string[]
  suggested: string[]
  optional: string[]
} {
  const analysis = analyzeCredentialForSelectiveDisclosure(credential)

  if (!analysis.supportsSelectiveDisclosure) {
    // If not BBS+, must reveal all fields
    return {
      required: analysis.availableClaims.map((c) => c.name),
      suggested: [],
      optional: [],
    }
  }

  // Get type-specific required fields
  const credentialType = Array.isArray(credential.type)
    ? credential.type.find((t) => t !== 'VerifiableCredential') || 'Unknown'
    : credential.type

  const required = getRequiredFieldsForType(credentialType)

  // Suggest non-sensitive fields
  const suggested = analysis.availableClaims
    .filter((c) => !c.sensitive && !required.includes(c.name))
    .map((c) => c.name)

  // Optional: sensitive fields
  const optional = analysis.availableClaims
    .filter((c) => c.sensitive && !required.includes(c.name))
    .map((c) => c.name)

  return {
    required,
    suggested,
    optional,
  }
}

/**
 * Privacy score calculation
 *
 * Calculates how much privacy is preserved in a selective disclosure
 */
export function calculatePrivacyScore(
  totalFields: number,
  revealedFields: number
): {
  score: number // 0-100
  rating: 'low' | 'medium' | 'high'
  description: string
} {
  const percentageRevealed = (revealedFields / totalFields) * 100
  const privacyPreserved = 100 - percentageRevealed

  let rating: 'low' | 'medium' | 'high'
  let description: string

  if (privacyPreserved >= 70) {
    rating = 'high'
    description = 'Excellent privacy - most data remains undisclosed'
  } else if (privacyPreserved >= 40) {
    rating = 'medium'
    description = 'Good privacy - significant data remains undisclosed'
  } else {
    rating = 'low'
    description = 'Limited privacy - most data is revealed'
  }

  return {
    score: Math.round(privacyPreserved),
    rating,
    description,
  }
}
