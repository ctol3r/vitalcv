/**
 * TIER-0 CLAIM PRIMITIVES
 *
 * Compile-time guarantees:
 * - purpose_of_use cannot be empty
 * - Values must be hashes (no raw PII)
 * - All fields are immutable
 */

/**
 * Branded type for non-empty strings
 * Enforces at compile time that string cannot be empty
 */
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { readonly [__brand]: TBrand };

/**
 * NonEmptyString - compile-time guarantee of non-emptiness
 */
export type NonEmptyString = Brand<string, 'NonEmptyString'>;

/**
 * Type guard to check if string is non-empty
 */
export function isNonEmptyString(value: string): value is NonEmptyString {
  return value.length > 0;
}

/**
 * Assert string is non-empty, throw if empty
 */
export function assertNonEmptyString(value: string, fieldName: string): asserts value is NonEmptyString {
  if (value.length === 0) {
    throw new ClaimValidationError(`${fieldName} cannot be empty`);
  }
}

/**
 * Hash type - represents a cryptographic hash
 * Format: algorithm:hexdigest (e.g., "sha256:abc123...")
 */
export type Hash = Brand<string, 'Hash'>;

/**
 * Supported hash algorithms
 */
export const HASH_ALGORITHMS = ['sha256', 'sha512', 'blake2b256'] as const;
export type HashAlgorithm = typeof HASH_ALGORITHMS[number];

/**
 * Hash format validation regex
 * Format: algorithm:hexdigest
 */
const HASH_REGEX = /^(sha256|sha512|blake2b256):[a-f0-9]{64,128}$/;

/**
 * Type guard for Hash
 */
export function isHash(value: string): value is Hash {
  return HASH_REGEX.test(value);
}

/**
 * Assert value is a valid hash, throw if invalid
 */
export function assertHash(value: string, fieldName: string): asserts value is Hash {
  if (!isHash(value)) {
    throw new ClaimValidationError(
      `${fieldName} must be a valid hash format (algorithm:hexdigest). Got: ${value}`
    );
  }
}

/**
 * Purpose of Use - HIPAA-compliant use categories
 * Must be non-empty at compile time
 */
export type PurposeOfUse = NonEmptyString & Brand<string, 'PurposeOfUse'>;

/**
 * Standard HIPAA purposes of use
 */
export const STANDARD_PURPOSES = [
  'TREATMENT',
  'PAYMENT',
  'OPERATIONS',
  'HOPER', // Healthcare Operations, Policy, and Research
  'QUALITY',
  'RESEARCH',
  'EMERGENCY',
  'PUBLIC_HEALTH',
  'JUDICIAL',
  'LAW_ENFORCEMENT',
  'COVERAGE',
  'MARKETING',
] as const;

export type StandardPurpose = typeof STANDARD_PURPOSES[number];

/**
 * Create a PurposeOfUse from string
 * Validates non-emptiness at runtime
 */
export function createPurposeOfUse(value: string): PurposeOfUse {
  assertNonEmptyString(value, 'purpose_of_use');
  return value as PurposeOfUse;
}

/**
 * ClaimType - identifies the type of claim
 * Must be non-empty
 */
export type ClaimType = NonEmptyString & Brand<string, 'ClaimType'>;

/**
 * Create a ClaimType from string
 */
export function createClaimType(value: string): ClaimType {
  assertNonEmptyString(value, 'claim_type');
  return value as ClaimType;
}

/**
 * ClaimValue - always a hash, never raw PII
 */
export type ClaimValue = Hash;

/**
 * Claim - core immutable claim structure
 *
 * Design guarantees:
 * - purpose_of_use is non-empty (compile-time enforced)
 * - All values are hashes (no raw PII)
 * - Immutable (readonly properties)
 */
export interface Claim {
  readonly type: ClaimType;
  readonly value: ClaimValue;
  readonly purpose_of_use: PurposeOfUse;
  readonly issued_at: number; // Unix timestamp (ms)
  readonly issuer: NonEmptyString; // DID or identifier
  readonly subject: NonEmptyString; // DID or identifier
}

/**
 * ClaimSchema - defines validation rules for a claim type
 */
export interface ClaimSchema {
  readonly type: ClaimType;
  readonly description: string;
  readonly hash_algorithm: HashAlgorithm;
  readonly allowed_purposes: ReadonlyArray<StandardPurpose | string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Custom error for claim validation failures
 */
export class ClaimValidationError extends Error {
  readonly code = 'CLAIM_VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ClaimValidationError';
    Object.setPrototypeOf(this, ClaimValidationError.prototype);
  }
}

/**
 * Custom error for schema registry operations
 */
export class SchemaRegistryError extends Error {
  readonly code = 'SCHEMA_REGISTRY_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'SchemaRegistryError';
    Object.setPrototypeOf(this, SchemaRegistryError.prototype);
  }
}
