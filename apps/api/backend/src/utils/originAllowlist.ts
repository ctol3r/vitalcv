/**
 * originAllowlist.ts — Canonical origin normalization and allowlist utility.
 *
 * Eliminates origin ambiguity across:
 *   - apex vs www (vitalcv.com ↔ www.vitalcv.com)
 *   - trailing slashes (https://vitalcv.com/ → https://vitalcv.com)
 *   - protocol mismatches (http:// rejected in production)
 *   - Vercel preview domains (*.vercel.app pattern-matched)
 *   - localhost (dev/test only — never production)
 *
 * Every rejection is logged with a structured envelope.
 * Every acceptance is traceable to a specific allowlist rule.
 */

import { log } from '../obs/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OriginVerdict =
  | { allowed: true;  origin: string; rule: AllowRule }
  | { allowed: false; origin: string; reason: RejectReason };

export type AllowRule =
  | 'apex'
  | 'www_apex'
  | 'exact_match'
  | 'vercel_preview'
  | 'localhost_dev';

export type RejectReason =
  | 'null_origin'
  | 'parse_error'
  | 'http_in_production'
  | 'localhost_in_production'
  | 'not_in_allowlist'
  | 'vercel_preview_in_production';

export interface OriginAllowlistOptions {
  /** Explicit origin strings (parsed from CORS_ORIGIN env). */
  explicit: string[];
  /** Allow http:// in addition to https:// (dev/test only). */
  allowInsecure?: boolean;
  /** Allow localhost:* origins (dev/test only). */
  allowLocalhost?: boolean;
  /** Allow *.vercel.app preview deployments. */
  allowVercelPreview?: boolean;
  /** Current environment — governs localhost + vercel-preview gates. */
  env: 'development' | 'production' | 'test';
}

// ─── normalizeOrigin ──────────────────────────────────────────────────────────

/**
 * Canonicalizes a raw origin string:
 *   - Strips trailing slash
 *   - Lowercases scheme and host
 *   - Strips default ports (80, 443)
 *   - Returns null if unparseable or the value is "null" / empty
 */
export function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw || raw === 'null') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const scheme = url.protocol.toLowerCase(); // 'https:'
    const host   = url.hostname.toLowerCase();

    // Strip default ports
    const portStr = url.port;
    const isDefaultPort =
      (scheme === 'https:' && portStr === '443') ||
      (scheme === 'http:'  && portStr === '80');
    const port = portStr && !isDefaultPort ? `:${portStr}` : '';

    return `${scheme}//${host}${port}`;
  } catch {
    return null;
  }
}

// ─── apex equivalence ─────────────────────────────────────────────────────────

/**
 * Returns the canonical apex (no-www) for a normalized origin.
 * https://www.vitalcv.com → https://vitalcv.com
 * https://vitalcv.com    → https://vitalcv.com (unchanged)
 */
function apexOf(normalized: string): string {
  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, '');
    const portStr = url.port;
    const port = portStr ? `:${portStr}` : '';
    return `${url.protocol}//${host}${port}`;
  } catch {
    return normalized;
  }
}

/**
 * Returns the www variant for a normalized origin.
 * https://vitalcv.com → https://www.vitalcv.com
 */
function wwwOf(normalized: string): string {
  try {
    const url = new URL(normalized);
    if (url.hostname.startsWith('www.')) return normalized;
    const portStr = url.port;
    const port = portStr ? `:${portStr}` : '';
    return `${url.protocol}//www.${url.hostname}${port}`;
  } catch {
    return normalized;
  }
}

// ─── isVercelPreview ──────────────────────────────────────────────────────────

/**
 * Returns true if origin matches *.vercel.app or *.vitalcv.vercel.app.
 * Rejects in production unless explicitly opted in.
 */
function isVercelPreview(normalized: string): boolean {
  try {
    const { hostname, protocol } = new URL(normalized);
    return protocol === 'https:' && (
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.vitalcv-ui.vercel.app')
    );
  } catch {
    return false;
  }
}

// ─── isLocalhost ──────────────────────────────────────────────────────────────

