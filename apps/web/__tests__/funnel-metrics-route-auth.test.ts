/**
 * /api/internal/funnel-metrics — the machine-auth boundary.
 *
 * The route executes HogQL with POSTHOG_PERSONAL_API_KEY, a privileged
 * personal key. Before this guard existed, PUBLIC_ROUTE_PATTERNS exempted
 * all of /api from middleware auth ("API routes handle their own auth") and
 * this route handled none — anonymous production callers could drive the
 * key. These tests pin the boundary: anonymous ⇒ 401 with zero upstream
 * fetches, unconfigured secrets ⇒ 500 (closed), authorized ⇒ the handler
 * proceeds.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/internal/funnel-metrics', () => {
  async function loadRoute() {
    return import('../app/api/internal/funnel-metrics/route');
  }

  function get(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost/api/internal/funnel-metrics', {
      method: 'GET',
      headers,
    });
  }

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.CRON_SECRET = 'test-cron-secret';
    delete process.env.MONITORING_SECRET;
    // The route reads these at module load; unset means an authorized call
    // stops at the 503 config check instead of reaching PostHog.
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;
  });

  it('401s anonymous callers without querying PostHog', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_secret';
    process.env.POSTHOG_PROJECT_ID = '12345';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401s on a wrong bearer token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer nope' }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('500s when no secret is configured at all — fails closed, never open', async () => {
    delete process.env.CRON_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer anything' }));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a valid bearer through to the handler', async () => {
    // PostHog env is unset, so passing auth surfaces the 503 config error —
    // proof the request cleared the boundary rather than being rejected.
    const { GET } = await loadRoute();
    const response = await GET(get({ authorization: 'Bearer test-cron-secret' }));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain('POSTHOG_PERSONAL_API_KEY');
  });

  it('accepts the x-monitoring-secret operator path', async () => {
    delete process.env.CRON_SECRET;
    process.env.MONITORING_SECRET = 'test-monitoring-secret';

    const { GET } = await loadRoute();
    const response = await GET(get({ 'x-monitoring-secret': 'test-monitoring-secret' }));

    expect(response.status).toBe(503);
  });
});
