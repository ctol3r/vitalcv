/**
 * CLAIM VALIDATION
 *
 * Strict validation that throws on failure
 * No bypasses, no assumptions
 */

import {
  Claim,
  ClaimSchema,
  ClaimValidationError,
  assertNonEmptyString,
  assertHash,
} from './types';
import { SchemaRegistry } from './registry';

/**
 * Validate claim against schema
 *
 * @param claim - Claim to validate
 * @param schema - Schema to validate against
 * @throws ClaimValidationError if validation fails
 */
export function validateClaim(claim: Claim, schema: ClaimSchema): void {
  // Validate claim type matches schema
  if (claim.type !== schema.type) {
    throw new ClaimValidationError(
      `Claim type mismatch: expected "${schema.type}", got "${claim.type}"`
    );
  }

  // Validate purpose_of_use is non-empty (compile-time enforced by type)
  // Runtime check for extra safety
  assertNonEmptyString(claim.purpose_of_use, 'purpose_of_use');

  // Validate purpose_of_use is allowed for this claim type
  if (!schema.allowed_purposes.includes(claim.purpose_of_use)) {
    throw new ClaimValidationError(
      `Purpose "${claim.purpose_of_use}" not allowed for claim type "${claim.type}". ` +
      `Allowed: ${schema.allowed_purposes.join(', ')}`
    );
  }

  // Validate value is a hash (no raw PII)
  assertHash(claim.value, 'claim.value');

  // Validate hash algorithm matches schema requirement
  const [algorithm] = claim.value.split(':');
  if (algorithm !== schema.hash_algorithm) {
    throw new ClaimValidationError(
      `Hash algorithm mismatch: expected "${schema.hash_algorithm}", got "${algorithm}"`
    );
  }

  // Validate issuer is non-empty
  assertNonEmptyString(claim.issuer, 'issuer');

  // Validate subject is non-empty
  assertNonEmptyString(claim.subject, 'subject');

  // Validate issued_at is a valid timestamp
  if (!Number.isInteger(claim.issued_at) || claim.issued_at <= 0) {
    throw new ClaimValidationError(
      `issued_at must be a positive integer timestamp (ms). Got: ${claim.issued_at}`
    );
  }

  // Validate issued_at is not in the future (with 5 minute tolerance for clock skew)
  const now = Date.now();
  const tolerance = 5 * 60 * 1000; // 5 minutes
  if (claim.issued_at > now + tolerance) {
    throw new ClaimValidationError(
      `issued_at cannot be in the future. Got: ${claim.issued_at}, now: ${now}`
    );
  }
}

/**
 * Validate claim using registry
 *
 * @param claim - Claim to validate
 * @param registry - Schema registry
 * @throws ClaimValidationError if validation fails
 * @throws SchemaRegistryError if schema not found
 */
export function validateClaimWithRegistry(
  claim: Claim,
  registry: SchemaRegistry
): void {
  const schema = registry.get(claim.type);
  validateClaim(claim, schema);
}

/**
 * Validate multiple claims
 *
 * @param claims - Claims to validate
 * @param registry - Schema registry
 * @throws ClaimValidationError on first validation failure
 */
export function validateClaims(
  claims: ReadonlyArray<Claim>,
  registry: SchemaRegistry
): void {
  for (let i = 0; i < claims.length; i++) {
    try {
      validateClaimWithRegistry(claims[i], registry);
    } catch (error) {
      if (error instanceof ClaimValidationError) {
        throw new ClaimValidationError(
          `Claim at index ${i} failed validation: ${error.message}`
        );
      }
      throw error;
    }
  }
}

/**
 * Validate claim structure (shallow validation without schema)
 *
 * Checks:
 * - All required fields present
 * - purpose_of_use is non-empty
 * - value is a hash
 * - issuer/subject are non-empty
 * - issued_at is valid timestamp
 *
 * @param input - Input to validate
 * @throws ClaimValidationError if validation fails
 */
export function validateClaimStructure(input: unknown): asserts input is Claim {
  if (typeof input !== 'object' || input === null) {
    throw new ClaimValidationError('Claim must be an object');
  }

  const claim = input as Record<string, unknown>;

  // Validate type
  if (typeof claim.type !== 'string') {
    throw new ClaimValidationError('claim.type must be a string');
  }
  assertNonEmptyString(claim.type, 'claim.type');

  // Validate value
  if (typeof claim.value !== 'string') {
    throw new ClaimValidationError('claim.value must be a string');
  }
  assertHash(claim.value, 'claim.value');

  // Validate purpose_of_use
  if (typeof claim.purpose_of_use !== 'string') {
    throw new ClaimValidationError('claim.purpose_of_use must be a string');
  }
  assertNonEmptyString(claim.purpose_of_use, 'purpose_of_use');

  // Validate issued_at
  if (typeof claim.issued_at !== 'number') {
    throw new ClaimValidationError('claim.issued_at must be a number');
  }
  if (!Number.isInteger(claim.issued_at) || claim.issued_at <= 0) {
    throw new ClaimValidationError(
      `claim.issued_at must be a positive integer. Got: ${claim.issued_at}`
    );
  }

  // Validate issuer
  if (typeof claim.issuer !== 'string') {
    throw new ClaimValidationError('claim.issuer must be a string');
  }
  assertNonEmptyString(claim.issuer, 'claim.issuer');

  // Validate subject
  if (typeof claim.subject !== 'string') {
    throw new ClaimValidationError('claim.subject must be a string');
  }
  assertNonEmptyString(claim.subject, 'claim.subject');
}

/**
 * Attempt to parse and validate claim from unknown input
 *
 * @param input - Unknown input
 * @returns Validated claim
 * @throws ClaimValidationError if parsing or validation fails
 */
export function parseClaim(input: unknown): Claim {
  validateClaimStructure(input);
  return input;
}

/**
 * Attempt to parse and validate claims from unknown input
 *
 * @param input - Unknown input (should be array)
 * @returns Validated claims
 * @throws ClaimValidationError if parsing or validation fails
 */
export function parseClaims(input: unknown): ReadonlyArray<Claim> {
  if (!Array.isArray(input)) {
    throw new ClaimValidationError('Claims must be an array');
  }

  return input.map((item, index) => {
    try {
      return parseClaim(item);
    } catch (error) {
      if (error instanceof ClaimValidationError) {
        throw new ClaimValidationError(
          `Claim at index ${index} failed parsing: ${error.message}`
        );
      }
      throw error;
    }
  });
}
