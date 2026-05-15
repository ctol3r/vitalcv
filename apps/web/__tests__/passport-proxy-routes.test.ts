import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildNppesResponse(overrides: Record<string, unknown> = {}) {
  return {
    results: [
      {
        basic: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          middle_name: 'M',
          status: 'A',
        },
        taxonomies: [
          {
            desc: 'Cardiology',
          },
        ],
        ...overrides,
      },
    ],
  };
}

const PASSPORT_RUNTIME_KEYS = [
  'entityId',
  'npi',
  'identity',
  'authority',
  'training',
  'standing',
  'readiness',
  'sources',
  'sourceCoverage',
  'trustPosture',
  'lastCheckedAt',
  'checkedAt',
  'lineageKey',
  'replayPosture',
  'continuityPosture',
  'issuerPosture',
  '_degraded',
  'truth',
];

const READINESS_KEYS = [
  'status',
  'score',
  'level',
  'blockers',
  'gaps',
  'estimatedStartDays',
  'nextActions',
];

const SOURCE_COVERAGE_KEYS = ['checks', 'summary'];
const SOURCE_SUMMARY_KEYS = [
  'checked',
  'stale',
  'pending',
  'gated',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'notDecisionGrade',
  'previewOnly',
];
const POSTURE_KEYS = ['status', 'label', 'detail'];
const TRUTH_KEYS = ['identity', 'safety', 'authority', 'eligibility'];
const POSTURE_STATUSES = ['verified', 'degraded', 'pending', 'unavailable', 'unverifiable'];

function asRecord(value: unknown): Record<string, unknown> {
  expect(value).toEqual(expect.any(Object));
  return value as Record<string, unknown>;
}

function expectRuntimePosture(value: unknown) {
  const posture = asRecord(value);
  expect(Object.keys(posture)).toEqual(POSTURE_KEYS);
  expect(POSTURE_STATUSES).toContain(posture.status);
  expect(posture.label).toEqual(expect.any(String));
  expect(posture.detail).toEqual(expect.any(String));
}

function expectStableRuntimeShape(body: Record<string, unknown>) {
  expect(Object.keys(body)).toEqual(PASSPORT_RUNTIME_KEYS);
  expect(Object.keys(asRecord(body.readiness))).toEqual(READINESS_KEYS);
  expect(Object.keys(asRecord(body.sourceCoverage))).toEqual(SOURCE_COVERAGE_KEYS);
  expect(Object.keys(asRecord(asRecord(body.sourceCoverage).summary))).toEqual(SOURCE_SUMMARY_KEYS);
  expect(Object.keys(asRecord(body.truth))).toEqual(TRUTH_KEYS);
  expect(typeof body._degraded).toBe('boolean');
  expect(body).toEqual(expect.objectContaining({
    checkedAt: expect.any(String),
    lineageKey: expect.any(String),
  }));
  expectRuntimePosture(body.replayPosture);
  expectRuntimePosture(body.continuityPosture);
  expectRuntimePosture(body.issuerPosture);

  const serializedBody = JSON.stringify(body).toLowerCase();
  expect(serializedBody).not.toContain('fetch failed');
  expect(serializedBody).not.toContain('backend_url');
  expect(serializedBody).not.toContain('backend unavailable');
  expect(serializedBody).not.toContain('localhost:4000');
  expect(serializedBody).not.toContain('typeerror');
  expect(serializedBody).not.toContain('upstream');
}

function lastInfoLog(): Record<string, unknown> {
  const call = vi.mocked(console.info).mock.calls.at(-1);
  expect(call?.[0]).toEqual(expect.any(String));
  return JSON.parse(String(call?.[0])) as Record<string, unknown>;
}

