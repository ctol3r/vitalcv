import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('/api/ingest/[npi] fallback', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects invalid NPI shape with 400, not 500', async () => {
    const res = await POST(mkReq(), paramsFor('not-a-number'));
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.reason).toBe('invalid_npi');
  });

  it('returns a graceful 200 fallback when upstream is a 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('upstream broke', { status: 503 })));

    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(false);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('upstream_5xx');
    expect(body.npi).toBe('1003000126');
    expect(Array.isArray(body.lanes)).toBe(true);
    expect(body.truth).toMatchObject({
      unavailable_is_not_blocked: true,
      access_required_is_not_clinician_fault: true,
      unknown_is_not_negative: true,
    });
  });

  it('returns a graceful 200 fallback when upstream throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.fallback).toBe(true);
    expect(body.reason).toBe('network');
  });

  it('returns a graceful 200 fallback when upstream aborts', async () => {
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

  it('returns a graceful 200 fallback when upstream returns non-JSON', async () => {
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

  it('never emits a fake verified lane state in the fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    const res = await POST(mkReq(), paramsFor('1003000126'));
    const body = await readJson(res);
    const lanes = body.lanes as Array<{ state: string }>;
    const allowedStates = new Set([
      'source_backed',
      'pending',
      'unavailable',
      'access_required',
      'stale',
    ]);
    for (const lane of lanes) {
      expect(allowedStates.has(lane.state)).toBe(true);
    }
  });

  it('LIVE-101 — every fallback lane carries an honest cadence', async () => {
    // Backend down + NPPES public registry also down: every lane should
    // still have a cadence label so the consumer never mistakes any
    // lane for a real-time feed.
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('http') && url.includes('npiregistry')) {
        return Promise.resolve(new Response('', { status: 503 }));
      }
      return Promise.resolve(new Response('', { status: 503 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(mkReq(), paramsFor('1003000126'));
    const body = await readJson(res);
    const lanes = body.lanes as Array<{ source: string; state: string; cadence: string; detail: string }>;
    const bySource = Object.fromEntries(lanes.map((l) => [l.source, l]));

    expect(bySource.NPPES.cadence).toBe('live');
    expect(bySource.OIG_LEIE.cadence).toBe('monthly');
    expect(bySource.PECOS_PUBLIC.cadence).toBe('quarterly');
    expect(bySource.STATE_BOARD.cadence).toBe('lane_dependent');

    // Detail copy must explicitly reject real-time framing for OIG/LEIE + PECOS.
    expect(bySource.OIG_LEIE.detail.toLowerCase()).toContain('not a real-time oig feed');
    expect(bySource.PECOS_PUBLIC.detail.toLowerCase()).toContain('not the real-time pecos portal');
  });

  it('LIVE-101 — recovers source-backed NPPES identity when only the backend is down', async () => {
    const nppesBody = {
      results: [
        {
          enumeration_type: 'NPI-1',
          basic: {
            first_name: 'Recovered',
            last_name: 'Identity',
            status: 'A',
            enumeration_date: '2010-01-01',
            last_updated: '2026-04-01',
          },
          taxonomies: [{ code: '207R00000X', desc: 'Internal Medicine', primary: true }],
          addresses: [{ address_purpose: 'LOCATION', state: 'CA' }],
        },
      ],
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('npiregistry')) {
        return Promise.resolve(
          new Response(JSON.stringify(nppesBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(mkReq(), paramsFor('1003000126'));
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.fallback).toBe(true);
    expect(body.ok).toBe(true);
    const lanes = body.lanes as Array<{
      source: string;
      state: string;
      cadence: string;
      identity?: { displayName: string };
    }>;
    const nppesLane = lanes.find((l) => l.source === 'NPPES')!;
    expect(nppesLane.state).toBe('source_backed');
    expect(nppesLane.cadence).toBe('live');
    expect(nppesLane.identity?.displayName).toBe('Recovered Identity');
  });

  it('LIVE-101 — keeps STATE_BOARD on access_required even when NPPES recovers', async () => {
    const nppesBody = {
      results: [
        {
          enumeration_type: 'NPI-1',
          basic: { first_name: 'A', last_name: 'B', status: 'A' },
          taxonomies: [],
          addresses: [],
        },
      ],
    };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('npiregistry')) {
        return Promise.resolve(
          new Response(JSON.stringify(nppesBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 500 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(mkReq(), paramsFor('1003000126'));
    const body = await readJson(res);
    const lanes = body.lanes as Array<{ source: string; state: string; detail: string }>;
    const stateBoard = lanes.find((l) => l.source === 'STATE_BOARD')!;
    expect(stateBoard.state).toBe('access_required');
    expect(stateBoard.detail.toLowerCase()).toContain('institutional access');
    expect(stateBoard.detail.toLowerCase()).toContain('not a clinician');
  });

  it('LIVE-101 — truth block carries the new source-cadence guarantees', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

    const res = await POST(mkReq(), paramsFor('1003000126'));
    const body = await readJson(res);
    expect(body.truth).toMatchObject({
      unavailable_is_not_blocked: true,
      access_required_is_not_clinician_fault: true,
      unknown_is_not_negative: true,
      nppes_is_identity_only: true,
      oig_leie_is_not_real_time: true,
      pecos_public_is_not_real_time: true,
    });
  });

  it('does not leak secret header material into the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

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
