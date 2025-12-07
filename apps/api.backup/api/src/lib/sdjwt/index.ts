/**
 * SD-JWT (Selective Disclosure JWT) Utilities
 * Tagged: cursor-batch-1107 (Task 0001) - UPDATED
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Implements canonical salt generation and disclosure packing/unpacking
 * with DETERMINISTIC claim ordering for cross-wallet compatibility
 * Spec: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt
 */

import * as crypto from 'crypto';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// ============================================================================
// CANONICALIZATION
// ============================================================================

/**
 * Canonicalize a JSON object with deterministic key ordering
 * Uses lexicographic (alphabetical) sorting to ensure stable serialization
 * across implementations and wallets
 *
 * RFC 8785: JSON Canonicalization Scheme (JCS)
 */
export function canonicalizeJSON(obj: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'number') return JSON.stringify(obj);
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (typeof obj === 'boolean') return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    const items = obj.map(canonicalizeJSON);
    return `[${items.join(',')}]`;
  }

  if (typeof obj === 'object') {
    // Sort keys alphabetically (lexicographic order)
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map((key) => {
      const canonicalKey = JSON.stringify(key);
      const canonicalValue = canonicalizeJSON(obj[key]);
      return `${canonicalKey}:${canonicalValue}`;
    });
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(obj);
}

/**
 * Deterministic JSON stringification with sorted keys
 * Ensures stable disclosure hashes across implementations
 */