describe('passport runtime convergence routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('resolves /api/passport/npi/[npi] through the local NPPES probe and returns structured degraded passport truth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.includes('npiregistry.cms.hhs.gov')) {
          throw new Error(`unexpected fetch target: ${url}`);
        }
        return jsonResponse(buildNppesResponse());
      }),
    );

    const { GET } = await import('../app/api/passport/npi/[npi]/route');
    const response = await GET(new Request('http://localhost/api/passport/npi/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expectStableRuntimeShape(body as Record<string, unknown>);
    expect(body).toEqual(expect.objectContaining({
      entityId: '1234567890',
      npi: '1234567890',
      _degraded: true,
      identity: expect.objectContaining({
        displayName: 'Ada M Lovelace',
        status: 'active',
      }),
      readiness: expect.objectContaining({
        status: 'CHECKING',
      }),
      sourceCoverage: expect.objectContaining({
        summary: expect.objectContaining({
          checked: ['nppes_identity'],
          pending: ['oig_leie', 'state_board', 'pecos_public'],
        }),
      }),
    }));
    expect(body).toEqual(expect.objectContaining({
      replayPosture: expect.objectContaining({
        status: 'degraded',
      }),
      continuityPosture: expect.objectContaining({
        status: 'degraded',
      }),
      issuerPosture: expect.objectContaining({
        status: 'verified',
      }),
    }));
    expect(lastInfoLog()).toEqual(expect.objectContaining({
      component: 'passport-runtime',
      event: 'passport.runtime.hydration.success',
      route: '/api/passport/npi/[npi]',
      status: 'success',
      runtimeRole: 'passport-app-router',
      runtimeTopology: 'self-contained-app-router',
      entityKind: 'npi',
      entityFingerprint: expect.any(String),
      hydrationLatencyMs: expect.any(Number),
      degradedState: expect.objectContaining({
        emitted: true,
        category: 'source_incomplete',
        reason: expect.any(String),
      }),
      sourceAvailabilitySummary: {
        checked: 1,
        pending: 3,
      },
      sourceReachability: {
        reachable: 1,
        unavailable: 0,
        pending: 3,
        degraded: 0,
      },
      replayEmission: {
        emitted: true,
        status: 'degraded',
        lineageKeyPresent: true,
        checkedAtPresent: true,
      },
      continuityEmission: {
        emitted: true,
        status: 'degraded',
      },
      issuerEmission: {
        emitted: true,
        status: 'verified',
      },
      deploymentDiagnostics: expect.objectContaining({
        nodeEnv: expect.any(String),
        deploymentUrlPresent: expect.any(Boolean),
      }),
    }));
    const log = JSON.stringify(lastInfoLog());
    expect(log).not.toContain('1234567890');
    expect(log).not.toContain('Ada');
    expect(log).not.toContain('Lovelace');
  });

  it('returns truthful degraded passport JSON when the NPPES probe is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const { GET } = await import('../app/api/passport/[npi]/route');
    const response = await GET(new Request('http://localhost/api/passport/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expectStableRuntimeShape(body as Record<string, unknown>);
    expect(body).toEqual(expect.objectContaining({
      entityId: '1234567890',
      _degraded: true,
      identity: expect.objectContaining({
        displayName: 'Passport 1234567890',
      }),
      trustPosture: expect.objectContaining({
        band: 'degraded',
      }),
      sourceCoverage: expect.objectContaining({
        summary: expect.objectContaining({
          unavailable: ['nppes_identity'],
          pending: ['oig_leie', 'state_board', 'pecos_public'],
        }),
      }),
      replayPosture: expect.objectContaining({
        status: 'unavailable',
      }),
      continuityPosture: expect.objectContaining({
        status: 'unavailable',
      }),
      issuerPosture: expect.objectContaining({
        status: 'unavailable',
      }),
    }));
    expect(lastInfoLog()).toEqual(expect.objectContaining({
      degradedState: expect.objectContaining({
        emitted: true,
        category: 'source_unavailable',
      }),
      sourceReachability: {
        reachable: 0,
        unavailable: 1,
        pending: 3,
        degraded: 0,
      },
      replayEmission: expect.objectContaining({
        emitted: true,
        status: 'unavailable',
      }),
      continuityEmission: expect.objectContaining({
        emitted: true,
        status: 'unavailable',
      }),
      issuerEmission: expect.objectContaining({
        emitted: true,
        status: 'unavailable',
      }),
    }));
  });

  it('emits structured passport observability without raw identifiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => jsonResponse(buildNppesResponse())),
    );

    const { GET } = await import('../app/api/passport/npi/[npi]/route');
    await GET(new Request('http://localhost/api/passport/npi/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });

    const infoSpy = vi.mocked(console.info);
    const runtimeLog = infoSpy.mock.calls
      .flatMap(([entry]) => {
        try {
          return [JSON.parse(String(entry)) as Record<string, unknown>];
        } catch {
          return [];
        }
      })
      .find((entry) => entry.event === 'passport.runtime.hydration.success');

    expect(runtimeLog).toEqual(expect.objectContaining({
      component: 'passport-runtime',
      route: '/api/passport/npi/[npi]',
      status: 'success',
      runtimeRole: 'passport-app-router',
      runtimeTopology: 'self-contained-app-router',
      entityKind: 'npi',
      entityFingerprint: expect.any(String),
      hydrationLatencyMs: expect.any(Number),
      degradedState: expect.objectContaining({
        emitted: true,
        category: 'source_incomplete',
      }),
      replayEmission: expect.objectContaining({
        emitted: true,
        status: 'degraded',
        lineageKeyPresent: true,
        checkedAtPresent: true,
      }),
      continuityEmission: expect.objectContaining({
        emitted: true,
        status: 'degraded',
      }),
      issuerEmission: expect.objectContaining({
        emitted: true,
        status: 'verified',
      }),
      sourceAvailability: expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'nppes_identity',
          state: 'checked',
          checkedAtPresent: true,
        }),
      ]),
      sourceReachability: {
        reachable: 1,
        unavailable: 0,
        pending: 3,
        degraded: 0,
      },
    }));
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('1234567890');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('Ada');
  });

  it('returns self-contained degraded passport truth for UUID entity lookups without any backend fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { GET } = await import('../app/api/passport/entity/[id]/route');
    const response = await GET(new Request('http://localhost/api/passport/entity/entity-1') as never, {
      params: Promise.resolve({ id: 'entity-1' }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    const body = await response.json();
    expectStableRuntimeShape(body as Record<string, unknown>);
    expect(body).toEqual(expect.objectContaining({
      entityId: 'entity-1',
      _degraded: true,
      identity: expect.objectContaining({
        displayName: 'Passport entity-1',
        status: 'unknown',
      }),
      sourceCoverage: expect.objectContaining({
        summary: expect.objectContaining({
          unavailable: ['nppes_identity'],
          pending: ['oig_leie', 'state_board', 'pecos_public'],
        }),
      }),
      replayPosture: expect.objectContaining({
        status: 'unavailable',
      }),
    }));
  });

  it('keeps degraded and hydrated route payload shapes identical', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => jsonResponse(buildNppesResponse())),
    );

    const npiRoute = await import('../app/api/passport/npi/[npi]/route');
    const uuidRoute = await import('../app/api/passport/entity/[id]/route');

    const npiResponse = await npiRoute.GET(new Request('http://localhost/api/passport/npi/1234567890') as never, {
      params: Promise.resolve({ npi: '1234567890' }),
    });
    const uuidResponse = await uuidRoute.GET(new Request('http://localhost/api/passport/entity/entity-1') as never, {
      params: Promise.resolve({ id: 'entity-1' }),
    });

    const npiBody = await npiResponse.json();
    const uuidBody = await uuidResponse.json();

    expect(Object.keys(npiBody)).toEqual(Object.keys(uuidBody));
    expect(Object.keys(npiBody)).toMatchInlineSnapshot(`
      [
        "entityId",
        "npi",
        "identity",
        "authority",
        "training",
        "standing",
        "readiness",
        "sources",
        "sourceCoverage",
        "trustPosture",
        "lastCheckedAt",
        "checkedAt",
        "lineageKey",
        "replayPosture",
        "continuityPosture",
        "issuerPosture",
        "_degraded",
        "truth",
      ]
    `);
    expect(Object.keys(npiBody.readiness)).toMatchInlineSnapshot(`
      [
        "status",
        "score",
        "level",
        "blockers",
        "gaps",
        "estimatedStartDays",
        "nextActions",
      ]
    `);
    expect(Object.keys(npiBody.replayPosture)).toMatchInlineSnapshot(`
      [
        "status",
        "label",
        "detail",
      ]
    `);
    expect(Object.keys(npiBody.sourceCoverage.summary)).toMatchInlineSnapshot(`
      [
        "checked",
        "stale",
        "pending",
        "gated",
        "unavailable",
        "accessRequired",
        "reviewRequired",
        "notDecisionGrade",
        "previewOnly",
      ]
    `);
  });

  it('reports minimal runtime health without exposing transport internals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
        expect(String(input)).toContain('npiregistry.cms.hhs.gov');
        return jsonResponse({ results: [{}] });
      }),
    );

    const { GET } = await import('../app/api/runtime-health/route');
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({
      status: 'ok',
      checkedAt: expect.any(String),
      runtime: expect.objectContaining({
        mode: expect.any(String),
        nodeEnv: expect.any(String),
      }),
      passportHydration: expect.objectContaining({
        state: 'operational',
        degradedFallbackAvailable: true,
        runtimeContract: 'self-contained App Router passport JSON',
      }),
      sources: expect.objectContaining({
        nppes: expect.objectContaining({
          reachability: 'operational',
          httpStatus: 200,
          latencyMs: expect.any(Number),
        }),
      }),
      degradedMode: expect.objectContaining({
        active: false,
        structuredFallbackAvailable: true,
      }),
      deployment: expect.any(Object),
      deploymentSummary: expect.objectContaining({
        live: false,
        stale: false,
        productionReady: false,
        status: 'unavailable',
        canonicalProject: 'vcv-web',
        legacyProject: 'vitalcv',
      }),
    }));
    expect(JSON.stringify(body)).not.toContain('localhost');
    expect(JSON.stringify(body)).not.toContain('1346053246');
  });
});
