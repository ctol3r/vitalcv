/**
 * observability — canonical Sentry PII scrubbing for every VitalCV process.
 *
 * Sentry receives errors + traces from web, edge, and the backend API; without
 * scrubbing, request bodies, headers, cookies, URLs, and message strings can
 * carry PII (emails, NPIs, clerk ids, auth tokens). `scrubEvent` is the
 * `beforeSend` hook that redacts them before an event leaves the process.
 * NECESSARY, not sufficient — always pair with `sendDefaultPii: false`.
 *
 * This lives in `@vitalcv/shared` on purpose: this is a healthcare-adjacent
 * product and the redaction list is the review artifact. One list, reviewed
 * once, applied everywhere. A per-app copy would drift silently, and the drift
 * would be invisible until it showed up in a Sentry payload.
 *
 * Documented in `docs/ops/observability.md`.
 */

type SentryEvent = Record<string, any>;

const REDACTED = '[redacted]';

// PII/PII-ish patterns redacted anywhere in free text.
const PII_PATTERNS: ReadonlyArray<RegExp> = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /(?<!\d)\d{10}(?!\d)/g, // bare 10-digit NPI (also catches unix-second stamps — over-redaction is the safe failure)
  /\bBearer\s+[A-Za-z0-9._-]+/gi, // bearer tokens
];

// Header / cookie / context keys whose values are dropped entirely.
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
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

/** The redaction list, exported so tests and docs can assert against one source. */
export const SENTRY_SENSITIVE_KEYS: ReadonlyArray<string> = Object.freeze([...SENSITIVE_KEYS]);

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

/**
 * Sentry `beforeSend` / `beforeSendTransaction` hook. Returns a scrubbed event.
 *
 * Typed loosely (Sentry's event shapes vary by SDK version); returns `any` so it
 * drops into `beforeSend` on node/server/client/edge without a version-coupled
 * import.
 */
export function scrubEvent(event: SentryEvent): any {
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
    // The API routes NPIs in the path (`/api/passport/1234567890`), so the URL
    // is a first-class PII carrier on the backend — not just a label.
    if (typeof event.request.url === 'string') {
      event.request.url = scrubString(event.request.url);
    }
  }
  // Express transactions are named from the raw path, so they carry NPIs too.
  if (typeof event.transaction === 'string') {
    event.transaction = scrubString(event.transaction);
  }
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (event.tags) event.tags = scrubValue(event.tags) as Record<string, unknown>;
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

/**
 * Release tag for Sentry, resolved from the deploy's commit SHA.
 *
 * Railway injects `RAILWAY_GIT_COMMIT_SHA`; `GIT_SHA` is the Dockerfile
 * build-arg fallback (see `apps/web/Dockerfile`). Returns `undefined` rather
 * than a placeholder when the SHA is unknown — an honest missing release beats
 * a fake one that silently groups every deploy together.
 */
export function resolveSentryRelease(
  // Browser-safe default: this module is also bundled into the web client, where
  // `process` may be absent entirely.
  env: Record<string, string | undefined> = typeof process === 'undefined' ? {} : process.env,
): string | undefined {
  const sha = env.RAILWAY_GIT_COMMIT_SHA || env.GIT_SHA || env.VERCEL_GIT_COMMIT_SHA;
  return sha && sha.trim() ? sha.trim() : undefined;
}
