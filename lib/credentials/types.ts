/**
 * W3C Verifiable Credentials Types for VitalCV
 *
 * Based on W3C Verifiable Credentials Data Model 1.1
 * https://www.w3.org/TR/vc-data-model/
 */

/**
 * W3C Verifiable Credential
 */
export interface VerifiableCredential {
  '@context': string[]
  id: string
  type: string[]
  issuer: string | Issuer
  issuanceDate: string
  expirationDate?: string
  credentialSubject: CredentialSubject
  credentialStatus?: CredentialStatus
  proof: Proof
}

/**
 * Issuer information
 */
export interface Issuer {
  id: string
  name?: string
  description?: string
  url?: string
  image?: string
}

/**
 * Credential Subject (the entity the credential is about)
 */
export interface CredentialSubject {
  id: string
  [key: string]: unknown
}

/**
 * Credential Status (for revocation)
 */
export interface CredentialStatus {
  id: string
  type: string
  statusListIndex?: string
  statusListCredential?: string
}

/**
 * Cryptographic Proof
 */
export interface Proof {
  type: string
  created: string
  verificationMethod: string
  proofPurpose: string
  proofValue: string
  nonce?: string
}

/**
 * Verifiable Presentation
 */
export interface VerifiablePresentation {
  '@context': string[]
  type: string[]
  verifiableCredential: VerifiableCredential[]
  holder?: string
  proof?: Proof
}

/**
 * Credential Schema (JSON Schema)
 */
export interface CredentialSchemaDefinition {
  $schema: string
  $id: string
  title: string
  description?: string
  type: 'object'
  properties: {
    credentialSubject: {
      type: 'object'
      properties: Record<string, JSONSchemaProperty>
      required?: string[]
    }
    [key: string]: unknown
  }
  required?: string[]
}

/**
 * JSON Schema Property
 */
export interface JSONSchemaProperty {
  type: string | string[]
  description?: string
  format?: string
  pattern?: string
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  enum?: unknown[]
  items?: JSONSchemaProperty
}

/**
 * Privacy modes for credentials
 */
export type PrivacyMode = 'plain' | 'bbs' | 'zkp'

/**
 * Credential type definitions
 */
export interface CredentialTypeDefinition {
  id: string
  type: string
  name: string
  description: string
  version: string
  schema: CredentialSchemaDefinition
  privacyMode: PrivacyMode
  active: boolean
}

/**
 * Common credential types
 */
export const CREDENTIAL_TYPES = {
  DRIVER_LICENSE: 'DriverLicense',
  HEALTH_PASS: 'HealthPass',
  UNIVERSITY_DEGREE: 'UniversityDegree',
  PROFESSIONAL_LICENSE: 'ProfessionalLicense',
  EMPLOYMENT_CREDENTIAL: 'EmploymentCredential',
  AGE_VERIFICATION: 'AgeVerification',
  IDENTITY_CREDENTIAL: 'IdentityCredential',
} as const

/**
 * Proof types
 */
export const PROOF_TYPES = {
  ED25519_SIGNATURE_2020: 'Ed25519Signature2020',
  BBS_BLS_SIGNATURE_2020: 'BbsBlsSignature2020',
  ECDSA_SECP256K1_SIGNATURE_2019: 'EcdsaSecp256k1Signature2019',
} as const

/**
 * Credential status types
 */
export const CREDENTIAL_STATUS_TYPES = {
  REVOCATION_LIST_2020: 'RevocationList2020Status',
  STATUS_LIST_2021: 'StatusList2021Entry',
} as const

/**
 * Standard JSON-LD contexts
 */
export const CONTEXTS = {
  VC_V1: 'https://www.w3.org/2018/credentials/v1',
  VC_V2: 'https://www.w3.org/ns/credentials/v2',
  DID_V1: 'https://www.w3.org/ns/did/v1',
  SECURITY_V1: 'https://w3id.org/security/v1',
  SECURITY_V2: 'https://w3id.org/security/v2',
} as const
