/**
 * Wave LIVE-100C P0-A — /api/ingest/[npi] graceful fallback.
 *
 * Contract the homepage depends on:
 *   - Valid NPI + upstream 500 → HTTP 200 with body.fallback === true
 *     and body.reason === 'upstream_5xx'
 *   - Valid NPI + network error → HTTP 200 with body.reason === 'network'
 *   - Valid NPI + timeout       → HTTP 200 with body.reason === 'timeout'
 *   - Valid NPI + non-JSON body → HTTP 200 with body.reason === 'non_json'
 *   - Invalid NPI shape         → HTTP 400 (not 500)
 *   - Fallback body preserves truth: unavailable_is_not_blocked,
 *     access_required_is_not_clinician_fault, unknown_is_not_negative
 *   - Fallback lane list carries pending / access_required states only;
 *     never emits a fake "verified" state.
 *   - No secret material leaks into the response body (no backend URL,
 *     no org id, no x-org-id header echo).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../app/api/ingest/[npi]/route';

function mkReq(): NextRequest {
  return new NextRequest('http://localhost/api/ingest/1003000126', {
    method: 'POST',
  });
}

function paramsFor(npi: string) {
  return { params: Promise.resolve({ npi }) };
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('/api/ingest/[npi] fallback (P0-A)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects invalid NPI shape with 400 (not 500)', async () => {
    const res = await POST(mkReq(), paramsFor('not-a-number'));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.reason).toBe('invalid_npi');
  });

  it('returns graceful 200 fallback when upstream is a 5xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('upstream broke', { status: 503 }),
      ),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(false);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('upstream_5xx');
    expect(body.npi).toBe('1003000126');
    expect(Array.isArray(body.lanes)).toBe(true);
    expect(body.truth).toEqual({
      unavailable_is_not_blocked: true,
      access_required_is_not_clinician_fault: true,
      unknown_is_not_negative: true,
    });
  });

  it('returns graceful 200 fallback when upstream throws a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNRESET')),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('network');
  });

  it('returns graceful 200 fallback when upstream aborts (timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('timeout');
  });

  it('returns graceful 200 fallback when upstream returns non-JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html>oops</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('non_json');
  });

  it('never emits a fake "verified" lane state in the fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    const body = await readJson(res);
    const lanes = body.lanes as Array<{ state: string }>;
    const allowedStates = new Set(['pending', 'unavailable', 'access_required', 'stale']);
    for (const lane of lanes) {
      expect(allowedStates.has(lane.state)).toBe(true);
    }
  });

  it('does not leak secret header material into the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    const raw = JSON.stringify(await readJson(res)).toLowerCase();
    expect(raw).not.toContain('x-org-id');
    expect(raw).not.toContain('backend_url');
    expect(raw).not.toContain('railway');
  });

  it('passes a successful upstream response through verbatim', async () => {
    const upstreamBody = { ok: true, runId: 'run-1', lanes: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(upstreamBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toEqual(upstreamBody);
  });
});
