/**
 * W3C Verifiable Credentials Data Model v2.0
 *
 * This module defines TypeScript interfaces and Zod schemas for W3C VC Data Model v2.0.
 * Supports both JWT-encoded and JSON-LD-based credentials with normalized internal representation.
 *
 * References:
 * - https://www.w3.org/TR/vc-data-model-2.0/
 * - https://www.w3.org/TR/vc-data-model/#core-data-model
 */

import { z } from 'zod';

/**
 * Base types for VC v2.0
 */

// URI or object with id property
export const UriOrObjectSchema = z.union([
  z.string().url(),
  z
    .object({
      id: z.string().url(),
    })
    .passthrough(),
]);

export type UriOrObject = z.infer<typeof UriOrObjectSchema>;

// Date/time as ISO 8601 string or Unix timestamp
export const DateTimeSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/),
  z.number().int().positive(),
]);

export type DateTime = z.infer<typeof DateTimeSchema>;

/**
 * Issuer - can be a URI string or an object with id and optional name
 */
export const IssuerSchema = z.union([
  z.string().url(),
  z
    .object({
      id: z.string().url(),
      name: z.string().optional(),
      image: z.string().url().optional(),
    })
    .passthrough(),
]);

export type Issuer = z.infer<typeof IssuerSchema>;

/**
 * Credential Subject - the entity about which the credential makes claims
 */
export const CredentialSubjectSchema = z
  .object({
    id: z.string().url().optional(), // DID or URI
  })
  .passthrough(); // Allow additional properties

export type CredentialSubject = z.infer<typeof CredentialSubjectSchema>;

/**
 * Evidence - supporting evidence for the credential
 */
export const EvidenceSchema = z
  .object({
    id: z.string().url().optional(),
    type: z.union([z.string(), z.array(z.string())]),
    verifier: z.string().url().optional(),
    evidenceDocument: z.string().url().optional(),
    subjectPresence: z.enum(['Digital', 'Physical']).optional(),
    documentPresence: z.enum(['Digital', 'Physical']).optional(),
  })
  .passthrough();

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Credential Status - revocation status information
 */
export const CredentialStatusSchema = z
  .object({
    id: z.string().url(),
    type: z.string(),
    statusListIndex: z.string().optional(),
    statusListCredential: z.string().url().optional(),
    statusPurpose: z.enum(['revocation', 'suspension']).optional(),
  })
  .passthrough();

export type CredentialStatus = z.infer<typeof CredentialStatusSchema>;

/**
 * Credential Schema - schema that the credential conforms to
 */
export const CredentialSchemaSchema = z.union([
  z.string().url(),
  z
    .object({
      id: z.string().url(),
      type: z.string().optional(),
    })
    .passthrough(),
]);

export type CredentialSchema = z.infer<typeof CredentialSchemaSchema>;

/**
 * Proof - cryptographic proof of the credential
 * Supports JOSE (JWS) and JSON-LD proof formats
 */
export const ProofSchema = z
  .object({
    type: z.string(), // "JsonWebSignature2020", "Ed25519Signature2020", etc.
    created: DateTimeSchema.optional(),
    proofPurpose: z.string().optional(),
    verificationMethod: z.string().url().optional(),
    jws: z.string().optional(), // For JOSE/JWS proofs
    proofValue: z.string().optional(), // For JSON-LD proofs
    challenge: z.string().optional(),
    domain: z.string().optional(),
    nonce: z.string().optional(),
  })
  .passthrough();

export type Proof = z.infer<typeof ProofSchema>;

/**
 * Core Credential structure (v2.0)
 */
export const CredentialSchema_v2 = z
  .object({
    '@context': z.union([
      z.string().url(),
      z.array(z.union([z.string().url(), z.record(z.any())])),
    ]),
    id: z.string().url().optional(),
    type: z.union([z.string(), z.array(z.string())]),
    issuer: IssuerSchema,
    issuanceDate: DateTimeSchema,
    validFrom: DateTimeSchema.optional(),
    validUntil: DateTimeSchema.optional(),
    expirationDate: DateTimeSchema.optional(),
    credentialSubject: z.union([CredentialSubjectSchema, z.array(CredentialSubjectSchema)]),
    credentialStatus: CredentialStatusSchema.optional(),
    credentialSchema: z.union([CredentialSchemaSchema, z.array(CredentialSchemaSchema)]).optional(),
    evidence: z.union([EvidenceSchema, z.array(EvidenceSchema)]).optional(),
    termsOfUse: z.any().optional(),
    refreshService: z.any().optional(),
    proof: z.union([ProofSchema, z.array(ProofSchema)]).optional(),
  })
  .passthrough();

export type Credential = z.infer<typeof CredentialSchema_v2>;

/**
 * Verifiable Presentation - a collection of verifiable credentials
 */
