import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/holder/readiness page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    authMock.mockReset();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('renders the activated clinician readiness snapshot', async () => {
    authMock.mockResolvedValue({
      userId: 'clerk-user-1',
      sessionClaims: { email: 'ada@example.com' },
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          npi: '1234567890',
          readiness_level: 'L3',
          readiness_score: 91,
          readiness_status: 'Ready to credential — all evidence verified',
          gap_summary: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ));
    vi.stubGlobal('fetch', fetchMock);

    const { default: HolderReadinessPage } = await import('../app/holder/readiness/page');
    const markup = renderToStaticMarkup(await HolderReadinessPage());

    expect(markup).toContain('Ada, your readiness is live.');
    expect(markup).toContain('1234567890');
    expect(markup).toContain('Ready to credential');
    expect(markup).toContain('91/100');
  });
});
