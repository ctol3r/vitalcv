import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * loadGardenData contract: live mapping from the backend, honest
 * `unavailable` on every failure path, and never a fixture fallback.
 */

// The poison-pill marker only guards client bundles; tests run in node.
vi.mock('server-only', () => ({}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'user_test' })),
}));

vi.mock('@/lib/server/marketplace-proxy', () => ({
  buildMarketplaceHeaders: vi.fn(async () => new Headers({ 'x-clerk-user-id': 'user_test' })),
}));

vi.mock('@/lib/api', () => ({
  getApiBase: vi.fn(() => 'http://backend.test'),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as unknown as Response;
}

async function freshLoad() {
  vi.resetModules();
  const mod = await import('@/lib/career-garden/serverSource');
  return mod.loadGardenData;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadGardenData', () => {
  it('maps backend rows into views and clamps unknown values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/notes')
          ? jsonResponse({
              notes: [
                {
                  id: 'n1',
                  title: 'A note',
                  body: 'Body',
                  tags: ['x'],
                  status: 'growing',
                  createdAt: '2026-07-27T12:34:56.000Z',
                },
                {
                  id: 'n2',
                  title: 'Weird status',
                  body: 'Body',
                  tags: null,
                  status: 'exploded',
                  createdAt: '2026-07-26T00:00:00.000Z',
                },
              ],
            })
          : jsonResponse({
              entries: [
                {
                  id: 'e1',
                  section: 'teaching',
                  headline: 'H',
                  detail: 'D',
                  origin: 'Grown from your note',
                  fromNoteId: 'n1',
                  createdAt: '2026-07-27T13:00:00.000Z',
                },
                {
                  id: 'e2',
                  section: 'not-a-section',
                  headline: 'H2',
                  detail: 'D2',
                  origin: 'x',
                  createdAt: '2026-07-27T13:00:00.000Z',
                },
              ],
            }),
      ),
    );
    const loadGardenData = await freshLoad();
    const data = await loadGardenData();
    expect(data.mode).toBe('live');
    expect(data.notes).toHaveLength(2);
    expect(data.notes[0]).toMatchObject({ id: 'n1', status: 'growing', capturedAt: '2026-07-27', tags: ['x'] });
    expect(data.notes[1]).toMatchObject({ status: 'unfiled', tags: [] });
    // Unknown sections are dropped, never guessed.
    expect(data.cvEntries).toHaveLength(1);
    expect(data.cvEntries[0]).toMatchObject({
      id: 'e1',
      provenance: 'self-attested',
      approvedAt: '2026-07-27',
      fromNoteId: 'n1',
    });
  });

  it('returns unavailable when the backend answers non-OK — never a fixture', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, false)));
    const loadGardenData = await freshLoad();
    const data = await loadGardenData();
    expect(data).toMatchObject({ mode: 'unavailable', notes: [], cvEntries: [] });
  });

  it('returns unavailable when the backend is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    const loadGardenData = await freshLoad();
    const data = await loadGardenData();
    expect(data.mode).toBe('unavailable');
  });
});
