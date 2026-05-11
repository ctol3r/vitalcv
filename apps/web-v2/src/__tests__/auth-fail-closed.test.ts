/**
 * W5-PR256A — web-v2 auth fail-closed lockdown.
 *
 * Source-level invariants on the Clerk wiring:
 *   - clerkConfig derives CLERK_PROVIDER_ENABLED from the publishable
 *     key (never hardcoded true).
 *   - layout.tsx mounts ClerkProvider ONLY when CLERK_PROVIDER_ENABLED.
 *   - middleware.ts short-circuits to a no-op when CLERK_SECRET_KEY
 *     is absent (sandbox stays usable instead of crashing).
 *   - sign-in page renders an explicit "not configured" message when
 *     the publishable key is missing — never a broken widget.
 *
 * These are deliberately source-text assertions (the runtime tests
 * would need a Next bootstrap). The PR's CI surface is `pnpm
 * --filter @vitalcv/web-v2 build`, which compiles all four files
 * end-to-end; this test pins the truth-contract shape that lets the
 * build mean what we claim it means.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

const CLERK_CONFIG_SRC = readFileSync(resolve(ROOT, 'lib/auth/clerkConfig.ts'), 'utf8');
const LAYOUT_SRC = readFileSync(resolve(ROOT, 'app/layout.tsx'), 'utf8');
const MIDDLEWARE_SRC = readFileSync(resolve(ROOT, 'middleware.ts'), 'utf8');
const SIGN_IN_SRC = readFileSync(
  resolve(ROOT, 'app/sign-in/[[...sign-in]]/page.tsx'),
  'utf8',
);
const README = readFileSync(resolve(ROOT, '../README.md'), 'utf8');

describe('W5-PR256A — clerkConfig fail-closed derivation', () => {
  it('CLERK_PROVIDER_ENABLED derives from publishable key, never hardcoded true', () => {
    expect(CLERK_CONFIG_SRC).toMatch(
      /CLERK_ENABLED\s*=\s*Boolean\(\s*process\.env\.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\s*,?\s*\)/,
    );
    expect(CLERK_CONFIG_SRC).toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*CLERK_ENABLED/);
    expect(CLERK_CONFIG_SRC).not.toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*true/);
  });

  it('CLERK_PRODUCTION_MODE derives from pk_live_ prefix, never hardcoded', () => {
    expect(CLERK_CONFIG_SRC).toContain("startsWith('pk_live_')");
    expect(CLERK_CONFIG_SRC).not.toMatch(/CLERK_PRODUCTION_MODE\s*=\s*true/);
  });
});

describe('W5-PR256A — layout.tsx fail-closed ClerkProvider mount', () => {
  it('imports CLERK_PROVIDER_ENABLED from local clerkConfig', () => {
    expect(LAYOUT_SRC).toContain("from '@/lib/auth/clerkConfig'");
    expect(LAYOUT_SRC).toContain('CLERK_PROVIDER_ENABLED');
  });

  it('does not wrap with ClerkProvider when CLERK_PROVIDER_ENABLED is false', () => {
    // The control-flow shape: early-return the unwrapped tree.
    expect(LAYOUT_SRC).toMatch(/if\s*\(!\s*CLERK_PROVIDER_ENABLED\)/);
  });

  it('imports ClerkProvider from @clerk/nextjs (real, not mock)', () => {
    expect(LAYOUT_SRC).toContain("from '@clerk/nextjs'");
    expect(LAYOUT_SRC).toContain('ClerkProvider');
  });
});

describe('W5-PR256A — middleware.ts fail-closed pass-through', () => {
  it('short-circuits to NextResponse.next() when CLERK_SECRET_KEY is absent', () => {
    expect(MIDDLEWARE_SRC).toMatch(
      /CLERK_MIDDLEWARE_ENABLED\s*=\s*Boolean\(\s*process\.env\.CLERK_SECRET_KEY\s*\)/,
    );
    expect(MIDDLEWARE_SRC).toMatch(/if\s*\(!\s*CLERK_MIDDLEWARE_ENABLED\)/);
  });

  it('uses real clerkMiddleware from @clerk/nextjs/server', () => {
    expect(MIDDLEWARE_SRC).toContain("from '@clerk/nextjs/server'");
    expect(MIDDLEWARE_SRC).toContain('clerkMiddleware');
  });

  it('redirects unauthenticated requests to /sign-in', () => {
    expect(MIDDLEWARE_SRC).toContain('/sign-in');
    expect(MIDDLEWARE_SRC).toContain('NextResponse.redirect');
  });

  it('keeps /sign-in itself public', () => {
    expect(MIDDLEWARE_SRC).toMatch(/createRouteMatcher\(\[\s*['"]\/sign-in/);
  });
});

describe('W5-PR256A — sign-in page truth-contract', () => {
  it('renders explicit not-configured message when key absent', () => {
    expect(SIGN_IN_SRC).toContain('Sign-in is not configured');
    expect(SIGN_IN_SRC).toContain('CLERK_PROVIDER_ENABLED');
  });

  it('mounts the real Clerk <SignIn /> widget when configured', () => {
    expect(SIGN_IN_SRC).toContain("import { SignIn } from '@clerk/nextjs'");
    expect(SIGN_IN_SRC).toMatch(/<SignIn\s*\/>/);
  });

  it('does not silently render a broken widget', () => {
    // The not-configured branch returns the explainer element, not
    // null and not an empty fragment.
    expect(SIGN_IN_SRC).toMatch(/data-testid="sign-in-not-configured"/);
  });
});

describe('W5-PR256A — banned-strings scan on auth surface', () => {
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
  const surfaces = [CLERK_CONFIG_SRC, LAYOUT_SRC, MIDDLEWARE_SRC, SIGN_IN_SRC, README];
  for (const phrase of BANNED) {
    for (let i = 0; i < surfaces.length; i++) {
      it(`surface[${i}] does not contain banned phrase: ${phrase}`, () => {
        expect(surfaces[i]).not.toContain(phrase);
      });
    }
  }
});
