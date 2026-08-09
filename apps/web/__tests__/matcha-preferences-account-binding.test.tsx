// @vitest-environment jsdom
/**
 * useMatchaPreferences binds preferences to the signed-in account, and says so.
 *
 * Two defects from the 2026-08-08 authed audit are under test here:
 *
 *   1. Account binding. The hook hydrated from one global localStorage key and marked
 *      itself loaded before the server was consulted, so completeness and the derived
 *      profile could render another account's answers — or a signed-out session's — as
 *      the current clinician's.
 *
 *   2. Disclosure. Every unhappy server outcome was swallowed. A 401, a degraded read,
 *      and an empty account were indistinguishable, and PUT's `200 {ok:false}` (the
 *      route's DB-error reply) was never inspected at all, so a lost write looked exactly
 *      like a saved one.
 *
 * Mounted through the real RoleProvider — with no Clerk key in the test environment it
 * resolves to the static provider — so the userId → scope → storage-key path is the one
 * the app runs, not a stand-in.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleProvider } from '../components/auth/RoleContext';
import {
  useMatchaPreferences,
  type UseMatchaPreferences,
} from '../components/matcha/useMatchaPreferences';
import { DEVICE_SCOPE, accountScope, loadStoredPreferences, savePreferences } from '../lib/matcha/storage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const AT = '2026-08-08T00:00:00.000Z';
const ALICE = 'user_alice';
const BRETT = 'user_brett';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Server behaviour for /api/matcha/preferences, per test. */
interface ServerStub {
  get: () => Response;
  put?: () => Response;
}

let putBodies: unknown[] = [];

function installFetch(stub: ServerStub) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/matcha/preferences')) {
        if ((init?.method ?? 'GET').toUpperCase() === 'PUT') {
          putBodies.push(JSON.parse(String(init?.body ?? 'null')));
          return stub.put ? stub.put() : jsonResponse({ ok: true, updatedAt: AT, fields: 1 });
        }
        return stub.get();
      }
      if (url.includes('/api/me/workspaces')) return jsonResponse({ userId: ALICE });
      return jsonResponse({}, 404);
    }),
  );
}

let latest: UseMatchaPreferences | null = null;

function Probe() {
  latest = useMatchaPreferences();
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mountAs(userId: string | null) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <RoleProvider initialUserId={userId} initialClerkRole={null}>
        <Probe />
      </RoleProvider>,
    );
  });
  // Let the preferences GET and any follow-on state settle.
  await act(async () => {
    await Promise.resolve();
  });
}

