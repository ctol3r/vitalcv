/**
 * SEC-HEADERS-1 — strict response-header baseline for VitalCV web.
 *
 * Single source of truth for security headers, importable from both
 * `next.config.mjs` (which configures the headers at the framework
 * level) and the vitest assertion at
 * `apps/web/__tests__/security-headers.test.ts` (which proves the
 * required headers are present).
 *
 * Truth contract:
 *   - These headers are a NECESSARY defense layer; they are NOT
 *     sufficient on their own. Server-side input validation, output
 *     encoding, CSRF protection, and authn/authz remain required.
 *   - The CSP intentionally allows `'unsafe-inline'` for styles
 *     (Next.js inlines critical CSS) and `'unsafe-inline'`/`'unsafe-eval'`
 *     for scripts (React 19 + Next 15 RSC payloads, Clerk runtime).
 *     A strict-CSP migration with nonces is tracked separately.
 *   - The Permissions-Policy disables sensors/peripherals not used by
 *     VitalCV. Stripe Checkout uses `payment=(self ...)` and is
 *     allow-listed by domain.
 *
 * Notes for future hardening:
 *   - Add `Cross-Origin-Opener-Policy: same-origin` once OAuth popup
 *     callbacks are confirmed cross-origin-isolated.
 *   - Migrate CSP `script-src 'unsafe-inline' 'unsafe-eval'` to nonces
 *     after Next 15 RSC nonce support stabilizes.
 *   - Consider `Cross-Origin-Embedder-Policy: require-corp` once all
 *     CDN assets ship CORP headers.
 */

const STRIPE_HOSTS = "'self' https://js.stripe.com https://checkout.stripe.com";
const VERCEL_LIVE_HOSTS = "'self' https://vercel.live";
const SELF = "'self'";

const cspDirectives = [
  `default-src ${SELF}`,
  `script-src ${SELF} 'unsafe-inline' 'unsafe-eval' ${STRIPE_HOSTS} ${VERCEL_LIVE_HOSTS} https://*.clerk.accounts.dev https://*.clerk.com`,
  `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src ${SELF} data: https://fonts.gstatic.com`,
  `img-src ${SELF} data: blob: https:`,
  `connect-src ${SELF} https://*.clerk.accounts.dev https://*.clerk.com https://api.stripe.com https://*.ingest.sentry.io wss://*.vitalcv.com`,
  `frame-src ${STRIPE_HOSTS} https://*.clerk.accounts.dev`,
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
  'payment=(self "https://js.stripe.com" "https://checkout.stripe.com")',
  'usb=()',
  'interest-cohort=()',
];

export const securityHeaders = Object.freeze([
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

export function getSecurityHeadersForNext() {
  return securityHeaders.map((h) => ({ key: h.key, value: h.value }));
}
