import { describe, expect, it } from 'vitest';

import { __handleForTests } from '@/app/api/internal/source-health/probe/route';
import type { SourceHealthSnapshot } from '@/lib/source-health/sourceHealthTypes';

const FAKE_SNAPSHOT: SourceHealthSnapshot = {
  sourceId: 'NPPES',
  state: 'LIVE',
  reason: 'http_200',
  lastSuccessAt: '2024-06-01T12:00:00.000Z',
  lastErrorAt: null,
  lastLatencyMs: 42,
  observedAt: '2024-06-01T12:00:00.000Z',
};

const FAKE_RESULT = {
  snapshots: [FAKE_SNAPSHOT],
  durationMs: 100,
  errors: [],
};

const stubRunner = async () => FAKE_RESULT;

describe('POST /api/internal/source-health/probe — auth', () => {
  it('401 when no auth headers and a secret IS configured', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'unauthorized' });
  });

  it('401 on wrong Bearer token', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(401);
  });

  it('401 on wrong x-monitoring-secret', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { 'x-monitoring-secret': 'wrong' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(401);
  });

  it('200 with safe snapshot shape on correct Bearer token', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-cron' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0].sourceId).toBe('NPPES');
    expect(body.snapshots[0].state).toBe('LIVE');
    expect(body.durationMs).toBe(100);
    expect(body.errors).toEqual([]);
  });

  it('200 on correct x-monitoring-secret', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { 'x-monitoring-secret': 'good-mon' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(200);
  });

  it('GET also works for cron callers', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'GET',
      headers: { Authorization: 'Bearer good-cron' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    expect(res.status).toBe(200);
  });

  it('500 when both env secrets are unset', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer anything' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: undefined, monitoringSecret: undefined },
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'no probe auth configured' });
  });

  it('still 500 when both secrets are empty strings', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer anything' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: '', monitoringSecret: '' },
    });
    expect(res.status).toBe(500);
  });

  it('only cronSecret configured: monitoring header rejected, bearer accepted', async () => {
    const baseEnv = { cronSecret: 'only-cron', monitoringSecret: undefined };
    const req1 = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { 'x-monitoring-secret': 'anything' },
    });
    const r1 = await __handleForTests(req1, {
      runProbes: stubRunner,
      authEnv: baseEnv,
    });
    expect(r1.status).toBe(401);

    const req2 = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer only-cron' },
    });
    const r2 = await __handleForTests(req2, {
      runProbes: stubRunner,
      authEnv: baseEnv,
    });
    expect(r2.status).toBe(200);
  });

  it('response body MUST NOT contain raw payload, headers, npi, or PII fields', async () => {
    const req = new Request('https://x.test/api/internal/source-health/probe', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-cron' },
    });
    const res = await __handleForTests(req, {
      runProbes: stubRunner,
      authEnv: { cronSecret: 'good-cron', monitoringSecret: 'good-mon' },
    });
    const text = await res.text();
    const lowered = text.toLowerCase();
    for (const banned of [
      '"headers"',
      '"body"',
      '"payload"',
      '"npi"',
      '"firstname"',
      '"lastname"',
      '"first_name"',
      '"last_name"',
      '"email"',
      '"ssn"',
      '"dob"',
    ]) {
      expect(lowered).not.toContain(banned);
    }
    // sanity: shape we DO expect
    expect(lowered).toContain('"snapshots"');
    expect(lowered).toContain('"durationms"');
  });
});
