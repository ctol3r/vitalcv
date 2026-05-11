/**
 * PROD-2 PR304A — Clerk OAuth runbook accuracy lockdown.
 *
 * The runbook (docs/ops/clerk-google-oauth-runbook.md) references
 * specific env var names, file paths, and code patterns. If those
 * drift in the codebase, the runbook becomes stale and the rephrased
 * OAuth-activation brief pattern recurs. This test pins the runbook
 * against the source-of-truth files.
 *
 * If you change one of the asserted env var names or file paths,
 * update the runbook AND this test in the same PR.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const RUNBOOK = readFileSync(
  resolve(REPO_ROOT, 'docs/ops/clerk-google-oauth-runbook.md'),
  'utf8',
);
const ENV_TS = readFileSync(
  resolve(REPO_ROOT, 'apps/web/lib/env.ts'),
  'utf8',
);
const CLERK_CONFIG = readFileSync(
  resolve(REPO_ROOT, 'apps/web/lib/auth/clerkConfig.ts'),
  'utf8',
);
const MIDDLEWARE = readFileSync(
  resolve(REPO_ROOT, 'apps/web/middleware.ts'),
  'utf8',
);

describe('PROD-2 PR304A — runbook references real env var names', () => {
  it('every required env var named in the runbook exists in env.ts as required', () => {
    expect(RUNBOOK).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(RUNBOOK).toContain('CLERK_SECRET_KEY');
    // env.ts must list both as required.
    expect(ENV_TS).toMatch(/name:\s*'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'[^}]*kind:\s*'required'/s);
    expect(ENV_TS).toMatch(/name:\s*'CLERK_SECRET_KEY'[^}]*kind:\s*'required'/s);
  });

  it('every optional env var named in the runbook exists in env.ts as optional', () => {
    // The runbook references these optional overrides; env.ts has them.
    expect(RUNBOOK).toContain('NEXT_PUBLIC_CLERK_SIGN_IN_URL');
    expect(ENV_TS).toMatch(/name:\s*'NEXT_PUBLIC_CLERK_SIGN_IN_URL'[^}]*kind:\s*'optional'/s);
  });
});

describe('PROD-2 PR304A — runbook references real code patterns', () => {
  it('CLERK_PROVIDER_ENABLED is derived from env, never hardcoded — runbook claim is true', () => {
    expect(RUNBOOK).toContain('CLERK_PROVIDER_ENABLED');
    expect(RUNBOOK).toContain('derived from publishable-key presence');
    expect(CLERK_CONFIG).toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*CLERK_ENABLED/);
    expect(CLERK_CONFIG).not.toMatch(/CLERK_PROVIDER_ENABLED\s*=\s*true/);
  });

  it('clerkMiddleware short-circuits when CLERK_SECRET_KEY absent — runbook claim is true', () => {
    expect(RUNBOOK).toContain('short-circuits to no-op if `CLERK_SECRET_KEY` is absent');
    expect(MIDDLEWARE).toMatch(
      /CLERK_MIDDLEWARE_ENABLED\s*=\s*Boolean\(\s*process\.env\.CLERK_SECRET_KEY\s*\)/,
    );
  });
});

describe('PROD-2 PR304A — runbook does not invent fake credentials', () => {
  it('does not embed any real-looking pk_live_ or sk_live_ value', () => {
    // Anything matching pk_live_/sk_live_/pk_test_/sk_test_ followed
    // by significant chars would be a leaked credential. Allowed:
    //   - the documented `REPLACE_ME` placeholder (which the runbook
    //     itself warns against actually using)
    //   - the ellipsis `…` form (no key chars at all)
    const SAFE_PLACEHOLDER = /REPLACE_ME/;
    const candidates = RUNBOOK.match(/(?:pk|sk)_(?:live|test)_[A-Za-z0-9_-]{8,}/g) ?? [];
    const leaked = candidates.filter((c) => !SAFE_PLACEHOLDER.test(c));
    expect(leaked).toEqual([]);
  });
});

describe('PROD-2 PR304A — runbook truth-contract scan', () => {
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
  it.each(BANNED)('runbook does not contain banned phrase: %s', (phrase) => {
    expect(RUNBOOK).not.toContain(phrase);
  });
});

describe('PROD-2 PR304A — runbook references existing PRs and lockdowns by number', () => {
  it('references PR #309 (ProofManifestPanel) for follow-up wiring', () => {
    expect(RUNBOOK).toContain('#309');
  });
  it('references PR #310 (web-v2 Clerk pattern) for sandbox parity', () => {
    expect(RUNBOOK).toContain('#310');
  });
  it('references PR #311 (activation flow lockdown) as the existing gate', () => {
    expect(RUNBOOK).toContain('#311');
  });
  it('references PR #313 (backend lineage primitive) as the next code action', () => {
    expect(RUNBOOK).toContain('#313');
  });
});
