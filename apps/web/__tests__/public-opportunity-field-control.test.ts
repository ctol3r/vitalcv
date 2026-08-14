import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPilotSurfaceControl: vi.fn(),
}));

vi.mock('@/lib/server/pilot-ops', () => ({
  getPilotSurfaceControl: mocks.getPilotSurfaceControl,
}));

vi.mock('@/lib/api', () => ({
  getBackendBase: () => 'https://backend.test',
}));

import { fetchPublicOpportunityField } from '@/lib/launch/marketplace';

describe('public opportunity field operational control', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mocks.getPilotSurfaceControl.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['hidden', 'disabled'] as const)(
    'withholds server-rendered roles when the board is %s',
    async (mode) => {
      mocks.getPilotSurfaceControl.mockResolvedValue({
        surfaceId: 'explore_board',
        mode,
        reason: 'operator control',
      });

      const result = await fetchPublicOpportunityField(new URLSearchParams('limit=12'));

      expect(result).toEqual({
        opportunities: [],
        total: 0,
        truncated: false,
        available: true,
      });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('reads the backend when the board is available', async () => {
    mocks.getPilotSurfaceControl.mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      opportunities: [],
      total: 0,
      truncated: false,
    }), { status: 200 }));

    const result = await fetchPublicOpportunityField(new URLSearchParams('limit=12'));

    expect(result.available).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
