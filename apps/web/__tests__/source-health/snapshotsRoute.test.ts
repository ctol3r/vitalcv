import { describe, expect, it } from 'vitest';

import { __handleForTests } from '@/app/api/internal/source-health/snapshots/route';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

const env = { cronSecret: 'good-cron', monitoringSecret: 'good-mon' };

describe('GET /api/internal/source-health/snapshots', () => {
  it('401 without auth headers', async () => {
    const req = new Request('https://x.test/api/internal/source-health/snapshots');
    const res = await __handleForTests(req, {
      getAllSnapshots: () => [],
      authEnv: env,
    });
    expect(res.status).toBe(401);
  });

  it('200 honest empty array when store is cold', async () => {
    const req = new Request('https://x.test/api/internal/source-health/snapshots', {
      headers: { Authorization: 'Bearer good-cron' },
    });
    const res = await __handleForTests(req, {
      getAllSnapshots: () => [],
      authEnv: env,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toEqual([]);
    expect(body.observedAt).toBeNull();
  });

  it('200 with snapshots and newest observedAt', async () => {
    const snaps: SourceHealthSnapshot[] = [
      {
        sourceId: 'NPPES',
        state: 'LIVE',
        reason: 'http_200',
        lastSuccessAt: '2024-06-01T12:00:00.000Z',
        lastErrorAt: null,
        lastLatencyMs: 30,
        observedAt: '2024-06-01T12:00:00.000Z',
      },
      {
        sourceId: 'PECOS',
        state: 'DEGRADED',
        reason: 'http_503',
        lastSuccessAt: null,
        lastErrorAt: '2024-06-01T13:00:00.000Z',
        lastLatencyMs: 50,
        observedAt: '2024-06-01T13:00:00.000Z',
      },
    ];
    const req = new Request('https://x.test/api/internal/source-health/snapshots', {
      headers: { 'x-monitoring-secret': 'good-mon' },
    });
    const res = await __handleForTests(req, {
      getAllSnapshots: () => snaps,
      authEnv: env,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toHaveLength(2);
    expect(body.observedAt).toBe('2024-06-01T13:00:00.000Z');

    const text = JSON.stringify(body).toLowerCase();
    for (const banned of [
      '"headers"',
      '"body"',
      '"payload"',
      '"npi"',
      '"firstname"',
      '"lastname"',
    ]) {
      expect(text).not.toContain(banned);
    }
  });

  it('500 when both auth secrets unset', async () => {
    const req = new Request('https://x.test/api/internal/source-health/snapshots', {
      headers: { Authorization: 'Bearer anything' },
    });
    const res = await __handleForTests(req, {
      getAllSnapshots: () => [],
      authEnv: { cronSecret: undefined, monitoringSecret: undefined },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'no probe auth configured' });
  });
});