/** Re-render the same tree under a different account, as a session switch would. */
async function switchTo(userId: string | null) {
  await act(async () => {
    root!.render(
      <RoleProvider initialUserId={userId} initialClerkRole={null}>
        <Probe />
      </RoleProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function unmount() {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

beforeEach(() => {
  window.localStorage.clear();
  putBodies = [];
  latest = null;
});

afterEach(() => {
  unmount();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('preferences are scoped to the signed-in account', () => {
  it('does not render another account\'s cached answers', async () => {
    // Alice answered on this browser and her copy is cached locally.
    savePreferences(accountScope(ALICE), { preferredStates: ['CA'], minimumSalary: 275000 }, AT);
    // Brett signs in on the same browser; his account has nothing saved.
    installFetch({ get: () => jsonResponse({ preferences: {}, updatedAt: null }) });

    await mountAs(BRETT);

    expect(latest?.preferences).toEqual({});
    expect(latest?.completeness).toBe(0);
    // The audit's exact symptom: a completeness figure and profile insights sourced
    // from a cache with someone else's answers in it.
    expect(latest?.derived.insights ?? []).toHaveLength(0);
  });

  it('does not render a signed-out session\'s answers to a signed-in account', async () => {
    savePreferences(DEVICE_SCOPE, { preferredStates: ['WA'] }, AT);
    installFetch({ get: () => jsonResponse({ preferences: {}, updatedAt: null }) });

    await mountAs(ALICE);

    expect(latest?.preferences).toEqual({});
  });

  it('renders the account\'s own server copy over any local cache', async () => {
    savePreferences(accountScope(ALICE), { preferredStates: ['CA'] }, AT);
    installFetch({
      get: () => jsonResponse({ preferences: { preferredStates: ['NY'] }, updatedAt: AT }),
    });

    await mountAs(ALICE);

    expect(latest?.preferences).toEqual({ preferredStates: ['NY'] });
    expect(latest?.sync).toBe('synced');
  });

  it('evicts an account\'s local cache when that account leaves the browser', async () => {
    installFetch({ get: () => jsonResponse({ preferences: { preferredStates: ['CA'] }, updatedAt: AT }) });
    await mountAs(ALICE);
    expect(loadStoredPreferences(accountScope(ALICE))).toEqual({ preferredStates: ['CA'] });

    await switchTo(null);

    // The account store keeps the durable copy; the browser must not keep a readable
    // one for whoever uses the device next.
    expect(loadStoredPreferences(accountScope(ALICE))).toEqual({});
    expect(latest?.preferences).toEqual({});
    expect(latest?.sync).toBe('device');
  });
});

describe('the hook says where the answers are being kept', () => {
  it('reports device storage when signed out, and never calls the account store', async () => {
    installFetch({ get: () => jsonResponse({ error: 'unauthenticated' }, 401) });

    await mountAs(null);

    expect(latest?.sync).toBe('device');
    expect(latest?.unsaved).toBe(false);
    expect(latest?.notice?.tone).toBe('info');
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some((c) => String(c[0]).includes('/api/matcha/preferences'))).toBe(false);
  });

  it('reports degraded when the account store answers with its degraded marker', async () => {
    // The route's DB-error reply: a 200 that looks exactly like an empty account.
    installFetch({
      get: () => jsonResponse({ preferences: {}, updatedAt: null, degraded: true }),
    });

    await mountAs(ALICE);

    expect(latest?.sync).toBe('degraded');
    expect(latest?.notice?.tone).toBe('warn');
  });

  it('reports degraded when the account store rejects the read', async () => {
    installFetch({ get: () => jsonResponse({ error: 'unauthenticated' }, 401) });

    await mountAs(ALICE);

    expect(latest?.sync).toBe('degraded');
  });

  it('does not confuse a genuinely empty account with an unreachable one', async () => {
    installFetch({ get: () => jsonResponse({ preferences: {}, updatedAt: null }) });

    await mountAs(ALICE);

    expect(latest?.sync).toBe('synced');
    expect(latest?.notice).toBeNull();
  });
});

describe('a write that did not land is reported as unsaved', () => {
  it('treats the route\'s 200 {ok:false} as a failed write, not a save', async () => {
    installFetch({
      get: () => jsonResponse({ preferences: {}, updatedAt: null }),
      put: () => jsonResponse({ ok: false, degraded: true }),
    });
    await mountAs(ALICE);
    expect(latest?.unsaved).toBe(false);

    await act(async () => {
      latest!.setField('preferredStates', ['CA']);
    });
    // The write is debounced; run it out.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(putBodies).toHaveLength(1);
    expect(latest?.unsaved).toBe(true);
    expect(latest?.sync).toBe('degraded');
    expect(latest?.notice?.tone).toBe('warn');
    // The answer itself is not lost — it is in this browser, which is what the notice says.
    expect(latest?.preferences).toEqual({ preferredStates: ['CA'] });
    expect(loadStoredPreferences(accountScope(ALICE))).toEqual({ preferredStates: ['CA'] });
  });

  it('clears the unsaved flag when the write does land', async () => {
    installFetch({
      get: () => jsonResponse({ preferences: {}, updatedAt: null }),
      put: () => jsonResponse({ ok: true, updatedAt: AT, fields: 1 }),
    });
    await mountAs(ALICE);

    await act(async () => {
      latest!.setField('preferredStates', ['CA']);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(latest?.unsaved).toBe(false);
    expect(latest?.sync).toBe('synced');
    expect(latest?.notice).toBeNull();
  });
});
