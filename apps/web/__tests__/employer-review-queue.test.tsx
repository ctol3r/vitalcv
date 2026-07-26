/**
 * Wave L — employer review queue web layer.
 *
 * - Queue proxy: identity from Clerk auth() only; no caller-supplied org is
 *   forwarded (the backend binds scope server-side).
 * - Batch proxy: body sanitized to known fields; bundleId never forwarded
 *   (per-clinician attribution); oversized batches rejected, never truncated.
 * - Surface: honest loading/signed-out/no-org states and honest head-start
 *   wording ("your organization still decides").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

import { ReviewQueueSurface } from '../components/review/ReviewQueueSurface';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadQueueRoute() {
  return import(new URL('../app/api/employer-review/queue/route.ts', import.meta.url).href);
}

async function loadBatchRoute() {
  return import(new URL('../app/api/employer-review/batch/route.ts', import.meta.url).href);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  authMock.mockReset();
  process.env.BACKEND_URL = 'http://backend.test';
});

describe('GET /api/employer-review/queue proxy', () => {
  it('rejects signed-out callers before touching the backend', async () => {
    authMock.mockResolvedValue({ userId: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadQueueRoute();
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest('http://localhost/api/employer-review/queue'));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only the Clerk identity and a bounded limit — never a caller-chosen org', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-employer-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, candidates: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await loadQueueRoute();
    const { NextRequest } = await import('next/server');
    const res = await GET(
      new NextRequest('http://localhost/api/employer-review/queue?limit=10&organizationId=someone-elses-org'),
    );

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://backend.test/api/employer-review/queue?limit=10');
    expect(url).not.toContain('organizationId');
    expect((init as { headers: Record<string, string> }).headers['x-clerk-user-id']).toBe('clerk-employer-1');
  });

  it('degrades to 503 when the backend is unreachable', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-employer-1' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    const { GET } = await loadQueueRoute();
    const { NextRequest } = await import('next/server');
    const res = await GET(new NextRequest('http://localhost/api/employer-review/queue'));

    expect(res.status).toBe(503);
  });
});

describe('POST /api/employer-review/batch proxy', () => {
  function batchRequest(body: unknown) {
    return import('next/server').then(({ NextRequest }) =>
      new NextRequest('http://localhost/api/employer-review/batch', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('rejects signed-out callers', async () => {
    authMock.mockResolvedValue({ userId: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadBatchRoute();
    const res = await POST(await batchRequest({ action: 'accept', entityIds: ['a'] }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed and oversized batches instead of truncating them', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-employer-1' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadBatchRoute();

    const badAction = await POST(await batchRequest({ action: 'approve-all', entityIds: ['a'] }));
    expect(badAction.status).toBe(400);

    const oversized = await POST(
      await batchRequest({ action: 'accept', entityIds: Array.from({ length: 26 }, (_, i) => `id-${i}`) }),
    );
    expect(oversized.status).toBe(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards a sanitized body: known fields only, bundleId and unknown keys dropped', async () => {
    authMock.mockResolvedValue({ userId: 'clerk-employer-1' });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await loadBatchRoute();
    const res = await POST(
      await batchRequest({
        action: 'request-refresh',
        entityIds: [' entity-1 ', 'entity-2'],
        staleSources: ['DEA_REGISTRY', 42, '  '],
        message: '  Please refresh your DEA record.  ',
        bundleId: 'bundle-should-not-forward',
        decisionGrade: true,
      }),
    );

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const forwarded = JSON.parse((init as { body: string }).body);
    expect(forwarded).toEqual({
      action: 'request-refresh',
      entityIds: ['entity-1', 'entity-2'],
      staleSources: ['DEA_REGISTRY'],
      message: 'Please refresh your DEA record.',
    });
    expect((init as { headers: Record<string, string> }).headers['x-clerk-user-id']).toBe('clerk-employer-1');
  });
});

describe('ReviewQueueSurface — honest states and wording', () => {
  it('renders the header and an honest loading state on first paint', () => {
    const markup = renderToStaticMarkup(<ReviewQueueSurface />);
    expect(markup).toContain('Review queue');
    expect(markup).toContain('Loading your queue');
  });

  it('keeps the head-start signal honest in source: soft signal, employer still decides', () => {
    const source = readFileSync(
      join(__dirname, '../components/review/ReviewQueueSurface.tsx'),
      'utf8',
    );
    expect(source).toContain('your organization still');
    expect(source).toContain('fail closed individually');
    expect(source).toContain('overrides a blocked readiness state');
    // Banned-strings + bare-Verified discipline on this new surface.
    expect(source).not.toMatch(/automatically verified|guaranteed verification|instant credentialing/i);
    expect(source).not.toMatch(/label:\s*['"]Verified['"]/);
  });
});
