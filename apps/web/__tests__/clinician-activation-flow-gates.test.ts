/**
 * AUTH-1 PR271A — clinician activation flow gates lockdown.
 *
 * Source-level pins on the gates the consolidated audit
 * (docs/ops/clinician-activation-flow-audit.md) depends on. If any of
 * these regress silently, the audit's verdict is no longer accurate.
 *
 * These are deliberately source-text assertions over apps/web; the
 * full activation flow needs a browser + a configured Clerk instance
 * and cannot be exercised in vitest. The gates this test pins are:
 *
 *   - /holder requires Clerk session.userId; absence redirects to
 *     /sign-in (no anonymous render path).
 *   - middleware uses real clerkMiddleware (not a mock).
 *   - clerkConfig derives CLERK_PROVIDER_ENABLED from env (no hardcode).
 *   - /holder/page.tsx gates on personProfile.npi from /api/me/workspaces
 *     before showing the passport (no synthetic NPI fallback).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

const HOLDER_LAYOUT_SRC = readFileSync(
  resolve(ROOT, 'app/holder/layout.tsx'),
  'utf8',
);
const HOLDER_PAGE_SRC = readFileSync(
  resolve(ROOT, 'app/holder/page.tsx'),
  'utf8',
);
const MIDDLEWARE_SRC = readFileSync(
  resolve(ROOT, 'middleware.ts'),
  'utf8',
);
const CLERK_CONFIG_SRC = readFileSync(
  resolve(ROOT, 'lib/auth/clerkConfig.ts'),
  'utf8',
);

describe('AUTH-1 PR271A — /holder layout requires authenticated Clerk session', () => {
  it('imports auth from @clerk/nextjs/server (real, not mock)', () => {
    expect(HOLDER_LAYOUT_SRC).toContain("from '@clerk/nextjs/server'");
    expect(HOLDER_LAYOUT_SRC).toMatch(/import\s*\{[^}]*\bauth\b/);
  });

  it('awaits a real session and gates on session.userId', () => {
    expect(HOLDER_LAYOUT_SRC).toMatch(/const\s+session\s*=\s*await\s+auth\(\)/);
    expect(HOLDER_LAYOUT_SRC).toMatch(/if\s*\(!\s*session\.userId\)/);
  });

  it('redirects unauthenticated users to /sign-in (no anonymous render path)', () => {
    expect(HOLDER_LAYOUT_SRC).toContain("redirect('/sign-in");
    // Carry the original requested path so post-sign-in lands on the
    // right place.
    expect(HOLDER_LAYOUT_SRC).toContain('redirect_url=');
  });

  it('does NOT silently fall through to a fixture session', () => {
    expect(HOLDER_LAYOUT_SRC).not.toMatch(/fixture|mock|fake|synthetic/i);
  });

  it('passes the real session into loadClinicianMobileData (no anonymous load)', () => {
    expect(HOLDER_LAYOUT_SRC).toContain('loadClinicianMobileData(session)');
  });
});

describe('AUTH-1 PR271A — /holder/page gates on real NPI from /api/me/workspaces', () => {
  it('fetches /api/me/workspaces (not a fixture endpoint)', () => {
    expect(HOLDER_PAGE_SRC).toContain("'/api/me/workspaces'");
  });

  it('gates on personProfile.npi before showing the passport', () => {
    expect(HOLDER_PAGE_SRC).toMatch(/pp\?\.npi/);
    expect(HOLDER_PAGE_SRC).toContain("setPhase('has_npi')");
    expect(HOLDER_PAGE_SRC).toContain("setPhase('no_npi')");
  });

  it('has explicit error phase (no fake "ready" state)', () => {
    expect(HOLDER_PAGE_SRC).toMatch(
      /type\s+Phase\s*=\s*'loading'\s*\|\s*'has_npi'\s*\|\s*'no_npi'\s*\|\s*'error'/,
    );
  });

  it('does NOT hardcode an NPI fallback', () => {
    // No literal 10-digit numeric string assigned to a state setter.
    // DEMO_NPI on HomePageClient is a separate public surface; we
    // pin only that holder/page.tsx itself doesn't carry one.
    expect(HOLDER_PAGE_SRC).not.toMatch(/setNpi\(\s*['"]\d{10}['"]\s*\)/);
  });
});

describe('AUTH-1 PR271A — middleware uses real clerkMiddleware', () => {
  it('imports clerkMiddleware from @clerk/nextjs/server', () => {
    expect(MIDDLEWARE_SRC).toContain("from '@clerk/nextjs/server'");
    expect(MIDDLEWARE_SRC).toMatch(/import\s*\{[^}]*\bclerkMiddleware\b/);
  });

  it('uses createRouteMatcher for public-route allowlist', () => {
    expect(MIDDLEWARE_SRC).toContain('createRouteMatcher');
  });

  it('redirects to /sign-in when session.userId is absent', () => {
    expect(MIDDLEWARE_SRC).toContain('/sign-in');
    expect(MIDDLEWARE_SRC).toMatch(/!\s*session\.userId/);
    expect(MIDDLEWARE_SRC).toContain('NextResponse.redirect');
  });

  it('does NOT contain a "fixture session" / mock auth fallback', () => {
    expect(MIDDLEWARE_SRC).not.toMatch(/vcv_mock_jwt|setTimeout\(\s*800/);
    expect(MIDDLEWARE_SRC).not.toMatch(/anonymous\s+pilot\s+actor/i);
  });
});

describe('AUTH-1 PR271A — clerkConfig derives gates from env', () => {
  it('CLERK_ENABLED derives from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', () => {
    expect(CLERK_CONFIG_SRC).toMatch(
      /CLERK_ENABLED\s*=\s*Boolean\(\s*\n?\s*process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/,
    );
  });

  it('CLERK_PROVIDER_ENABLED equals CLERK_ENABLED (no override)', () => {
    expect(CLERK_CONFIG_SRC).toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*CLERK_ENABLED/);
  });

  it('CLERK_PRODUCTION_MODE derives from pk_live_ prefix', () => {
    expect(CLERK_CONFIG_SRC).toContain("startsWith('pk_live_')");
  });

  it('neither gate is hardcoded true', () => {
    expect(CLERK_CONFIG_SRC).not.toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*true/);
    expect(CLERK_CONFIG_SRC).not.toMatch(/CLERK_PRODUCTION_MODE\s*=\s*true/);
  });
});

describe('AUTH-1 PR271A — banned-strings scan on the gate surfaces', () => {
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['complete', 'credentialing'].join(' '),
    ['instant', 'credentialing'].join(' '),
    ['legally', 'accepted'].join(' '),
    ['risk', 'transferred'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  const surfaces = [HOLDER_LAYOUT_SRC, HOLDER_PAGE_SRC, MIDDLEWARE_SRC, CLERK_CONFIG_SRC];
  for (const phrase of BANNED) {
    for (let i = 0; i < surfaces.length; i++) {
      it(`surface[${i}] does not contain banned phrase: ${phrase}`, () => {
        expect(surfaces[i]).not.toContain(phrase);
      });
    }
  }
});
