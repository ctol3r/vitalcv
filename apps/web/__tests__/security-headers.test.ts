import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs module without ambient types; runtime import is the contract.
import { securityHeaders, getSecurityHeadersForNext } from '../security-headers.mjs';

/**
 * SEC-HEADERS-1 baseline assertion.
 *
 * Verifies that `apps/web/security-headers.mjs` (the single source of
 * truth wired into `next.config.mjs` `headers()`) emits the expected
 * strict-baseline headers. This is the gate every Wave row that
 * touches the response surface gets measured against.
 *
 * Truth contract:
 *   - This test asserts the configuration. A separate live smoke
 *     (`curl -I https://vitalcv.com/`) verifies the headers are
 *     actually delivered post-deploy.
 *   - Headers are a NECESSARY defense; they are NOT a substitute for
 *     server-side validation, authn/authz, or CSRF protection.
 */
describe('security headers (SEC-HEADERS-1)', () => {
  it('emits Strict-Transport-Security with HSTS preload', () => {
    const hsts = securityHeaders.find((h: { key: string }) => h.key === 'Strict-Transport-Security');
    expect(hsts).toBeDefined();
    expect(hsts!.value).toMatch(/max-age=63072000/);
    expect(hsts!.value).toContain('includeSubDomains');
    expect(hsts!.value).toContain('preload');
  });

  it('emits X-Frame-Options: DENY (clickjacking baseline)', () => {
    const xfo = securityHeaders.find((h: { key: string }) => h.key === 'X-Frame-Options');
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe('DENY');
  });

  it('emits X-Content-Type-Options: nosniff', () => {
    const xcto = securityHeaders.find((h: { key: string }) => h.key === 'X-Content-Type-Options');
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe('nosniff');
  });

  it('emits Referrer-Policy: strict-origin-when-cross-origin', () => {
    const rp = securityHeaders.find((h: { key: string }) => h.key === 'Referrer-Policy');
    expect(rp).toBeDefined();
    expect(rp!.value).toBe('strict-origin-when-cross-origin');
  });

  it('emits Permissions-Policy disabling unused sensors', () => {
    const pp = securityHeaders.find((h: { key: string }) => h.key === 'Permissions-Policy');
    expect(pp).toBeDefined();
    expect(pp!.value).toContain('camera=()');
    expect(pp!.value).toContain('microphone=()');
    expect(pp!.value).toContain('geolocation=()');
    expect(pp!.value).toContain('usb=()');
    // Stripe Checkout requires payment-request — must be allow-listed by domain.
    expect(pp!.value).toContain('payment=(self "https://js.stripe.com"');
  });

  it('emits Content-Security-Policy with frame-ancestors none', () => {
    const csp = securityHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
    expect(csp!.value).toContain("frame-ancestors 'none'");
    expect(csp!.value).toContain("object-src 'none'");
    expect(csp!.value).toContain("base-uri 'self'");
    expect(csp!.value).toContain("form-action 'self'");
    expect(csp!.value).toContain('upgrade-insecure-requests');
  });

  it('CSP allows Stripe + Clerk domains required for the auth/checkout flow', () => {
    const csp = securityHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(csp!.value).toContain('https://js.stripe.com');
    expect(csp!.value).toContain('https://*.clerk.com');
  });

  // Production sign-in regression guard: the pk_live Frontend API is the custom
  // domain clerk.vitalcv.com, which does NOT match *.clerk.com. It must be in
  // BOTH script-src and connect-src (ClerkJS + its FAPI/XHR/WebSocket), plus a
  // worker-src for ClerkJS's blob worker, or sign-in silently breaks.
  it('CSP allows the production Clerk custom domain in script-src, connect-src, and a worker-src', () => {
    const csp = securityHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    const value = csp!.value;
    const scriptSrc = value.match(/script-src[^;]*/)![0];
    const connectSrc = value.match(/connect-src[^;]*/)![0];
    expect(scriptSrc).toContain('https://clerk.vitalcv.com');
    expect(connectSrc).toContain('https://clerk.vitalcv.com');
    expect(value).toContain('worker-src');
    expect(value).toContain('blob:');
    // Clerk's default bot check (Cloudflare Turnstile).
    expect(scriptSrc).toContain('https://challenges.cloudflare.com');
  });

  // Hotfix wave-3m: PostHog ingestion + assets must be allow-listed in
  // both script-src (for posthog-js bundle load) and connect-src (for
  // event POSTs). Without these, analytics fail silently in production.
  it('CSP includes the two PostHog origins in both script-src and connect-src', () => {
    const csp = securityHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    const value = csp!.value;

    const scriptSrcMatch = value.match(/script-src[^;]*/);
    const connectSrcMatch = value.match(/connect-src[^;]*/);
    expect(scriptSrcMatch).not.toBeNull();
    expect(connectSrcMatch).not.toBeNull();

    for (const origin of ['https://us.i.posthog.com', 'https://us-assets.i.posthog.com']) {
      expect(scriptSrcMatch![0], `script-src must include ${origin}`).toContain(origin);
      expect(connectSrcMatch![0], `connect-src must include ${origin}`).toContain(origin);
    }
  });

  it('CSP does NOT include localhost or wildcard public origins', () => {
    const csp = securityHeaders.find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(csp!.value).not.toContain('http://localhost');
    expect(csp!.value).not.toMatch(/\* \*/);
  });

  it('getSecurityHeadersForNext returns a plain mutable array (Next.js requirement)', () => {
    const headers = getSecurityHeadersForNext();
    expect(Array.isArray(headers)).toBe(true);
    // Must be a fresh array each call (Next.js may mutate during config processing)
    expect(headers).not.toBe(securityHeaders);
    expect(headers.length).toBe(securityHeaders.length);
  });
});

