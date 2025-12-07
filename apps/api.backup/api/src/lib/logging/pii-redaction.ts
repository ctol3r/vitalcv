/**
 * PII Redaction for Logs
 * Tagged: cursor-batch-1105 (Task 0023)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Redacts personally identifiable information from log messages
 */

/**
 * PII field patterns to redact
 */
const PII_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  replacement: string;
}> = [
  // Email addresses
  {
    name: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
  },

  // Phone numbers (US format)
  {
    name: 'phone',
    regex: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },

  // Social Security Numbers
  {
    name: 'ssn',
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
  },

  // Credit card numbers (basic pattern)
  {
    name: 'credit_card',
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[CC_REDACTED]',
  },

  // NPI numbers (10 digits)
  {
    name: 'npi',
    regex: /\b\d{10}\b/g,
    replacement: '[NPI_REDACTED]',
  },

  // License numbers (alphanumeric, 6-12 chars)
  {
    name: 'license',
    regex: /\b[A-Z0-9]{6,12}\b/g,
    replacement: '[LICENSE_REDACTED]',
  },
];

/**
 * JSON field names that contain PII
 */
const PII_FIELD_NAMES = new Set([
  'email',
  'phone',
  'phoneNumber',
  'ssn',
  'socialSecurityNumber',
  'npi',
  'licenseNumber',
  'license',
  'given_name',
  'givenName',
  'firstName',
  'family_name',
  'familyName',
  'lastName',
  'name',
  'fullName',
  'address',
  'street',
  'city',
  'zip',
  'zipCode',
  'postalCode',
  'dob',
  'dateOfBirth',
  'birthdate',
  'passport',
  'passportNumber',
  'driverLicense',
  'creditCard',
  'password',
  'secret',
  'token',
  'apiKey',
  'privateKey',
]);

/**
 * Redact PII from a string
 */
export function redactPiiFromString(text: string): string {
  let redacted = text;

  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern.regex, pattern.replacement);
  }

  return redacted;
}

/**
 * Redact PII from an object (recursively)
 */
export function redactPiiFromObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactPiiFromString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactPiiFromObject(item));
  }

  const redacted: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Check if field name is PII
    if (PII_FIELD_NAMES.has(key)) {
      redacted[key] = '[REDACTED]';
      continue;
    }

    // Recursively redact nested objects
    if (typeof value === 'object') {
      redacted[key] = redactPiiFromObject(value);
    } else if (typeof value === 'string') {
      redacted[key] = redactPiiFromString(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Create a PII-safe log message
 */
export function createSafeLogMessage(message: string, context?: any): {
  message: string;
  context?: any;
} {
  return {
    message: redactPiiFromString(message),
    context: context ? redactPiiFromObject(context) : undefined,
  };
}

/**
 * Logger wrapper with automatic PII redaction
 */
export class SafeLogger {
  private logger: any; // Actual logger instance (Winston, Pino, etc.)

  constructor(logger: any) {
    this.logger = logger;
  }

  info(message: string, context?: any): void {
    const safe = createSafeLogMessage(message, context);
    if (safe.context) {
      this.logger.info(safe.message, safe.context);
    } else {
      this.logger.info(safe.message);
    }
  }

  warn(message: string, context?: any): void {
    const safe = createSafeLogMessage(message, context);
    if (safe.context) {
      this.logger.warn(safe.message, safe.context);
    } else {
      this.logger.warn(safe.message);
    }
  }

  error(message: string, context?: any): void {
    const safe = createSafeLogMessage(message, context);
    if (safe.context) {
      this.logger.error(safe.message, safe.context);
    } else {
      this.logger.error(safe.message);
    }
  }

  debug(message: string, context?: any): void {
    const safe = createSafeLogMessage(message, context);
    if (safe.context) {
      this.logger.debug(safe.message, safe.context);
    } else {
      this.logger.debug(safe.message);
    }
  }
}

/**
 * Check if a value contains PII
 */
export function containsPii(value: string): boolean {
  for (const pattern of PII_PATTERNS) {
    if (pattern.regex.test(value)) {
      return true;
    }
  }
  return false;
}

