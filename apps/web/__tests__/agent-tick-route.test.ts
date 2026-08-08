/**
 * A2.1 — the tick route's machine-auth boundary.
 *
 * Separate file from the tick-semantics suite on purpose: mocking the tick
 * module hoists to the top of a file, so a route test living beside a direct
 * test of the same module would silently mock the thing under test.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const NOW = new Date('2026-08-08T12:00:00.000Z');

const tickMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/agent/schedule/tick', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agent/schedule/tick')>(
    '@/lib/agent/schedule/tick',
  );
  return { ...actual, runAgentTick: tickMock };
});

describe('POST /api/internal/agent/tick', () => {

  async function loadRoute() {
    return import(new URL('../app/api/internal/agent/tick/route.ts', import.meta.url).href);
  }

  function post(url: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(url, { method: 'POST', headers });
  }

  beforeEach(() => {
    vi.resetModules();
    tickMock.mockReset();
    tickMock.mockResolvedValue({
      mode: 'shadow',
      dryRun: false,
      startedAt: NOW.toISOString(),
      elapsedMs: 5,
      claimed: 1,
      succeeded: 1,
      failed: 0,
      outcomes: [],
      summary: { enrolled: 1, enabled: 1, due: 0 },
    });
    process.env.CRON_SECRET = 'test-cron-secret';
    delete process.env.MONITORING_SECRET;
  });

  it('401s without a secret', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post('http://localhost/api/internal/agent/tick'));
    expect(response.status).toBe(401);
    expect(tickMock).not.toHaveBeenCalled();
  });

  it('401s on a wrong secret', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post('http://localhost/api/internal/agent/tick', { authorization: 'Bearer nope' }),
    );
    expect(response.status).toBe(401);
  });

  it('500s when no secret is configured at all — fails closed, never open', async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await loadRoute();
    const response = await POST(
      post('http://localhost/api/internal/agent/tick', { authorization: 'Bearer anything' }),
    );
    expect(response.status).toBe(500);
    expect(tickMock).not.toHaveBeenCalled();
  });

  it('runs a tick with a valid bearer', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post('http://localhost/api/internal/agent/tick?source=cron', {
        authorization: 'Bearer test-cron-secret',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: 'cron', mode: 'shadow' });
  });

  it('labels an unknown source as manual rather than echoing it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      post('http://localhost/api/internal/agent/tick?source=<script>', {
        authorization: 'Bearer test-cron-secret',
      }),
    );
    expect((await response.json()).source).toBe('manual');
  });

  it('clamps limit and rejects a nonsense one', async () => {
    const { POST } = await loadRoute();
    await POST(
      post('http://localhost/api/internal/agent/tick?limit=9999', {
        authorization: 'Bearer test-cron-secret',
      }),
    );
    expect(tickMock.mock.calls[0][0].limit).toBe(50);

    const bad = await POST(
      post('http://localhost/api/internal/agent/tick?limit=0', {
        authorization: 'Bearer test-cron-secret',
      }),
    );
    expect(bad.status).toBe(400);
  });

  it('only turns dry-run off when explicitly asked', async () => {
    const { POST } = await loadRoute();
    await POST(
      post('http://localhost/api/internal/agent/tick', { authorization: 'Bearer test-cron-secret' }),
    );
    expect(tickMock.mock.calls[0][0].dryRun).toBeUndefined();

    await POST(
      post('http://localhost/api/internal/agent/tick?dryRun=false', {
        authorization: 'Bearer test-cron-secret',
      }),
    );
    expect(tickMock.mock.calls[1][0].dryRun).toBe(false);
  });
});
