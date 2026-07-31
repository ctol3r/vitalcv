import express from 'express';
import request from 'supertest';
import {
  registerSourceRuntimeRoutes,
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
