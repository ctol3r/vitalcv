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

// Hotfix wave-3m: PostHog ingestion + asset hosts. The web app loads
// posthog-js from the API host and POSTs telemetry to it; both must be
// allow-listed in script-src and connect-src or the analytics SDK fails
// silently with no console error.
const POSTHOG_INGESTION = 'https://us.i.posthog.com';
const POSTHOG_ASSETS = 'https://us-assets.i.posthog.com';

// Clerk auth hosts. In production the pk_live key resolves to the custom
// Frontend API domain clerk.vitalcv.com, which matches NEITHER *.clerk.accounts.dev
// NOR *.clerk.com (the latter requires "clerk" as the FIRST label — here it's a
// subdomain of vitalcv.com). Omitting it makes the browser block ClerkJS and its
// FAPI calls, so sign-in cannot run at all. Keep the dev/accounts wildcards too.
const CLERK_HOSTS =
  'https://*.clerk.accounts.dev https://*.clerk.com https://clerk.vitalcv.com';
// Clerk's bot protection (Cloudflare Turnstile) is enabled by default for pk_live
// and loads a script + iframe from this host.
const TURNSTILE_HOST = 'https://challenges.cloudflare.com';

// Sentry ingest. Region-scoped DSNs — the default for orgs created on the current
// Sentry — resolve to o<orgId>.ingest.<region>.sentry.io, e.g.
// o…​.ingest.us.sentry.io. That host does NOT match https://*.ingest.sentry.io: the
// CSP host wildcard matches only names ending in ".ingest.sentry.io", and the region
// label makes this a subdomain of us.sentry.io instead. Exactly the Clerk
// custom-domain shape above, and it fails the same silent way — the browser blocks
// every client-side event while /api/health still reports sentry:true, because that
// flag only reads whether the DSN is set. Server-side events are unaffected (no CSP
// on server-to-server), so the gap is invisible unless you check the browser.
// Measured 2026-08-11 against the live header. Legacy host kept for older DSNs.
const SENTRY_INGEST =
  'https://*.ingest.sentry.io https://*.ingest.us.sentry.io';

const cspDirectives = [
  `default-src ${SELF}`,
  `script-src ${SELF} 'unsafe-inline' 'unsafe-eval' ${STRIPE_HOSTS} ${VERCEL_LIVE_HOSTS} ${CLERK_HOSTS} ${TURNSTILE_HOST} ${POSTHOG_INGESTION} ${POSTHOG_ASSETS}`,
  `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src ${SELF} data: https://fonts.gstatic.com`,
  `img-src ${SELF} data: blob: https:`,
  `connect-src ${SELF} ${CLERK_HOSTS} https://api.stripe.com ${SENTRY_INGEST} wss://*.vitalcv.com ${POSTHOG_INGESTION} ${POSTHOG_ASSETS}`,
  `frame-src ${STRIPE_HOSTS} https://*.clerk.accounts.dev https://clerk.vitalcv.com ${TURNSTILE_HOST}`,
  // ClerkJS runs part of its runtime in a Web Worker created from a blob: URL;
  // without this it falls back to default-src 'self' and the worker is blocked.
  `worker-src ${SELF} blob:`,
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
