/**
 * ACTIVATE-1 PR379A — web-v2 security headers lockdown.
 *
 * Pins the headers list + CSP directives + the next.config.ts wiring
 * against drift. If any of the required security headers is removed
 * or the CSP loses a critical directive, this test fails.
 *
 * Doctrine link: mirrors apps/web/__tests__/security-headers.test.ts
 * (the SEC-HEADERS-1 lockdown) but for the web-v2 sandbox surface.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { securityHeaders, getSecurityHeadersForNext } from '../lib/security-headers';

const NEXT_CONFIG = readFileSync(
  resolve(__dirname, '../../next.config.ts'),
  'utf8',
);
const HEADERS_SRC = readFileSync(
  resolve(__dirname, '../lib/security-headers.ts'),
  'utf8',
);

function findHeader(key: string): string | undefined {
  return securityHeaders.find((h) => h.key === key)?.value;
}

describe('ACTIVATE-1 PR379A — required headers are present', () => {
  it('Strict-Transport-Security with preload + 2y max-age', () => {
    const v = findHeader('Strict-Transport-Security');
    expect(v).toBeDefined();
    expect(v).toContain('max-age=63072000');
    expect(v).toContain('includeSubDomains');
    expect(v).toContain('preload');
  });

  it('X-Content-Type-Options: nosniff', () => {
    expect(findHeader('X-Content-Type-Options')).toBe('nosniff');
  });

  it('X-Frame-Options: DENY (defense-in-depth alongside CSP frame-ancestors)', () => {
    expect(findHeader('X-Frame-Options')).toBe('DENY');
  });

  it('Referrer-Policy: strict-origin-when-cross-origin', () => {
    expect(findHeader('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('Permissions-Policy disables high-risk surfaces', () => {
    const v = findHeader('Permissions-Policy');
    expect(v).toBeDefined();
    for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
      expect(v).toContain(directive);
    }
  });

  it('Content-Security-Policy is present and parses', () => {
    const v = findHeader('Content-Security-Policy');
    expect(v).toBeDefined();
  });
});

describe('ACTIVATE-1 PR379A — CSP directives', () => {
  const csp = findHeader('Content-Security-Policy') ?? '';
  const directives = new Map<string, string>();
  for (const part of csp.split(';').map((p) => p.trim()).filter(Boolean)) {
    const space = part.indexOf(' ');
    if (space === -1) {
      directives.set(part, '');
    } else {
      directives.set(part.slice(0, space), part.slice(space + 1));
    }
  }

  it('default-src is self only', () => {
    expect(directives.get('default-src')).toBe("'self'");
  });

  it("frame-ancestors is 'none' (clickjacking defense)", () => {
    expect(directives.get('frame-ancestors')).toBe("'none'");
  });

  it("object-src is 'none' (legacy plugin defense)", () => {
    expect(directives.get('object-src')).toBe("'none'");
  });

  it("form-action is restricted to 'self'", () => {
    expect(directives.get('form-action')).toBe("'self'");
  });

  it("base-uri is restricted to 'self' (base-tag injection defense)", () => {
    expect(directives.get('base-uri')).toBe("'self'");
  });

  it('upgrade-insecure-requests is enabled', () => {
    expect(directives.has('upgrade-insecure-requests')).toBe(true);
  });

  it('script-src allows Clerk hosts (Clerk widget needs them)', () => {
    const v = directives.get('script-src') ?? '';
    expect(v).toContain('https://*.clerk.accounts.dev');
    expect(v).toContain('https://*.clerk.com');
  });

  it('script-src does NOT allow http: schemes (no plaintext script sources)', () => {
    const v = directives.get('script-src') ?? '';
    expect(v).not.toMatch(/\bhttp:\/\//);
  });

  it('connect-src allows Clerk + self only (no third-party telemetry yet)', () => {
    const v = directives.get('connect-src') ?? '';
    expect(v).toContain("'self'");
    expect(v).toContain('https://*.clerk.com');
    // Web-v2 has no Sentry/PostHog/Stripe wiring; if those land,
    // update both the CSP AND this test in the same PR.
    expect(v).not.toContain('sentry.io');
    expect(v).not.toContain('posthog.com');
  });
});

describe('ACTIVATE-1 PR379A — next.config.ts wiring', () => {
  it('imports getSecurityHeadersForNext from the local module', () => {
    expect(NEXT_CONFIG).toContain("from './src/lib/security-headers'");
    expect(NEXT_CONFIG).toContain('getSecurityHeadersForNext');
  });

  it('declares async headers() function on the nextConfig', () => {
    expect(NEXT_CONFIG).toMatch(/async\s+headers\(\)/);
  });

  it('applies headers to every route (source: /(.*) )', () => {
    expect(NEXT_CONFIG).toMatch(/source:\s*['"]\/\(\.\*\)['"]/);
  });
});

describe('ACTIVATE-1 PR379A — frozen output + helper', () => {
  it('securityHeaders array is frozen', () => {
    expect(Object.isFrozen(securityHeaders)).toBe(true);
  });

  it('getSecurityHeadersForNext returns a fresh copy (not the frozen original)', () => {
    const a = getSecurityHeadersForNext();
    const b = getSecurityHeadersForNext();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('helper output is shaped for Next.js headers() consumption', () => {
    const out = getSecurityHeadersForNext();
    for (const entry of out) {
      expect(typeof entry.key).toBe('string');
      expect(typeof entry.value).toBe('string');
      expect(entry.key.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });
});

describe('ACTIVATE-1 PR379A — source-level pins', () => {
  it('HSTS uses preload (no production rollback path)', () => {
    expect(HEADERS_SRC).toContain('preload');
  });

  it('no localhost / 127.0.0.1 baked into the CSP', () => {
    expect(HEADERS_SRC).not.toMatch(/localhost/);
    expect(HEADERS_SRC).not.toMatch(/127\.0\.0\.1/);
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(HEADERS_SRC).not.toContain(phrase);
    }
  });
});
