/**
 * sentryScrub — M5-1 PII scrubbing for Sentry events.
 *
 * Sentry receives errors + traces from the whole app; without scrubbing, request
 * bodies, headers, cookies, and message strings can carry PII (emails, NPIs,
 * clerk ids, auth tokens). This `beforeSend` hook redacts them before an event
 * leaves the process. NECESSARY, not sufficient — pair with `sendDefaultPii:false`.
 */

type SentryEvent = Record<string, any>;

const REDACTED = '[redacted]';

// PII/PII-ish patterns redacted anywhere in free text.
const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /(?<!\d)\d{10}(?!\d)/g, // bare 10-digit NPI
  /\bBearer\s+[A-Za-z0-9._-]+/gi, // bearer tokens
];

// Header / cookie / context keys whose values are dropped entirely.
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-clerk-user-id',
  'x-clerk-user-email',
  'x-org-id',
  'x-user-role',
  'x-verifier-role',
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
]);

function scrubString(value: string): string {
  let out = value;
  for (const re of PII_PATTERNS) out = out.replace(re, REDACTED);
  return out;
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** Sentry `beforeSend` / `beforeSendTransaction` hook. Returns a scrubbed event. */
export function scrubEvent<T extends SentryEvent>(event: T): T {
  // Never attach identifiable user data beyond a scrubbed id.
  if (event.user) {
    event.user = { id: event.user.id ? String(event.user.id) : undefined };
  }
  if (event.request) {
    if (event.request.cookies) event.request.cookies = REDACTED;
    if (event.request.headers) event.request.headers = scrubValue(event.request.headers);
    if (event.request.data) event.request.data = scrubValue(event.request.data);
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => scrubValue(b));
  }
  // Scrub exception + message text.
  if (event.message) event.message = scrubString(String(event.message));
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(String(ex.value));
    }
  }
  return event;
}
