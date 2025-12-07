/**
 * B162A-USER-010: Sanitize user-supplied fields before persistence
 *
 * Provides helpers to aggressively strip HTML/JS payloads, normalize whitespace,
 * and enforce length limits for user-facing text like names and bios.
 */

const HTML_TAG_REGEX = /<[^>]*?>/g;
const SCRIPT_TAG_REGEX = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_REGEX = /\son[a-z]+\s*=\s*(['"]).*?\1/gi;
const JS_PROTOCOL_REGEX = /javascript:/gi;

const MAX_NAME_LENGTH = 120;
const MAX_BIO_LENGTH = 2000;

type SanitizableFields = {
  name?: string | null;
  bio?: string | null;
};

function stripScripts(value: string): string {
  return value
    .replace(SCRIPT_TAG_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JS_PROTOCOL_REGEX, '');
}

function stripHtml(value: string): string {
  return value.replace(HTML_TAG_REGEX, '');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function enforceLength(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function sanitizeText(value: string, maxLength: number): string {
  let sanitized = stripScripts(value);
  sanitized = stripHtml(sanitized);
  sanitized = collapseWhitespace(sanitized);
  sanitized = enforceLength(sanitized, maxLength);
  return sanitized;
}

/**
 * Sanitize user fields before inserting/updating in the database.
 */
export function sanitizeUserFields<T extends SanitizableFields>(fields: T): T {
  const result = { ...fields };

  if (typeof fields.name === 'string') {
    result.name = sanitizeText(fields.name, MAX_NAME_LENGTH) as T['name'];
  }

  if (typeof fields.bio === 'string') {
    result.bio = sanitizeText(fields.bio, MAX_BIO_LENGTH) as T['bio'];
  }

  return result;
}

export const USER_SANITIZATION_LIMITS = {
  name: MAX_NAME_LENGTH,
  bio: MAX_BIO_LENGTH,
};

