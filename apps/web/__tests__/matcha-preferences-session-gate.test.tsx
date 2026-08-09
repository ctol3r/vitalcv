// @vitest-environment jsdom
/**
 * useMatchaPreferences does not pick a storage bucket before it knows the identity.
 *
 * The other half of the 2026-08-08 audit finding: the hook read localStorage on mount and
 * set `loaded` true immediately, ahead of the session. With Clerk still resolving there is
 * no account to key on, so an eager read can only land on the unscoped/device bucket — and
 * the surfaces gate their render on `loaded`, so whatever it found was shown as the
 * clinician's own completeness before the real account ever arrived.
 *
 * Lives in its own file because it mocks the role context to hold a session open in the
 * unresolved state, which the static provider used by the sibling suite cannot express.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = { sessionLoaded: false, userId: null as string | null };

vi.mock('@/components/auth/RoleContext', () => ({
  useOptionalRoleContext: () => ({
    isLoaded: session.sessionLoaded,
    sessionLoaded: session.sessionLoaded,
    isSignedIn: Boolean(session.userId),
    userId: session.userId,
    clerkRole: null,
    persona: null,
    role: 'guest',
    landingRoute: '/sign-in',
    isClinician: false,
    isEmployer: false,
    clinicianNpi: null,
    employerOrgId: null,
    workspace: null,
    refresh: async () => {},
  }),
}));

const { useMatchaPreferences } = await import('../components/matcha/useMatchaPreferences');
const { DEVICE_SCOPE, savePreferences } = await import('../lib/matcha/storage');

type HookResult = ReturnType<typeof useMatchaPreferences>;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let latest: HookResult | null = null;

function Probe() {
  latest = useMatchaPreferences();
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render() {
  await act(async () => {
    root!.render(<Probe />);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(async () => {
  window.localStorage.clear();
  latest = null;
  session.sessionLoaded = false;
  session.userId = null;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  vi.unstubAllGlobals();
});

describe('the session gates the first read', () => {
  it('reads nothing and stays unloaded while the session is unresolved', async () => {
    savePreferences(DEVICE_SCOPE, { preferredStates: ['CA'] }, '2026-08-08T00:00:00.000Z');

    await render();

    // `loaded` is what the MATCHA surfaces gate their render on. Held false, they show
    // nothing rather than showing an unattributed cache as the clinician's answers.
    expect(latest?.loaded).toBe(false);
    expect(latest?.preferences).toEqual({});
    expect(latest?.completeness).toBe(0);
    expect(latest?.sync).toBe('pending');
    // And nothing is claimed about durability while the identity is unknown.
    expect(latest?.notice).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads the account bucket once the session resolves to an account', async () => {
    savePreferences(DEVICE_SCOPE, { preferredStates: ['CA'] }, '2026-08-08T00:00:00.000Z');
    await render();
    expect(latest?.loaded).toBe(false);

    session.sessionLoaded = true;
    session.userId = 'user_alice';
    await render();

    expect(latest?.loaded).toBe(true);
    // The device bucket's answers are not this account's, and are not adopted.
    expect(latest?.preferences).toEqual({});
  });
});
