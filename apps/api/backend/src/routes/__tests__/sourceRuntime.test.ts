import express from 'express';
import request from 'supertest';
import {
  registerSourceRuntimeRoutes,
  __resetSourceRuntimeCache,
  type SourceRuntimeRouteDependencies,
} from '../sourceRuntime';
import type { SourceRuntimeState } from '../../services/identity/sourceRuntimeState';

function runtime(overrides: Partial<SourceRuntimeState> = {}): SourceRuntimeState {
  return {
    sourceId: 'NPPES_API',
    sourceName: 'CMS NPI Registry API',
    registered: true,
    adapterImplemented: true,
    canonicalEntryPoint: 'identityIngestionPipeline.handlers.NPPES_API',
    enabled: true,
    credentialsPresent: null,
    catalogLiveAvailable: true,
    runtimeState: 'live',
    lastRunStatus: 'success',
    latestRunRawStatus: 'VERIFIED',
    lastSuccessfulAt: '2026-07-31T07:00:00.000Z',
    lastArtifactId: 'artifact-1',
    freshnessStatus: 'current',
    freshnessWindowHours: 168,
    decisionGradeEligible: true,
    isLive: true,
    limitation: null,
    computedAt: '2026-07-31T08:00:00.000Z',
    ...overrides,
  };
}

function appWith(dependencies: SourceRuntimeRouteDependencies) {
  const app = express();
  registerSourceRuntimeRoutes(app, dependencies);
  return app;
}

// The list cache is module-level state, which is correct in production and a
// hazard in a test file: a cached 200 from one case was served to the case that
// asserts a failure returns 503. Reset before every test, not just the new ones.
beforeEach(() => {
  __resetSourceRuntimeCache();
});

describe('source runtime transparency routes', () => {
  test('lists runtime state with a no-store response', async () => {
    const response = await request(appWith({
      listStates: async () => [runtime()],
    })).get('/api/system/source-runtime');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.sources).toHaveLength(1);
    expect(response.body.liveDefinition).toContain('successful fresh persisted run');
  });

  test('normalizes a source id and returns one no-store state', async () => {
    const getState = jest.fn(async (sourceId: string) =>
      sourceId === 'NPPES_API' ? runtime() : null,
    );
    const response = await request(appWith({ getState }))
      .get('/api/system/source-runtime/nppes_api');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(getState).toHaveBeenCalledWith('NPPES_API');
    expect(response.body.sourceId).toBe('NPPES_API');
  });

  test('unknown sources fail closed with a no-store 404', async () => {
    const response = await request(appWith({
      getState: async () => null,
    })).get('/api/system/source-runtime/unknown');

    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      error: 'source_not_registered',
      sourceId: 'UNKNOWN',
    });
  });

  test('runtime-store failures return a no-store 503 and no false-clear language', async () => {
    const response = await request(appWith({
      listStates: async () => {
        throw new Error('database unavailable');
      },
    })).get('/api/system/source-runtime');

    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.error).toBe('source_runtime_unavailable');
    expect(response.body.error_description).toContain(
      'No source should be inferred live or clear',
    );
  });
});

describe('what an anonymous caller receives', () => {
  // `findLatestArtifact` is scoped by SOURCE with no NPI scoping, so
  // `lastArtifactId` is a real clinician's artifact id. Six routes dereference
  // an `:artifactId`; all six are tenant-guarded today. Publishing the id would
  // make that containment load-bearing for a field nothing consumes.
  it('never publishes lastArtifactId in the list', async () => {
    const app = express();
    registerSourceRuntimeRoutes(app, {
      listStates: async () => [runtime({ lastArtifactId: 'artifact-belonging-to-a-person' })],
    });

    const res = await request(app).get('/api/system/source-runtime').expect(200);

    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0]).not.toHaveProperty('lastArtifactId');
    expect(JSON.stringify(res.body)).not.toContain('artifact-belonging-to-a-person');
    // The liveness signal the id was never needed for.
    expect(res.body.sources[0].lastSuccessfulAt).toBe('2026-07-31T07:00:00.000Z');
    expect(res.body.sources[0].freshnessStatus).toBe('current');
  });

  it('never publishes lastArtifactId on the single-source route', async () => {
    const app = express();
    registerSourceRuntimeRoutes(app, {
      getState: async () => runtime({ lastArtifactId: 'artifact-belonging-to-a-person' }),
    });

    const res = await request(app).get('/api/system/source-runtime/NPPES_API').expect(200);

    expect(res.body).not.toHaveProperty('lastArtifactId');
    expect(JSON.stringify(res.body)).not.toContain('artifact-belonging-to-a-person');
    expect(res.body.sourceId).toBe('NPPES_API');
  });

  // A list response costs three queries per registered source. Unauthenticated
  // and uncached that is a denial-of-service surface, so repeated reads must
  // not each reach the database.
  it('serves repeat reads from cache instead of re-querying', async () => {
    let calls = 0;
    const app = express();
    registerSourceRuntimeRoutes(app, {
      listStates: async () => {
        calls += 1;
        return [runtime()];
      },
    });

    const first = await request(app).get('/api/system/source-runtime').expect(200);
    const second = await request(app).get('/api/system/source-runtime').expect(200);

    expect(calls).toBe(1);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    // A cached body must still say when it was computed, so age is readable
    // rather than inferred.
    expect(second.body.computedAt).toBe(first.body.computedAt);
  });

  it('does not cache a failure', async () => {
    let calls = 0;
    const app = express();
    registerSourceRuntimeRoutes(app, {
      listStates: async () => {
        calls += 1;
        throw new Error('database unavailable');
      },
    });

    await request(app).get('/api/system/source-runtime').expect(503);
    await request(app).get('/api/system/source-runtime').expect(503);

    expect(calls).toBe(2);
  });
});