export const VerifiablePresentationSchema = z
  .object({
    '@context': z.union([
      z.string().url(),
      z.array(z.union([z.string().url(), z.record(z.any())])),
    ]),
    id: z.string().url().optional(),
    type: z.union([z.string(), z.array(z.string())]),
    holder: z.string().url().optional(),
    verifiableCredential: z.union([
      CredentialSchema_v2,
      z.string(), // JWT-encoded VC
      z.array(z.union([CredentialSchema_v2, z.string()])),
    ]),
    proof: z.union([ProofSchema, z.array(ProofSchema)]).optional(),
  })
  .passthrough();

export type VerifiablePresentation = z.infer<typeof VerifiablePresentationSchema>;

/**
 * Normalized internal representation
 * This is what we use internally regardless of input format (JWT or JSON-LD)
 */
export interface NormalizedCredential {
  id: string;
  type: string[];
  issuer: {
    id: string;
    name?: string;
  };
  issuanceDate: Date;
  validFrom?: Date;
  validUntil?: Date;
  expirationDate?: Date;
  credentialSubject: CredentialSubject | CredentialSubject[];
  credentialStatus?: CredentialStatus;
  credentialSchema?: CredentialSchema | CredentialSchema[];
  evidence?: Evidence | Evidence[];
  proof?: Proof | Proof[];
  metadata?: Record<string, unknown>;
}

/**
 * JWT-encoded credential payload (when using JOSE)
 */
export interface JWTCredentialPayload {
  iss: string; // Issuer
  sub: string; // Subject (credentialSubject.id)
  vc: {
    '@context': string | string[];
    type: string | string[];
    credentialSubject: CredentialSubject | CredentialSubject[];
    credentialStatus?: CredentialStatus;
    credentialSchema?: CredentialSchema | CredentialSchema[];
    evidence?: Evidence | Evidence[];
  };
  jti?: string; // JWT ID (credential ID)
  nbf?: number; // Not before (Unix timestamp)
  iat?: number; // Issued at (Unix timestamp)
  exp?: number; // Expiration (Unix timestamp)
}

/**
 * Validation helpers
 */
export function validateCredential(data: unknown): Credential {
  return CredentialSchema_v2.parse(data);
}

export function validateVerifiablePresentation(data: unknown): VerifiablePresentation {
  return VerifiablePresentationSchema.parse(data);
}

/**
 * Normalize a credential to internal representation
 */
export function normalizeCredential(credential: Credential | string): NormalizedCredential {
  // If it's a JWT string, we'll need to decode it first (handled by caller)
  if (typeof credential === 'string') {
    throw new Error('JWT credentials must be decoded before normalization');
  }

  const validated = validateCredential(credential);

  const issuer =
    typeof validated.issuer === 'string'
      ? { id: validated.issuer }
      : { id: validated.issuer.id, name: validated.issuer.name };

  const type = Array.isArray(validated.type) ? validated.type : [validated.type];

  const issuanceDate =
    typeof validated.issuanceDate === 'string'
      ? new Date(validated.issuanceDate)
      : new Date(validated.issuanceDate * 1000);

  const validFrom = validated.validFrom
    ? typeof validated.validFrom === 'string'
      ? new Date(validated.validFrom)
      : new Date(validated.validFrom * 1000)
    : undefined;

  const validUntil = validated.validUntil
    ? typeof validated.validUntil === 'string'
      ? new Date(validated.validUntil)
      : new Date(validated.validUntil * 1000)
    : undefined;

  const expirationDate = validated.expirationDate
    ? typeof validated.expirationDate === 'string'
      ? new Date(validated.expirationDate)
      : new Date(validated.expirationDate * 1000)
    : undefined;

  return {
    id: validated.id || `urn:uuid:${crypto.randomUUID()}`,
    type,
    issuer,
    issuanceDate,
    validFrom,
    validUntil,
    expirationDate,
    credentialSubject: validated.credentialSubject,
    credentialStatus: validated.credentialStatus,
    credentialSchema: validated.credentialSchema,
    evidence: validated.evidence,
    proof: validated.proof,
    metadata: {},
  };
}

/**
 * Convert normalized credential back to JSON-LD format
 */
export function denormalizeCredential(normalized: NormalizedCredential): Credential {
  return {
    '@context': 'https://www.w3.org/2018/credentials/v2',
    id: normalized.id,
    type: normalized.type.length === 1 ? normalized.type[0] : normalized.type,
    issuer: normalized.issuer.name
      ? { id: normalized.issuer.id, name: normalized.issuer.name }
      : normalized.issuer.id,
    issuanceDate: normalized.issuanceDate.toISOString(),
    validFrom: normalized.validFrom?.toISOString(),
    validUntil: normalized.validUntil?.toISOString(),
    expirationDate: normalized.expirationDate?.toISOString(),
    credentialSubject: normalized.credentialSubject,
    credentialStatus: normalized.credentialStatus,
    credentialSchema: normalized.credentialSchema,
    evidence: normalized.evidence,
    proof: normalized.proof,
  };
}
