/**
 * B150A-DSAR-005: Anonymization helpers for text & identifiers
 *
 * Provides deterministic and non-deterministic anonymization functions
 * for PII data. Deterministic functions use hashing for consistency,
 * while non-deterministic functions generate random values.
 */

import crypto from 'crypto';

/**
 * Anonymize a name to a consistent pseudonym
 * Uses deterministic hashing to ensure same name always produces same pseudonym
 */
export function anonymizeName(name: string, seed?: string): string {
  if (!name || name.trim().length === 0) {
    return '[REDACTED]';
  }

  // Create hash from name + optional seed
  const hashInput = seed ? `${name}:${seed}` : name;
  const hash = crypto.createHash('sha256').update(hashInput.toLowerCase().trim()).digest('hex');

  // Use first 8 chars of hash to generate pseudonym
  const prefix = hash.substring(0, 8);

  // Generate a first name and last name from hash
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

  const firstNameIndex = parseInt(hash.substring(0, 2), 16) % firstNames.length;
  const lastNameIndex = parseInt(hash.substring(2, 4), 16) % lastNames.length;

  return `${firstNames[firstNameIndex]} ${lastNames[lastNameIndex]}`;
}

/**
 * Anonymize an email address
 * Uses deterministic hashing to ensure same email always produces same anonymized email
 */
export function anonymizeEmail(email: string, seed?: string): string {
  if (!email || email.trim().length === 0) {
    return '[REDACTED]@example.com';
  }

  const hashInput = seed ? `${email}:${seed}` : email;
  const hash = crypto.createHash('sha256').update(hashInput.toLowerCase().trim()).digest('hex');

  // Use first 12 chars of hash for local part, domain is always anonymized
  const localPart = hash.substring(0, 12);

  return `${localPart}@anonymous.local`;
}

/**
 * Anonymize a phone number
 * Uses deterministic hashing to ensure same phone always produces same anonymized phone
 */
export function anonymizePhone(phone: string, seed?: string): string {
  if (!phone || phone.trim().length === 0) {
    return '[REDACTED]';
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) {
    return '[REDACTED]';
  }

  const hashInput = seed ? `${digits}:${seed}` : digits;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Generate a phone number pattern: (XXX) XXX-XXXX
  const areaCode = (parseInt(hash.substring(0, 3), 16) % 900) + 100; // 100-999
  const exchange = (parseInt(hash.substring(3, 6), 16) % 900) + 100; // 100-999
  const number = (parseInt(hash.substring(6, 10), 16) % 10000).toString().padStart(4, '0');

  return `(${areaCode}) ${exchange}-${number}`;
}

/**
 * Anonymize free text by replacing PII patterns
 * Non-deterministic - same input may produce different output
 */
export function anonymizeFreeText(text: string): string {
  if (!text || text.trim().length === 0) {
    return '[REDACTED]';
  }

  let anonymized = text;

  // Replace email addresses
  anonymized = anonymized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );

  // Replace phone numbers (various formats)
  anonymized = anonymized.replace(
    /\b(?:\+?1[-.]?)?\(?([0-9]{3})\)?[-.]?([0-9]{3})[-.]?([0-9]{4})\b/g,
    '[PHONE_REDACTED]'
  );

  // Replace SSN patterns (XXX-XX-XXXX)
  anonymized = anonymized.replace(
    /\b\d{3}-\d{2}-\d{4}\b/g,
    '[SSN_REDACTED]'
  );

  // Replace credit card numbers (16 digits, possibly with dashes)
  anonymized = anonymized.replace(
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    '[CARD_REDACTED]'
  );

  // Replace potential names (capitalized words, but be conservative)
  // This is a simple heuristic - might have false positives
  const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
  // Don't replace common words that match the pattern
  const commonWords = new Set(['United States', 'New York', 'Los Angeles', 'San Francisco']);
  anonymized = anonymized.replace(namePattern, (match) => {
    if (commonWords.has(match)) {
      return match;
    }
    return '[NAME_REDACTED]';
  });

  // Replace IP addresses
  anonymized = anonymized.replace(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    '[IP_REDACTED]'
  );

  return anonymized;
}

/**
 * Deterministic anonymization for free text (preserves structure)
 * Uses hashing to ensure same input produces same output
 */
export function anonymizeFreeTextDeterministic(text: string, seed?: string): string {
  if (!text || text.trim().length === 0) {
    return '[REDACTED]';
  }

  const hashInput = seed ? `${text}:${seed}` : text;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Generate a deterministic but anonymized version
  // Replace with hash-based token that maintains approximate length
  const tokenLength = Math.min(text.length, 32);
  const token = hash.substring(0, tokenLength);

  // Preserve word count and approximate structure
  const wordCount = text.split(/\s+/).length;
  const tokens = Array(wordCount).fill(token).join(' ');

  return tokens;
}

/**
 * Anonymize a DID (Decentralized Identifier)
 * Preserves DID method and network for utility but anonymizes identifier
 */
export function anonymizeDid(did: string, seed?: string): string {
  if (!did || did.trim().length === 0) {
    return '[REDACTED]';
  }

  // Parse DID: did:method:identifier
  const parts = did.split(':');

  if (parts.length < 3) {
    return '[REDACTED]';
  }

  const method = parts[1];
  const identifier = parts.slice(2).join(':');

  const hashInput = seed ? `${identifier}:${seed}` : identifier;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Use first 32 chars of hash for anonymized identifier
  const anonymizedId = hash.substring(0, 32);

  return `did:${method}:${anonymizedId}`;
}

/**
 * Anonymize an NPI (National Provider Identifier)
 * Preserves format but anonymizes value
 */
export function anonymizeNpi(npi: string, seed?: string): string {
  if (!npi || npi.trim().length === 0) {
    return '[REDACTED]';
  }

  // Remove non-digits
  const digits = npi.replace(/\D/g, '');

  if (digits.length !== 10) {
    return '[REDACTED]';
  }

  const hashInput = seed ? `${digits}:${seed}` : digits;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // Generate a valid-looking but anonymized 10-digit NPI
  // NPIs must start with 1-9 (not 0)
  const firstDigit = (parseInt(hash.substring(0, 1), 16) % 9) + 1; // 1-9
  const restDigits = hash.substring(1, 10);

  return `${firstDigit}${restDigits}`;
}

/**
 * Check if a value has been anonymized
 */
export function isAnonymized(value: string): boolean {
  if (!value) {
    return false;
  }

  const anonymizedPatterns = [
    /^\[REDACTED\]/i,
    /^\[EMAIL_REDACTED\]/i,
    /^\[PHONE_REDACTED\]/i,
    /^\[SSN_REDACTED\]/i,
    /^\[CARD_REDACTED\]/i,
    /^\[NAME_REDACTED\]/i,
    /^\[IP_REDACTED\]/i,
    /@anonymous\.local$/i,
  ];

  return anonymizedPatterns.some(pattern => pattern.test(value));
}

/**
 * Hash a value for audit purposes (one-way, non-reversible)
 * Used for preserving audit hashes while removing PII
 */
export function hashForAudit(value: string, salt?: string): string {
  if (!value) {
    return '';
  }

  const hashInput = salt ? `${value}:${salt}` : value;
  return crypto.createHash('sha256').update(hashInput).digest('hex');
}

