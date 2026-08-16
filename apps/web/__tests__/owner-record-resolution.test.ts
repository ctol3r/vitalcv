import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ownerRecord — the workspace lookup behind /holder and /clinician/profile.
 *
 * Regression contract for the "every wallet reads as an outage" defect: the
 * lookup used to forward browser cookies to a backend that only authenticates
 * identity headers, so it 401'd for EVERY signed-in user and the pages showed
 * "workspace lookup failed" instead of the real not-onboarded empty state.
 *
 * The states are different claims with different fixes:
 *   200 + personProfile:null  → no_npi   ("link your NPI" — an onboarding CTA)
 *   non-OK / network failure  → unknown  ("our problem" — an outage card)
 * Collapsing them is the bug this file exists to prevent.
 */

const authMock = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => authMock(),
}));

const buildHeadersMock = vi.fn();
vi.mock('@/lib/server/marketplace-proxy', () => ({
  MARKETPLACE_BACKEND: 'http://backend.test',
  buildMarketplaceHeaders: (...args: unknown[]) => buildHeadersMock(...args),
}));

const nppesMock = vi.fn();
vi.mock('@/lib/clinician-record/nppes', () => ({
  fetchNppesRecord: (...args: unknown[]) => nppesMock(...args),
}));
vi.mock('@/lib/clinician-record/cmsClinicians', () => ({
  fetchCmsClinicianRows: vi.fn().mockResolvedValue([]),
}));

import { loadOwnerRecord } from '@/lib/clinician-record/ownerRecord';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  authMock.mockResolvedValue({ userId: 'user_1', sessionClaims: {} });
  buildHeadersMock.mockResolvedValue(
    new Headers({ Accept: 'application/json', 'x-clerk-user-id': 'user_1' }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('loadOwnerRecord', () => {
  it('authenticates with identity headers, never bare cookies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ personProfile: null }));

    await loadOwnerRecord();

    expect(buildHeadersMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://backend.test/api/me/workspaces');
    const sent = new Headers(init.headers);
    expect(sent.get('x-clerk-user-id')).toBe('user_1');
    expect(sent.get('cookie')).toBeNull();
  });

  it('maps 200 + personProfile:null to no_npi — an empty account is not an outage', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ personProfile: null, memberships: [], canSwitchTo: ['CLINICIAN'] }),
    );

    await expect(loadOwnerRecord()).resolves.toEqual({ state: 'no_npi' });
  });

  it('maps a failed lookup to unknown — never to no_npi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));

    await expect(loadOwnerRecord()).resolves.toEqual({ state: 'unknown' });
  });

  it('maps a linked NPI with an unreachable registry to registry_unavailable', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ personProfile: { npi: '1558395518' } }));
    nppesMock.mockResolvedValue(null);

    await expect(loadOwnerRecord()).resolves.toEqual({
      state: 'registry_unavailable',
      npi: '1558395518',
    });
  });
});
