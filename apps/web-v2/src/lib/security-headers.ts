/**
 * Web-v2 security headers — ACTIVATE-1 PR379A.
 *
 * Mirrors apps/web/security-headers.mjs (the canonical pattern shipped
 * earlier as SEC-HEADERS-1) but scoped to the web-v2 sandbox. Used by
 * apps/web-v2/next.config.ts to wire the headers into every response
 * AND by the lockdown test at apps/web-v2/src/__tests__/security-headers.test.ts.
 *
 * Truth contract:
 *   - These headers are a NECESSARY defense layer; NOT sufficient on
 *     their own. Server-side validation, output encoding, CSRF, and
 *     authn/authz remain required (see apps/web-v2 middleware.ts +
 *     clerkConfig.ts from PR #310).
 *   - The CSP allows 'unsafe-inline' for styles (Next inlines critical
 *     CSS) and 'unsafe-inline'/'unsafe-eval' for scripts (React 19 +
 *     Next 15 RSC, Clerk runtime). Strict-CSP-with-nonces is a
 *     follow-up after Next 15 RSC nonce support stabilizes.
 *   - frame-ancestors 'none' is enforced via CSP AND duplicated via
 *     X-Frame-Options: DENY for legacy verifier compatibility.
 *
 * Differences from apps/web:
 *   - No Stripe / PostHog / Sentry allow-lists (web-v2 doesn't load
 *     those vendors yet — adding them would be a security regression
 *     until those integrations actually exist).
 *   - Connect-src only allows Clerk + self.
 */

const SELF = "'self'";
const CLERK_HOSTS = 'https://*.clerk.accounts.dev https://*.clerk.com';

const cspDirectives = [
  `default-src ${SELF}`,
  `script-src ${SELF} 'unsafe-inline' 'unsafe-eval' ${CLERK_HOSTS}`,
  `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src ${SELF} data: https://fonts.gstatic.com`,
  `img-src ${SELF} data: blob: https:`,
  `connect-src ${SELF} ${CLERK_HOSTS}`,
  `frame-src ${CLERK_HOSTS}`,
  `frame-ancestors 'none'`,
  `form-action ${SELF}`,
  `base-uri ${SELF}`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
];

const permissionsDirectives = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
  'interest-cohort=()',
];

export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

export const securityHeaders: readonly SecurityHeader[] = Object.freeze([
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: permissionsDirectives.join(', '),
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
]);

export function getSecurityHeadersForNext(): SecurityHeader[] {
  return securityHeaders.map((h) => ({ key: h.key, value: h.value }));
}
