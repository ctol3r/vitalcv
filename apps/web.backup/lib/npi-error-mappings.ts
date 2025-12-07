/**
 * NPI Error Mappings & Validation
 * Provides actionable error messages for invalid NPIs
 */

export interface NPIError {
  code: string;
  userMessage: string;
  guidance: string;
  recoverable: boolean;
  example?: string;
}

/**
 * Validate NPI using Luhn algorithm
 */
function isValidNPI(npi: string): boolean {
  if (!/^[12]\d{9}$/.test(npi)) return false;

  const payload = '80840' + npi.slice(0, 9);
  let sum = 0;

  for (let i = 0; i < payload.length; i++) {
    let d = parseInt(payload[payload.length - 1 - i], 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(npi[9], 10);
}

/**
 * Comprehensive NPI validation with specific error messages
 */
export function validateNPI(npi: string): NPIError | null {
  // Empty check
  if (!npi || npi.trim() === '') {
    return {
      code: 'EMPTY',
      userMessage: 'NPI is required',
      guidance: 'Please enter your 10-digit National Provider Identifier.',
      recoverable: true,
      example: '1234567893',
    };
  }

  // Length check
  if (npi.length !== 10) {
    return {
      code: 'INVALID_LENGTH',
      userMessage: `Invalid NPI length (${npi.length} digits)`,
      guidance: `NPIs must be exactly 10 digits. You entered ${npi.length} digit${npi.length !== 1 ? 's' : ''}.`,
      recoverable: true,
      example: '1234567893',
    };
  }

  // Numeric check
  if (!/^\d{10}$/.test(npi)) {
    return {
      code: 'NON_NUMERIC',
      userMessage: 'NPI contains non-numeric characters',
      guidance: 'NPIs must contain only numbers (0-9). Remove any letters, spaces, or special characters.',
      recoverable: true,
      example: '1234567893',
    };
  }

  // Prefix check (must start with 1 or 2)
  if (!/^[12]/.test(npi)) {
    return {
      code: 'INVALID_PREFIX',
      userMessage: 'Invalid NPI prefix',
      guidance: `NPIs must start with 1 (Individual) or 2 (Organization). Your NPI starts with '${npi[0]}'.`,
      recoverable: true,
      example: npi[0] === '1' ? '1234567893' : '2234567890',
    };
  }

  // Luhn checksum validation
  if (!isValidNPI(npi)) {
    return {
      code: 'INVALID_CHECKSUM',
      userMessage: 'Invalid NPI checksum',
      guidance:
        'This NPI fails the Luhn algorithm check. Please verify you entered the correct number. Typos in any digit will cause this error.',
      recoverable: true,
      example: '1234567893',
    };
  }

  // All checks passed
  return null;
}

/**
 * Get telemetry data for analytics tracking
 */
export function getNPIErrorTelemetry(
  npi: string,
  error: NPIError,
): Record<string, any> {
  return {
    error_code: error.code,
    error_message: error.userMessage,
    npi_length: npi.length,
    npi_prefix: npi[0] || 'none',
    has_non_numeric: /[^0-9]/.test(npi),
    recoverable: error.recoverable,
  };
}

/**
 * Common NPI validation patterns for forms
 */
export const NPI_VALIDATION_PATTERNS = {
  format: /^[12]\d{9}$/,
  length: 10,
  prefixes: ['1', '2'],
} as const;

/**
 * Sample NPIs for testing
 */
export const SAMPLE_NPIS = {
  individual: {
    valid: ['1234567893', '1407929250', '1982741287'],
    invalid: ['1234567890', '1000000000'],
  },
  organization: {
    valid: ['2234567890', '2407929259', '2982741286'],
    invalid: ['2000000000', '2111111111'],
  },
} as const;

/**
 * Format NPI for display (add spacing for readability)
 */
export function formatNPIForDisplay(npi: string): string {
  if (npi.length !== 10) return npi;
  return `${npi.slice(0, 4)} ${npi.slice(4, 7)} ${npi.slice(7)}`;
}

/**
 * Get NPI type from prefix
 */
export function getNPIType(npi: string): 'individual' | 'organization' | 'unknown' {
  if (npi[0] === '1') return 'individual';
  if (npi[0] === '2') return 'organization';
  return 'unknown';
}
