/**
 * NPI Input Validator
 * Tagged: cursor-batch-1105 (Task 0006)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Validates NPI numbers with structured error reasons
 */

import { NpiInvalidError } from './http/errors';

/**
 * NPI validation rules:
 * - Must be exactly 10 digits
 * - Must pass Luhn algorithm checksum
 * - Format: XXXXXXXXXY where Y is checksum digit
 */

/**
 * Luhn algorithm checksum validator
 * Used by NPI, credit cards, etc.
 */
function luhnCheck(value: string): boolean {
  let sum = 0;
  let alternate = false;

  // Process digits from right to left
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = parseInt(value.charAt(i), 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Calculate Luhn checksum digit
 */
function calculateLuhnChecksum(value: string): number {
  let sum = 0;
  let alternate = true; // Start with alternate since we're calculating the final digit

  // Process digits from right to left
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = parseInt(value.charAt(i), 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    alternate = !alternate;
  }

  return (10 - (sum % 10)) % 10;
}

export interface NpiValidationResult {
  valid: boolean;
  npi?: string;
  reason?: 'checksum' | 'length' | 'format';
  message?: string;
  expected?: string;
  actual?: string;
}

/**
 * Validate NPI format and checksum
 *
 * @param npi - NPI to validate
 * @param throwOnError - If true, throws NpiInvalidError on validation failure
 * @returns Validation result
 */
export function validateNpi(npi: string | null | undefined, throwOnError = false): NpiValidationResult {
  // Check null/undefined
  if (npi === null || npi === undefined || npi === '') {
    const result = {
      valid: false,
      reason: 'format' as const,
      message: 'NPI is required',
    };

    if (throwOnError) {
      throw new NpiInvalidError(result.message, {
        npi: npi || '',
        reason: result.reason,
      });
    }

    return result;
  }

  // Trim and remove whitespace
  const cleaned = npi.trim().replace(/\s/g, '');

  // Check format (digits only)
  if (!/^\d+$/.test(cleaned)) {
    const result = {
      valid: false,
      npi: cleaned,
      reason: 'format' as const,
      message: 'NPI must contain only digits',
    };

    if (throwOnError) {
      throw new NpiInvalidError(result.message, {
        npi: cleaned,
        reason: result.reason,
      });
    }

    return result;
  }

  // Check length
  if (cleaned.length !== 10) {
    const result = {
      valid: false,
      npi: cleaned,
      reason: 'length' as const,
      message: `NPI must be exactly 10 digits (got ${cleaned.length})`,
      expected: '10',
      actual: cleaned.length.toString(),
    };

    if (throwOnError) {
      throw new NpiInvalidError(result.message, {
        npi: cleaned,
        reason: result.reason,
        expected: result.expected,
        actual: result.actual,
      });
    }

    return result;
  }

  // Check Luhn checksum
  if (!luhnCheck(cleaned)) {
    const expectedChecksum = calculateLuhnChecksum(cleaned.substring(0, 9));
    const actualChecksum = cleaned.charAt(9);

    const result = {
      valid: false,
      npi: cleaned,
      reason: 'checksum' as const,
      message: `NPI checksum validation failed (expected ${expectedChecksum}, got ${actualChecksum})`,
      expected: expectedChecksum.toString(),
      actual: actualChecksum,
    };

    if (throwOnError) {
      throw new NpiInvalidError(result.message, {
        npi: cleaned,
        reason: result.reason,
        expected: result.expected,
        actual: result.actual,
      });
    }

    return result;
  }

  return {
    valid: true,
    npi: cleaned,
  };
}

/**
 * Assert that an NPI is valid (throws on invalid)
 */
export function assertValidNpi(npi: string | null | undefined): string {
  const result = validateNpi(npi, true);
  return result.npi!;
}

/**
 * Check if NPI is valid (boolean)
 */
export function isValidNpi(npi: string | null | undefined): boolean {
  return validateNpi(npi, false).valid;
}

/**
 * Generate a valid NPI for testing purposes
 * @param base - 9-digit base (will calculate checksum)
 */
export function generateTestNpi(base?: string): string {
  const _base = base || Math.floor(100000000 + Math.random() * 900000000).toString();

  if (_base.length !== 9) {
    throw new Error('Base must be 9 digits');
  }

  const checksum = calculateLuhnChecksum(_base);
  return _base + checksum.toString();
}

