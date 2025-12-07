/**
 * Security sanitization utilities for SSR and user-controlled input
 *
 * This module provides centralized sanitization functions to prevent XSS
 * and other injection attacks when rendering user-controlled data in SSR contexts.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML context
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return '';

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return String(str).replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Escapes JavaScript string literals
 *
 * @param str - String to escape
 * @returns Escaped string safe for JavaScript context
 */
export function escapeJs(str: string | null | undefined): string {
  if (str == null) return '';

  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Sanitizes a string for use in HTML attributes
 *
 * @param str - String to sanitize
 * @returns Sanitized string safe for HTML attributes
 */
export function sanitizeAttribute(str: string | null | undefined): string {
  if (str == null) return '';

  return escapeHtml(String(str))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes a URL to prevent javascript: and data: protocol attacks
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';

  const trimmed = String(url).trim();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = trimmed.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }

  // Allow http, https, mailto, tel, and relative URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }

  // Default to empty for unknown protocols
  return '';
}

/**
 * Sanitizes an object by recursively escaping string values
 * Useful for sanitizing props before passing to SSR components
 *
 * @param obj - Object to sanitize
 * @param deep - Whether to recursively sanitize nested objects
 * @returns Sanitized object
 */
export function sanitizeObject<T>(obj: T, deep: boolean = true): T {
  if (obj == null) return obj;

  if (typeof obj === 'string') {
    return escapeHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      deep ? sanitizeObject(item, deep) : item
    ) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = deep ? sanitizeObject(value, deep) : value;
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Validates and sanitizes user input for SSR components
 *
 * @param input - User input to validate
 * @param options - Validation options
 * @returns Sanitized input or throws error if invalid
 */
export function validateAndSanitize(
  input: unknown,
  options: {
    maxLength?: number;
    allowedChars?: RegExp;
    required?: boolean;
  } = {}
): string {
  const { maxLength = 10000, allowedChars, required = false } = options;

  if (input == null) {
    if (required) {
      throw new Error('Input is required');
    }
    return '';
  }

  const str = String(input);

  if (str.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength}`);
  }

  if (allowedChars && !allowedChars.test(str)) {
    throw new Error('Input contains invalid characters');
  }

  return escapeHtml(str);
}

/**
 * Type guard to check if a value is safe for SSR rendering
 *
 * @param value - Value to check
 * @returns True if value is safe for SSR
 */
export function isSafeForSSR(value: unknown): boolean {
  if (value == null) return true;

  const type = typeof value;

  // Safe primitive types
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }

  // Safe arrays (if all elements are safe)
  if (Array.isArray(value)) {
    return value.every(isSafeForSSR);
  }

  // Safe objects (if all values are safe)
  if (type === 'object') {
    return Object.values(value).every(isSafeForSSR);
  }

  // Functions and other types are not safe
  return false;
}

