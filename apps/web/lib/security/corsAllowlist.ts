// ALLOWED_CORS_ORIGINS: comma-separated list of allowed origins for /api/* routes.
// Defaults to an empty list — nothing is allowed unless explicitly set.
// Example: https://app.vitalcv.com,https://staging.vitalcv.com
export function getAllowedOrigins(): readonly string[] {
  const raw = process.env.ALLOWED_CORS_ORIGINS ?? '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export type CorsCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'origin_not_in_allowlist' | 'no_origin_header' | 'allowlist_empty' };

export function checkCorsAllowlist(
  origin: string | null,
  allowedOrigins: readonly string[],
): CorsCheckResult {
  if (!origin) return { allowed: false, reason: 'no_origin_header' };
  if (allowedOrigins.length === 0) return { allowed: false, reason: 'allowlist_empty' };
  if (allowedOrigins.includes(origin)) return { allowed: true };
  return { allowed: false, reason: 'origin_not_in_allowlist' };
}
