/**
 * @vitalcv/claims
 *
 * TIER-0 CLAIM PRIMITIVES
 *
 * Compile-time guarantees:
 * - purpose_of_use cannot be empty (branded type enforcement)
 * - Values must be hashes (no raw PII allowed)
 * - All validations throw on failure (no silent bypasses)
 * - Immutable structures (readonly properties)
 *
 * Design principles:
 * - No stubs
 * - No bypassed validation
 * - No assumptions
 * - No AI logic
 * - No resolver logic
 * - Fail-fast (throw early)
 */

// Core types
export type {
  // Branded types
  NonEmptyString,
  Hash,
  PurposeOfUse,
  ClaimType,
  ClaimValue,

  // Core interfaces
  Claim,
  ClaimSchema,

  // Hash algorithms
  HashAlgorithm,

  // Standard purposes
  StandardPurpose,
} from './types';

export {
  // Type guards
  isNonEmptyString,
  isHash,

  // Assertion functions (throw on failure)
  assertNonEmptyString,
  assertHash,

  // Factory functions
  createPurposeOfUse,
  createClaimType,

  // Constants
  HASH_ALGORITHMS,
  STANDARD_PURPOSES,

  // Errors
  ClaimValidationError,
  SchemaRegistryError,
} from './types';

// Hash utilities
export {
  computeHash,
  computeHashWithSalt,
  verifyHash,
  extractAlgorithm,
  extractDigest,
} from './hash';

// Schema registry
export {
  SchemaRegistry,
  globalRegistry,
  registerStandardSchemas,
} from './registry';

// Validation (throws on failure)
export {
  validateClaim,
  validateClaimWithRegistry,
  validateClaims,
  validateClaimStructure,
  parseClaim,
  parseClaims,
} from './validate';
