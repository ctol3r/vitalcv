import { afterEach, describe, expect, it } from 'vitest';
import { getVersionInfo } from '../lib/deployInfo';
import { GET } from '../app/api/version/route';

const SNAPSHOT = { ...process.env };
afterEach(() => {
  process.env = { ...SNAPSHOT };
});

describe('getVersionInfo', () => {
  it('surfaces the full RAILWAY_GIT_COMMIT_SHA + deployment id', () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = 'a'.repeat(40);
    process.env.RAILWAY_GIT_BRANCH = 'main';
    process.env.RAILWAY_ENVIRONMENT = 'production';
    process.env.RAILWAY_DEPLOYMENT_ID = 'dep_1';

    const v = getVersionInfo();
    expect(v.service).toBe('web');
    expect(v.commit).toBe('a'.repeat(40));
    expect(v.commitShort).toBe('aaaaaaa');
    expect(v.branch).toBe('main');
    expect(v.environment).toBe('production');
    expect(v.deploymentId).toBe('dep_1');
  });

  it('falls back to GIT_SHA and reports an honest empty commit when unknown', () => {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_SHA;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_DEPLOYMENT_ID;

    const v = getVersionInfo();
    expect(v.commit).toBe('');
    expect(v.commitShort).toBe('local');
    expect(v.deploymentId).toBeNull();

    process.env.GIT_SHA = 'c'.repeat(40);
    expect(getVersionInfo().commit).toBe('c'.repeat(40));
  });
});

describe('GET /api/version', () => {
  it('returns the version JSON with a no-store cache header', async () => {
    process.env.RAILWAY_GIT_COMMIT_SHA = 'b'.repeat(40);
    const res = GET();
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    const body = (await res.json()) as { commit: string; service: string };
    expect(body.commit).toBe('b'.repeat(40));
    expect(body.service).toBe('web');
  });
});
