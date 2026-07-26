// apps/web/lib/auth/redirect.ts
//
// Post-sign-in redirect target sanitization. The role-resolution interstitial
// reads `redirect_url` from the query and navigates there after minting the
// role cookie; this guards against open-redirects (protocol-relative //host,
// absolute http(s):// URLs, backslash tricks, control chars). Pure + isomorphic
// so it runs in the client interstitial and is unit-testable.

export const DEFAULT_POST_RESOLVE_PATH = '/holder';

/** True if the string contains an ASCII control char (0x00–0x1f or 0x7f). */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Accept only a same-origin absolute path (starts with a single `/`).
 * Anything else falls back to the clinician home.
 */
export function sanitizeInternalPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_POST_RESOLVE_PATH,
): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!raw.startsWith('/')) return fallback; // relative path or absolute URL → reject
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback; // protocol-relative
  if (hasControlChars(raw)) return fallback;
  return raw;
}
