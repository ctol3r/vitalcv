/**
 * PII Redaction for Structured Logging
 *
 * Automatically redacts sensitive fields from log contexts to ensure
 * no PII (Personally Identifiable Information) is exposed in logs.
 *
 * Hard Constraint (Wave 5): NO PII IN LOGS
 */

/**
 * Default PII fields that should be redacted from all logs
 */
const DEFAULT_PII_FIELDS = [
  'npi',
  'license_number',
  'licenseNumber',
  'ssn',
  'social_security_number',
  'date_of_birth',
  'dateOfBirth',
  'dob',
  'phone_number',
  'phoneNumber',
  'phone',
  'email',
  'address',
  'street',
  'city',
  'postal_code',
  'postalCode',
  'zip',
  'zipCode',
  'patient_id',
  'patientId',
  'medical_record_number',
  'medicalRecordNumber',
  'mrn',
  'credit_card',
  'creditCard',
  'card_number',
  'cardNumber',
  'password',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'private_key',
  'privateKey',
] as const;

const REDACTED_VALUE = '[REDACTED]';

/**
 * Check if a key should be redacted based on PII field list
 *
 * @param key - The field key to check
 * @param piiFields - List of PII field names
 * @returns true if the key matches a PII field
 */
function isPiiField(key: string, piiFields: ReadonlyArray<string>): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  return piiFields.some((field) => {
    const normalizedField = field.toLowerCase().replace(/[_-]/g, '');
    return normalized === normalizedField || normalized.includes(normalizedField);
  });
}

/**
 * Redact PII from a single value (primitive or object)
 *
 * @param value - Value to potentially redact
 * @param piiFields - List of PII field names
 * @param depth - Current recursion depth (max 10)
 * @returns Redacted value
 */
function redactValue(
  value: unknown,
  piiFields: ReadonlyArray<string>,
  depth: number = 0,
): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, piiFields, depth + 1));
  }

  // Handle Date objects
  if (value instanceof Date) {
    return value;
  }

  // Handle plain objects
  if (Object.prototype.toString.call(value) === '[object Object]') {
    const redacted: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (isPiiField(key, piiFields)) {
        redacted[key] = REDACTED_VALUE;
      } else {
        redacted[key] = redactValue(val, piiFields, depth + 1);
      }
    }

    return redacted;
  }

  // For other object types (Error, etc.), return as-is
  return value;
}

/**
 * Redact PII fields from a log context object
 *
 * This function recursively redacts sensitive fields from the provided context.
 * It handles nested objects and arrays.
 *
 * Usage:
 * ```typescript
 * const context = { name: 'John', npi: '1234567890', age: 30 };
 * const redacted = redactPII(context);
 * // Result: { name: 'John', npi: '[REDACTED]', age: 30 }
 * ```
 *
 * @param context - The log context object to redact
 * @param additionalFields - Additional PII field names beyond the default list
 * @returns Redacted copy of the context
 */
export function redactPII<T = Record<string, unknown>>(
  context: T,
  additionalFields: string[] = [],
): T {
  if (!context || typeof context !== 'object') {
    return context;
  }

  const allPiiFields = [...DEFAULT_PII_FIELDS, ...additionalFields];
  return redactValue(context, allPiiFields, 0) as T;
}

/**
 * Get the list of default PII fields that are redacted
 *
 * @returns Array of default PII field names
 */
export function getDefaultPiiFields(): string[] {
  return [...DEFAULT_PII_FIELDS];
}

/**
 * Check if a field name is considered PII
 *
 * @param fieldName - The field name to check
 * @param additionalFields - Additional PII fields beyond defaults
 * @returns true if the field is PII
 */
export function isPii(fieldName: string, additionalFields: string[] = []): boolean {
  const allFields = [...DEFAULT_PII_FIELDS, ...additionalFields];
  return isPiiField(fieldName, allFields);
}