export function deterministicStringify(obj: any): string {
  return canonicalizeJSON(obj);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Canonical salt size: 16 bytes (128 bits) */
export const SALT_BYTES = 16;

/** Canonical digest algorithm: SHA-256 */
export const DIGEST_ALGORITHM = 'sha-256';

// ============================================================================
// TYPES
// ============================================================================

export interface Disclosure {
  /** Base64url-encoded disclosure string */
  disclosure: string;
  /** Salt (16 bytes random) */
  salt: string;
  /** Claim name */
  claim: string;
  /** Claim value */
  value: any;
}

export interface DisclosureHash {
  /** SHA-256 hash of the disclosure */
  hash: string;
  /** Original disclosure (base64url) */
  disclosure: string;
}

// ============================================================================
// SALT GENERATION
// ============================================================================

/**
 * Generate a canonical 16-byte random salt
 * Uses crypto.randomBytes for cryptographically secure randomness
 */
export function generateSalt(): string {
  return crypto.randomBytes(SALT_BYTES).toString('base64url');
}

// ============================================================================
// DISCLOSURE CREATION
// ============================================================================

/**
 * Create a disclosure for a claim with DETERMINISTIC encoding
 * Format: [salt, claim_name, claim_value]
 *
 * @param claim - Claim name
 * @param value - Claim value (will be canonicalized)
 * @param salt - Optional salt (auto-generated if not provided)
 * @returns Disclosure object
 */
export function createDisclosure(claim: string, value: any, salt?: string): Disclosure {
  const _salt = salt || generateSalt();
  const disclosureArray = [_salt, claim, value];

  // Use deterministic JSON stringification to ensure stable hashes
  const disclosureJson = deterministicStringify(disclosureArray);
  const disclosure = Buffer.from(disclosureJson, 'utf-8').toString('base64url');

  return {
    disclosure,
    salt: _salt,
    claim,
    value,
  };
}

/**
 * Create a disclosure for an array element (no claim name) with DETERMINISTIC encoding
 * Format: [salt, claim_value]
 *
 * @param value - Array element value (will be canonicalized)
 * @param salt - Optional salt (auto-generated if not provided)
 * @returns Disclosure object
 */
export function createArrayDisclosure(value: any, salt?: string): Disclosure {
  const _salt = salt || generateSalt();
  const disclosureArray = [_salt, value];

  // Use deterministic JSON stringification to ensure stable hashes
  const disclosureJson = deterministicStringify(disclosureArray);
  const disclosure = Buffer.from(disclosureJson, 'utf-8').toString('base64url');

  return {
    disclosure,
    salt: _salt,
    claim: '', // Array elements don't have claim names
    value,
  };
}

// ============================================================================
// DISCLOSURE PARSING
// ============================================================================

/**
 * Parse a base64url-encoded disclosure
 *
 * @param disclosure - Base64url-encoded disclosure string
 * @returns Parsed disclosure object
 */
export function parseDisclosure(disclosure: string): Disclosure {
  try {
    const decoded = Buffer.from(disclosure, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded);

    if (!Array.isArray(parsed)) {
      throw new Error('Disclosure must be a JSON array');
    }

    // Object property disclosure: [salt, claim_name, claim_value]
    if (parsed.length === 3) {
      const [salt, claim, value] = parsed;
      if (typeof salt !== 'string' || typeof claim !== 'string') {
        throw new Error('Invalid disclosure format: salt and claim must be strings');
      }
      return { disclosure, salt, claim, value };
    }

    // Array element disclosure: [salt, claim_value]
    if (parsed.length === 2) {
      const [salt, value] = parsed;
      if (typeof salt !== 'string') {
        throw new Error('Invalid disclosure format: salt must be a string');
      }
      return { disclosure, salt, claim: '', value };
    }

    throw new Error(`Invalid disclosure array length: ${parsed.length}`);
  } catch (error: any) {
    throw new Error(`Failed to parse disclosure: ${error.message}`);
  }
}

// ============================================================================
// HASHING
// ============================================================================

/**
 * Compute SHA-256 hash of a disclosure
 * Returns base64url-encoded hash
 *
 * @param disclosure - Base64url-encoded disclosure string
 * @returns Base64url-encoded SHA-256 hash
 */
export function hashDisclosure(disclosure: string): string {
  const hash = sha256(Buffer.from(disclosure, 'utf-8'));
  return Buffer.from(hash).toString('base64url');
}

/**
 * Create a disclosure hash object
 */
export function createDisclosureHash(disclosure: string): DisclosureHash {
  return {
    hash: hashDisclosure(disclosure),
    disclosure,
  };
}

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Verify that a disclosure matches its hash
 *
 * @param disclosure - Base64url-encoded disclosure
 * @param expectedHash - Expected base64url-encoded SHA-256 hash
 * @returns true if hash matches, false otherwise
 */
export function verifyDisclosure(disclosure: string, expectedHash: string): boolean {
  const actualHash = hashDisclosure(disclosure);
  return actualHash === expectedHash;
}

// ============================================================================
// PACKING / UNPACKING
// ============================================================================

/**
 * Pack disclosures into an object with _sd array
 * Hashes are SORTED lexicographically for deterministic ordering
 *
 * @param disclosures - Array of disclosure objects
 * @returns Object with _sd array containing disclosure hashes (sorted)
 */
export function packDisclosures(disclosures: Disclosure[]): { _sd: string[] } {
  const hashes = disclosures.map((d) => hashDisclosure(d.disclosure));

  // Sort hashes lexicographically for deterministic ordering
  hashes.sort();

  return { _sd: hashes };
}

/**
 * Unpack disclosures from an _sd array
 * Verifies that each disclosure hash matches
 *
 * @param sdArray - Array of disclosure hashes from _sd
 * @param disclosures - Array of disclosure strings to verify
 * @returns Map of claim names to values
 */
export function unpackDisclosures(sdArray: string[], disclosures: string[]): Map<string, any> {
  const claims = new Map<string, any>();
  const hashSet = new Set(sdArray);

  for (const disclosure of disclosures) {
    const hash = hashDisclosure(disclosure);

    if (!hashSet.has(hash)) {
      throw new Error(`Disclosure hash ${hash} not found in _sd array`);
    }

    const parsed = parseDisclosure(disclosure);
    if (parsed.claim) {
      // Object property disclosure
      claims.set(parsed.claim, parsed.value);
    }
    // Array element disclosures don't have claim names
  }

  return claims;
}

/**
 * Create nested disclosures for complex objects
 *
 * @param obj - Object to create disclosures for
 * @param options - Options for nested disclosure
 * @returns Tuple of [processed object with _sd arrays, flat disclosure list]
 */
export function createNestedDisclosures(
  obj: Record<string, any>,
  options: {
    selectiveClaims?: string[]; // Only these claims are selectively disclosable
    recursive?: boolean; // Recursively handle nested objects
  } = {},
): [Record<string, any>, Disclosure[]] {
  const { selectiveClaims, recursive = false } = options;
  const result: Record<string, any> = {};
  const allDisclosures: Disclosure[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const shouldDisclose = !selectiveClaims || selectiveClaims.includes(key);

    if (shouldDisclose) {
      // Create disclosure for this claim
      const disclosure = createDisclosure(key, value);
      allDisclosures.push(disclosure);
    } else if (recursive && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively handle nested objects
      const [nestedObj, nestedDisclosures] = createNestedDisclosures(value, options);
      result[key] = nestedObj;
      allDisclosures.push(...nestedDisclosures);
    } else {
      // Keep as-is (not selectively disclosed)
      result[key] = value;
    }
  }

  // Add _sd array if we have disclosures
  if (allDisclosures.length > 0) {
    result._sd = allDisclosures.map((d) => hashDisclosure(d.disclosure));
  }

  return [result, allDisclosures];
}

/**
 * Reveal selectively disclosed claims
 *
 * @param sdJwt - SD-JWT payload with _sd arrays
 * @param disclosures - Array of disclosure strings
 * @returns Fully revealed claims object
 */
export function revealClaims(
  sdJwt: Record<string, any>,
  disclosures: string[],
): Record<string, any> {
  const result = { ...sdJwt };

  if (result._sd && Array.isArray(result._sd)) {
    const claims = unpackDisclosures(result._sd, disclosures);

    // Merge revealed claims into result
    for (const [key, value] of claims.entries()) {
      result[key] = value;
    }

    // Remove _sd array
    delete result._sd;
  }

  return result;
}
