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
