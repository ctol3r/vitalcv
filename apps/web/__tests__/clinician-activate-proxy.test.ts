import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/api/clinician/activate proxy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('rejects unauthenticated activation requests', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('../app/api/clinician/activate/route');

    const response = await POST(new Request('http://localhost/api/clinician/activate', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
    }) as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('forwards activation requests with authenticated Clerk headers', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'ada@example.com' },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        readinessScore: 91,
        readinessLevel: 'L3',
        readinessStatus: 'Ready to credential — all evidence verified',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/clinician/activate/route');
    const response = await POST(new Request('http://localhost/api/clinician/activate', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://backend.test/api/clinician/activate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ npi: '1234567890' }),
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get('x-clerk-user-id')).toBe('clerk-user-1');
    expect(init.headers.get('x-clerk-user-email')).toBe('ada@example.com');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      readinessScore: 91,
      readinessLevel: 'L3',
      readinessStatus: 'Ready to credential — all evidence verified',
    });
  });
});
