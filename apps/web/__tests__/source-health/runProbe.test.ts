import { describe, expect, it } from 'vitest';

import {
  runProbe,
  type ProbeFetcher,
} from '@/lib/source-health/probes/runProbe';

const fixedNow = () => new Date('2024-06-01T12:00:00.000Z');

function makeFetcher(impl: ProbeFetcher): ProbeFetcher {
  return impl;
}

describe('runProbe state mapping', () => {
  it('maps 2xx to LIVE', async () => {
    const fetcher = makeFetcher(async () => ({ status: 200, ok: true }));
    const snap = await runProbe('NPPES', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('LIVE');
    expect(snap.lastSuccessAt).toBe('2024-06-01T12:00:00.000Z');
    expect(snap.lastErrorAt).toBeNull();
    expect(snap.reason).toBe('http_200');
  });

  it('maps 5xx to DEGRADED', async () => {
    const fetcher = makeFetcher(async () => ({ status: 503, ok: false }));
    const snap = await runProbe('OIG_LEIE', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('DEGRADED');
    expect(snap.lastSuccessAt).toBeNull();
    expect(snap.lastErrorAt).toBe('2024-06-01T12:00:00.000Z');
    expect(snap.reason).toBe('http_503');
  });

  it('maps 429 to RATE_LIMITED', async () => {
    const fetcher = makeFetcher(async () => ({ status: 429, ok: false }));
    const snap = await runProbe('PECOS', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('RATE_LIMITED');
    expect(snap.reason).toBe('http_429');
  });

  it('maps a network error (rejection) to UNAVAILABLE', async () => {
    const fetcher = makeFetcher(async () => {
      throw new Error('ECONNRESET');
    });
    const snap = await runProbe('NPPES', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('UNAVAILABLE');
    expect(snap.reason).toBe('network_error');
  });

  it('maps a network error reported via outcome.error to UNAVAILABLE', async () => {
    const fetcher = makeFetcher(async () => ({ error: new Error('boom') }));
    const snap = await runProbe('NPPES', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('UNAVAILABLE');
    expect(snap.reason).toBe('network_error');
  });

  it('maps timeout (signal aborted) to UNAVAILABLE', async () => {
    const fetcher = makeFetcher(({ signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const snap = await runProbe('NPPES', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 5,
    });
    expect(snap.state).toBe('UNAVAILABLE');
    expect(snap.reason).toBe('probe_timeout');
  });

  it('maps an unrecognized response (no status, no error) to UNKNOWN', async () => {
    const fetcher = makeFetcher(async () => ({}));
    const snap = await runProbe('STATE_BOARD', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.state).toBe('UNKNOWN');
    expect(snap.reason).toBe('no_status');
  });

  it('never throws even when fetcher rejects synchronously', async () => {
    const fetcher = makeFetcher(() => {
      throw new Error('synchronous boom');
    });
    await expect(
      runProbe('NPPES', fetcher, {
        fetchImpl: (() => {}) as unknown as typeof fetch,
        now: fixedNow,
        timeoutMs: 1000,
      }),
    ).resolves.toBeDefined();
  });

  it('records lastLatencyMs as a non-negative number', async () => {
    const fetcher = makeFetcher(async () => ({ status: 200, ok: true }));
    const snap = await runProbe('NPPES', fetcher, {
      fetchImpl: (() => {}) as unknown as typeof fetch,
      now: fixedNow,
      timeoutMs: 1000,
    });
    expect(snap.lastLatencyMs).not.toBeNull();
    expect(snap.lastLatencyMs!).toBeGreaterThanOrEqual(0);
  });
});