function isLocalhost(normalized: string): boolean {
  try {
    const { hostname } = new URL(normalized);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

// ─── checkOrigin ─────────────────────────────────────────────────────────────

/**
 * Canonical allowlist check. Returns a structured verdict.
 * Never throws.
 */
export function checkOrigin(
  rawOrigin: string | undefined | null,
  opts: OriginAllowlistOptions,
): OriginVerdict {
  const normalized = normalizeOrigin(rawOrigin);

  if (!normalized) {
    return { allowed: false, origin: rawOrigin ?? '(empty)', reason: 'null_origin' };
  }

  const isHttp = normalized.startsWith('http://');
  const isProd = opts.env === 'production';

  // ── Localhost gate (checked first — more specific rejection reason) ────────────────────────────────────────────────────────
  if (isLocalhost(normalized)) {
    if (opts.allowLocalhost) {
      return { allowed: true, origin: normalized, rule: 'localhost_dev' };
    }
    return { allowed: false, origin: normalized, reason: 'localhost_in_production' };
  }

  // ── Protocol gate ─────────────────────────────────────────────
  if (isHttp && !opts.allowInsecure) {
    return { allowed: false, origin: normalized, reason: 'http_in_production' };
  }

  // ── Vercel preview gate ───────────────────────────────────────────────────
  if (isVercelPreview(normalized)) {
    if (opts.allowVercelPreview && !isProd) {
      return { allowed: true, origin: normalized, rule: 'vercel_preview' };
    }
    // In production, Vercel previews must be in the explicit allowlist
    if (!isProd && opts.allowVercelPreview) {
      return { allowed: true, origin: normalized, rule: 'vercel_preview' };
    }
    // Fall through to explicit check — production previews can be explicitly listed
  }

  // ── Explicit allowlist (with apex/www equivalence) ────────────────────────
  for (const raw of opts.explicit) {
    const allowed = normalizeOrigin(raw);
    if (!allowed) continue;

    // Exact match
    if (normalized === allowed) {
      return { allowed: true, origin: normalized, rule: 'exact_match' };
    }

    // Apex equivalence: requested www.X, listed X
    if (normalized === wwwOf(allowed)) {
      return { allowed: true, origin: normalized, rule: 'www_apex' };
    }

    // Apex equivalence: requested X, listed www.X
    if (normalized === apexOf(allowed)) {
      return { allowed: true, origin: normalized, rule: 'apex' };
    }
  }

  // ── Vercel preview in production: only if explicitly listed above ─────────
  if (isVercelPreview(normalized) && isProd) {
    return { allowed: false, origin: normalized, reason: 'vercel_preview_in_production' };
  }

  return { allowed: false, origin: normalized, reason: 'not_in_allowlist' };
}

// ─── buildCorsOriginCallback ──────────────────────────────────────────────────

/**
 * Returns a cors() origin callback that:
 *   - Accepts all origins when allowlist is '*' (dev/wildcard mode)
 *   - Uses checkOrigin() for structured evaluation in all other cases
 *   - Logs every rejection with structured context
 *   - Never throws — cors lib expects callback(err, bool)
 */
export function buildCorsOriginCallback(
  allowlistStr: string,
  nodeEnv: 'development' | 'production' | 'test',
): (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void {
  const isWildcard = allowlistStr.trim() === '*';

  if (isWildcard) {
    // Wildcard: accept everything (never in production — env.ts blocks this)
    return (_origin, cb) => cb(null, true);
  }

  const explicit = allowlistStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const opts: OriginAllowlistOptions = {
    explicit,
    allowInsecure: nodeEnv !== 'production',
    allowLocalhost: nodeEnv !== 'production',
    allowVercelPreview: true,
    env: nodeEnv,
  };

  return (origin, cb) => {
    // Same-origin or server-to-server requests have no Origin header — always allow
    if (!origin) {
      return cb(null, true);
    }

    const verdict = checkOrigin(origin, opts);

    if (verdict.allowed) {
      return cb(null, true);
    }

    log('warn', 'cors_origin_rejected', {
      origin,
      reason: verdict.reason,
      env: nodeEnv,
    });

    // Return false (blocked) — not an error, just rejected
    return cb(null, false);
  };
}

// ─── Structured 403 envelope ─────────────────────────────────────────────────

/**
 * Standard 403 response body for CORS-rejected requests.
 * Attach to an Express error handler or use directly.
 */
export function corsRejectedEnvelope(origin: string, reason: RejectReason) {
  return {
    error: 'cors_origin_rejected',
    error_description: `Origin '${origin}' is not permitted by this server's CORS policy.`,
    reason,
    docs: 'https://vitalcv.com/.well-known/trust.json',
  };
}
