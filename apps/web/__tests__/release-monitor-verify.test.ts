import { describe, expect, it, vi } from 'vitest';
import { runReleaseVerification, type VerifyDeps } from '../lib/release-monitor/verify';
import { HOLDER_ROUTES } from '../lib/release-monitor/holderRoutes';
import type { ClinicianSession } from '../lib/release-monitor/syntheticClinician';

const session = { userId: 'u', orgId: 'o', sessionId: 's', jwt: 'j', clientUat: '1', cookies: {}, email: 'e' } as ClinicianSession;

function baseDeps(over: Partial<VerifyDeps> = {}): VerifyDeps {
  return {
    base: 'https://vitalcv.com',
    containerSha: 'abc',
    mainSha: 'abc',
    targetSha: 'abc',
    isoNow: () => '2026-07-03T00:00:00.000Z',
    probeResolving: async () => ({ status: 200 }),
    mint: async () => ({ ok: true, created: { userId: 'u', orgId: 'o' }, session }),
    warmUp: async () => ({ ok: true, hops: [{ url: '/holder', status: 200 }] }),
    refresh: async () => true,
    reach: async () => ({ ok: true, finalStatus: 200, finalUrl: '/holder', hops: 1 }),
    runDeployCheck: async () => ({ ok: true, detail: 'ok' }),
    cleanup: async () => ({ attempted: true, ok: true, detail: 'deleted' }),
    ...over,
  };
}

describe('runReleaseVerification', () => {
  it('passes when every check is green and always cleans up', async () => {
    const r = await runReleaseVerification(baseDeps());
    expect(r.overall).toBe('pass');
    expect(r.failedChecks).toEqual([]);
    // cold-start + the six routes
    expect(r.checks.filter((c) => c.name.startsWith('holder:')).length).toBe(HOLDER_ROUTES.length + 1);
    expect(r.cleanup.ok).toBe(true);
  });

  it('fails (critical) when the cold-start bounces to /auth/error', async () => {
    const r = await runReleaseVerification(
      baseDeps({ warmUp: async () => ({ ok: false, hops: [{ url: '/holder', status: 307, location: '/auth/error' }], reason: 'auth_error' }) }),
    );
    expect(r.overall).toBe('fail');
    expect(r.failedChecks).toContain('holder:cold-start');
  });

  it('fails when a single route is unreachable', async () => {
    let first = true;
    const r = await runReleaseVerification(
      baseDeps({
        reach: async (_s, p) => {
          if (first) {
            first = false;
            return { ok: false, finalStatus: 307, finalUrl: '/auth/error', hops: 2, reason: 'auth_error' };
          }
          return { ok: true, finalStatus: 200, finalUrl: p, hops: 1 };
        },
      }),
    );
    expect(r.overall).toBe('fail');
    expect(r.failedChecks).toContain(`holder:${HOLDER_ROUTES[0]}`);
  });

  it('skips holder checks and fails when mint fails, still cleaning up the created resources', async () => {
    const cleanup = vi.fn(async () => ({ attempted: true, ok: true, detail: 'deleted' }));
    const r = await runReleaseVerification(
      baseDeps({ mint: async () => ({ ok: false, created: { userId: 'u', orgId: 'o' }, error: 'clerk 500' }), cleanup }),
    );
    expect(r.overall).toBe('fail');
    expect(r.failedChecks).toContain('synthetic_session');
    expect(cleanup).toHaveBeenCalledWith({ userId: 'u', orgId: 'o' });
  });

  it('runs cleanup even when a probe throws (finally guarantee)', async () => {
    const cleanup = vi.fn(async () => ({ attempted: true, ok: true, detail: 'deleted' }));
    await expect(
      runReleaseVerification(
        baseDeps({
          mint: async () => ({ ok: true, created: { userId: 'u', orgId: 'o' }, session }),
          warmUp: async () => {
            throw new Error('boom');
          },
          cleanup,
        }),
      ),
    ).rejects.toThrow('boom');
    expect(cleanup).toHaveBeenCalledWith({ userId: 'u', orgId: 'o' });
  });

  it('fails the run (critical) when synthetic-identity cleanup fails — no green while leaking', async () => {
    const r = await runReleaseVerification(
      baseDeps({ cleanup: async () => ({ attempted: true, ok: false, detail: 'org 500, user 500' }) }),
    );
    expect(r.overall).toBe('fail');
    expect(r.failedChecks).toContain('cleanup');
    expect(r.checks.find((c) => c.name === 'cleanup')?.detail).toContain('NOT deleted');
  });

  it('does not add a cleanup check when cleanup succeeds', async () => {
    const r = await runReleaseVerification(baseDeps());
    expect(r.checks.some((c) => c.name === 'cleanup')).toBe(false);
  });

  it('treats SHA mismatch as critical for a deploy-scoped run, reported for a scheduled run', async () => {
    const deployScoped = await runReleaseVerification(baseDeps({ containerSha: 'old', targetSha: 'new', mainSha: 'new' }));
    expect(deployScoped.failedChecks).toContain('web_sha');

    const scheduled = await runReleaseVerification(baseDeps({ containerSha: 'old', targetSha: null, mainSha: 'new' }));
    expect(scheduled.failedChecks).not.toContain('web_sha');
    expect(scheduled.checks.find((c) => c.name === 'web_sha')?.ok).toBe(false);
  });
});