/**
 * X-Powered-By is removed by CONFIG, not by a header entry.
 *
 * `headers()` can only ADD headers; it cannot delete one Next sets itself. So
 * this asserts `poweredByHeader: false` in the resolved config — the thing
 * that actually suppresses the header — rather than looking for an absence in
 * `securityHeaders`, where it was never going to appear either way. Asserting
 * an absence in the wrong place is how a guard stays green while the header
 * still ships: production served `x-powered-by: Next.js` under this very
 * suite, on every response, for the whole life of the file.
 */
describe('X-Powered-By is suppressed at the framework level', () => {
  it('sets poweredByHeader: false in next.config.mjs', async () => {
    const mod = await import('../next.config.mjs');
    const config = (mod.default ?? mod) as { poweredByHeader?: boolean };
    expect(config.poweredByHeader).toBe(false);
  });

  it('does not attempt the removal via the headers() list, which cannot work', () => {
    const powered = securityHeaders.find(
      (h: { key: string }) => h.key.toLowerCase() === 'x-powered-by',
    );
    expect(powered).toBeUndefined();
  });
});

/**
 * Sentry ingest must be reachable from the BROWSER.
 *
 * This asserts the closure — "a real region-scoped DSN host is permitted by
 * connect-src" — rather than the mechanism, "the string *.ingest.sentry.io
 * appears". The distinction is the whole defect: that string WAS present, and
 * the browser still blocked every event, because Sentry's current DSNs resolve
 * to o<orgId>.ingest.<region>.sentry.io and the CSP wildcard only matches names
 * ending in ".ingest.sentry.io".
 *
 * It failed silently in both directions a reader would check:
 *   - /api/health reported sentry:true, because that flag only reads whether
 *     NEXT_PUBLIC_SENTRY_DSN is SET, not whether events can leave the page;
 *   - server-side events arrived normally, because CSP does not apply to
 *     server-to-server requests. Only the browser half was dark.
 *
 * Measured against the live production header on 2026-08-11.
 */
describe('CSP permits Sentry ingest from the browser', () => {
  const connectSrc = () => {
    const csp = securityHeaders.find(
      (h: { key: string }) => h.key.toLowerCase() === 'content-security-policy',
    ) as { value: string } | undefined;
    const directive = csp?.value
      .split(';')
      .map((d: string) => d.trim())
      .find((d: string) => d.startsWith('connect-src '));
    return (directive ?? '').split(/\s+/).slice(1);
  };

  /** CSP host-source matching: "*.a.b" matches only names ending in ".a.b". */
  const permits = (sources: string[], url: string) => {
    const host = new URL(url).host;
    return sources.some((src) => {
      const bare = src.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (bare.startsWith('*.')) return host.endsWith(bare.slice(1));
      return host === bare;
    });
  };

  it('permits a region-scoped DSN host (the shape Sentry issues today)', () => {
    expect(
      permits(connectSrc(), 'https://o4511892657143808.ingest.us.sentry.io/4511892679557120'),
    ).toBe(true);
  });

  it('still permits the legacy non-region ingest host', () => {
    expect(permits(connectSrc(), 'https://o123.ingest.sentry.io/456')).toBe(true);
  });

  it('does not blanket-allow unrelated sentry.io hosts', () => {
    expect(permits(connectSrc(), 'https://evil.sentry.io/1')).toBe(false);
  });
});
