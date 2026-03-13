import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/api/velocity/[organizationId] proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects unauthenticated org drilldown requests', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { GET } = await import('../app/api/velocity/[organizationId]/route');

    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: 'org-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('forwards the authenticated clerk user id to the backend', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-user-1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ scope: 'organization', organization: { organizationId: 'org-1' } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/velocity/[organizationId]/route');
    const response = await GET({} as never, {
      params: Promise.resolve({ organizationId: 'org-1' }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/velocity/org-1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-clerk-user-id': 'clerk-user-1',
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scope: 'organization',
      organization: { organizationId: 'org-1' },
    });
  });
});
