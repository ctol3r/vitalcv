import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ getBackendBase: () => 'http://backend.test' }));
vi.mock('@/lib/server/marketplace-proxy', () => ({
  buildMarketplaceHeaders: async () => ({ 'Content-Type': 'application/json' }),
}));

import { resolveEntityPreview } from '@/lib/entity-preview/resolvers';

const session = {} as never;

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveEntityPreview — opportunity', () => {
  it('maps a real opportunity into an authorization-safe preview', async () => {
    global.fetch = mockFetch(200, {
      opportunity: {
        id: 'opp_1',
        title: 'Hospitalist — Nights',
        organizationName: 'El Camino Health',
        specialty: 'Internal Medicine',
        state: 'CA',
        payRange: '$300k–$340k',
        hiringType: 'Locum',
        remote: false,
      },
    });
    const preview = await resolveEntityPreview('opportunity', 'opp_1', session);
    expect(preview).toMatchObject({
      type: 'opportunity',
      id: 'opp_1',
      title: 'Hospitalist — Nights',
      subtitle: 'El Camino Health',
      state: 'Locum',
    });
    expect(preview?.fields).toEqual([
      { label: 'Specialty', value: 'Internal Medicine' },
      { label: 'Location', value: 'CA' },
      { label: 'Compensation', value: '$300k–$340k' },
    ]);
  });

  it('shows Remote as the location when the opportunity is remote', async () => {
    global.fetch = mockFetch(200, { opportunity: { id: 'o', title: 'T', remote: true } });
    const preview = await resolveEntityPreview('opportunity', 'o', session);
    expect(preview?.fields?.find((f) => f.label === 'Location')?.value).toBe('Remote');
  });

  it('returns null (uniform no-preview) on a non-200 — absent or unauthorized', async () => {
    global.fetch = mockFetch(404, { error: 'not_found' });
    expect(await resolveEntityPreview('opportunity', 'opp_x', session)).toBeNull();
    global.fetch = mockFetch(403, { error: 'forbidden' });
    expect(await resolveEntityPreview('opportunity', 'opp_x', session)).toBeNull();
  });

  it('returns null when the backend is unreachable (no leak of the error)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await resolveEntityPreview('opportunity', 'opp_1', session)).toBeNull();
  });
});

describe('resolveEntityPreview — unwired types', () => {
  it('returns null for employer/evidence (no resolver yet) without fetching', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    expect(await resolveEntityPreview('employer', 'org_1', session)).toBeNull();
    expect(await resolveEntityPreview('evidence_claim', 'claim_1', session)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
