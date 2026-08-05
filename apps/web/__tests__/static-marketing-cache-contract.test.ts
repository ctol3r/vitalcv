/**
 * Wave 0.2 follow-up — the public marketing site must stay statically
 * renderable while auth is enabled.
 *
 * The regression this locks down: the root layout called `await auth()` to
 * seed RoleProvider. With Clerk correctly enabled at BUILD time (Wave 0.1),
 * that single call forced EVERY route dynamic — measured live on prod:
 * /, /employers, /trust, /status, /pricing all served
 * `private, no-cache, no-store` instead of their bounded shared cache.
 * Local/CI builds are keyless, so no e2e can catch the keyed-build variant;
 * this source contract + the deploy smoke's bounded-homepage check are the
 * guards.
 */

import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url).pathname, 'utf8');

describe('root layout never reads request state', () => {
  // Strip comments: the layout's own cache-contract comment NAMES the banned
  // calls; the contract is about executable code.
  const layout = read('../app/layout.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('does not call auth()/headers()/cookies() or import @clerk/nextjs/server', () => {
    expect(layout).not.toMatch(/await auth\(/);
    expect(layout).not.toContain('@clerk/nextjs/server');
    expect(layout).not.toMatch(/\bheaders\(\)/);
    expect(layout).not.toMatch(/\bcookies\(\)/);
  });

  it('is a synchronous component (an async root layout invites request reads)', () => {
    expect(layout).toMatch(/export default function RootLayout/);
  });
});

describe('homepage keeps bounded shared caching', () => {
  /*
   * The #680 contract is a bound on STALENESS, not a demand for one keyword.
   * This asserted `export const revalidate = N` literally, and went red in
   * Wave 1075 on a change that made the homepage strictly fresher: `/` is now
   * force-dynamic, so shared caches hold it for 0s rather than up to 300s.
   *
   * force-dynamic is also load-bearing there for a second reason — it is what
   * lets PUBLIC_HOME_VARIANT switch the homepage on redeploy instead of
   * rebuild, so an incident rollback does not wait on a build.
   */
  it('bounds shared staleness at ≤ 300s (the #680 freshness contract)', () => {
    const page = read('../app/page.tsx');
    const revalidate = page.match(/export const revalidate = (\d+)/);
    const forcedDynamic = /export const dynamic = 'force-dynamic'/.test(page);

    const maxStalenessSeconds = forcedDynamic
      ? 0
      : revalidate
        ? Number(revalidate[1])
        : Number.POSITIVE_INFINITY;

    expect(
      maxStalenessSeconds,
      'homepage must bound shared-cache staleness (revalidate ≤ 300 or force-dynamic)',
    ).toBeLessThanOrEqual(300);
    // Unbounded (neither directive present) is the failure this guards.
    expect(Number.isFinite(maxStalenessSeconds)).toBe(true);
  });
});

// --- RoleProvider converges from the CLIENT session -------------------------

const authState: { userId: string | null; isLoaded: boolean } = { userId: null, isLoaded: true };

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => authState,
}));

async function renderRoleProbe(env: { publishableKey?: string }, initialUserId: string | null) {
  vi.resetModules();
  if (env.publishableKey) {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env.publishableKey);
  } else {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
  }
  const { RoleProvider, useRoleContext } = await import('@/components/auth/RoleContext');

  let captured: ReturnType<typeof useRoleContext> | null = null;
  function Probe() {
    captured = useRoleContext();
    return null;
  }
  renderToStaticMarkup(
    React.createElement(
      RoleProvider,
      { initialUserId, initialClerkRole: null },
      React.createElement(Probe),
    ),
  );
  return captured!;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('RoleProvider resolves the session on the client', () => {
  it('Clerk build: a loaded client session signs the user in with no server seed', async () => {
    authState.userId = 'user_abc';
    authState.isLoaded = true;
    const ctx = await renderRoleProbe({ publishableKey: 'pk_test_contract' }, null);
    expect(ctx.isSignedIn).toBe(true);
    expect(ctx.role).toBe('clinician');
    expect(ctx.landingRoute).toBe('/holder/home');
  });

  it('Clerk build: loaded signed-out session is a guest', async () => {
    authState.userId = null;
    authState.isLoaded = true;
    const ctx = await renderRoleProbe({ publishableKey: 'pk_test_contract' }, null);
    expect(ctx.isSignedIn).toBe(false);
    expect(ctx.role).toBe('guest');
    expect(ctx.landingRoute).toBe('/sign-in');
  });

  it('Clerk build: before the client session loads, the placeholder seed holds', async () => {
    authState.userId = null;
    authState.isLoaded = false;
    const ctx = await renderRoleProbe({ publishableKey: 'pk_test_contract' }, 'user_seed');
    expect(ctx.isSignedIn).toBe(true);
    expect(ctx.isLoaded).toBe(false);
  });

  it('keyless build: never touches Clerk hooks, derives from the seed', async () => {
    authState.userId = 'must_not_be_read';
    authState.isLoaded = true;
    const ctx = await renderRoleProbe({}, null);
    expect(ctx.isSignedIn).toBe(false);
    expect(ctx.role).toBe('guest');
  });
});
