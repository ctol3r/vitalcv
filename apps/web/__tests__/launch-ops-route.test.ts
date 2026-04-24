import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/pilot-ops', () => ({
  fetchPilotOpsSummary: vi.fn(),
  requireAdminPilotSession: vi.fn(),
}));

vi.mock('@/lib/server/pilot-proof', () => ({
  fetchPilotProofSnapshot: vi.fn(),
}));

function buildQueueItem(
  overrides: Partial<{
    id: string;
    source: 'feedback' | 'support' | 'auth' | 'route_failure' | 'system_failure' | 'metric' | 'runtime' | 'manual';
    title: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    route: string | null;
    role: string | null;
    status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'KNOWN_ISSUE' | 'HOTFIX_QUEUED' | 'MITIGATED' | 'RESOLVED' | 'OPEN';
    owner: string | null;
    createdAt: string;
    updatedAt: string;
    eventType: string | null;
    blocking: boolean;
    entity: Record<string, unknown> | null;
    email: string | null;
    feedbackId: string | null;
    details: Record<string, unknown> | null;
    lastAction: {
      status: 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'KNOWN_ISSUE' | 'HOTFIX_QUEUED' | 'MITIGATED' | 'RESOLVED';
      owner: string | null;
      note: string | null;
      actorId: string | null;
      updatedAt: string;
    } | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'queue-1',
    source: overrides.source ?? 'runtime',
    title: overrides.title ?? 'Issue',
    message: overrides.message ?? 'Issue detail',
    severity: overrides.severity ?? 'high',
    route: overrides.route ?? '/passport',
    role: overrides.role ?? 'ADMIN',
    status: overrides.status ?? 'OPEN',
    owner: overrides.owner ?? null,
    createdAt: overrides.createdAt ?? '2026-04-22T18:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-22T18:00:00.000Z',
    eventType: overrides.eventType ?? null,
    blocking: overrides.blocking ?? true,
    entity: overrides.entity ?? null,
    email: overrides.email ?? null,
    feedbackId: overrides.feedbackId ?? null,
    details: overrides.details ?? null,
    lastAction: overrides.lastAction ?? null,
  };
}

function buildPilotOpsSummary(
  overrides: Partial<{
    generatedAt: string;
    metrics: Record<string, number>;
    queue: ReturnType<typeof buildQueueItem>[];
  }> = {},
) {
  return {
    generatedAt: overrides.generatedAt ?? '2026-04-22T20:00:00.000Z',
    metrics: {
      signIns: 3,
      onboardingStarted: 2,
      onboardingCompleted: 1,
      readinessViewed: 4,
      blockerOpened: 1,
      blockerResolved: 1,
      opportunityViewed: 2,
      applyStarted: 2,
      applySubmitted: 1,
      applicationDetailViewed: 1,
      feedbackSubmitted: 1,
      supportTriggered: 1,
      authFailures: 0,
      routeFailures: 2,
      openQueueItems: 2,
      criticalQueueItems: 1,
      applicationStatusViewed: 1,
      alertViewed: 1,
      walletViewed: 0,
      returnSession: 1,
      ...(overrides.metrics ?? {}),
    },
    queue: overrides.queue ?? [],
    baseline: {
      providerCount: 10,
      findingsCount: 5,
      storylineCount: 3,
      opportunitiesCount: 2,
      graphNodeCount: 20,
      graphEdgeCount: 21,
      activeApplications: 1,
      buildVersion: 'web@1.0.0',
      commitHash: 'abc12345',
      nodeVersion: 'v22.0.0',
    },
    surfaceControls: [],
  };
}

function buildLaunchReadiness(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    generatedAt: '2026-04-22T20:05:00.000Z',
    environment: {
      target: 'production',
      webOrigin: 'https://vitalcv.com',
      backendBase: 'https://api.vitalcv.com',
    },
    summary: {
      status: 'warn',
      label: 'Launch issues detected',
      detail: 'One route is currently failing.',
    },
    versions: {
      frontend: {
        version: 'web@1.0.0',
        sha: 'abc12345',
        deploymentId: 'dep-1',
        target: 'production',
        health: 'healthy',
        detail: 'Frontend ready',
      },
      backend: {
        version: 'api@1.0.0',
        sha: 'def67890',
        deploymentId: 'dep-2',
        target: 'production',
        health: 'healthy',
        detail: 'Backend ready',
      },
    },
    counts: {
      providers: 10,
      findings: 5,
      storylines: 3,
      graphNodes: 20,
      graphEdges: 21,
      actions: 2,
      employers: 1,
      opportunities: 4,
      applications: 1,
    },
    routeChecks: [
      {
        id: 'passport',
        label: 'Passport',
        href: '/passport',
        status: 'pass',
        httpStatus: 200,
        detail: 'Healthy',
      },
      {
        id: 'explore',
        label: 'Explore',
        href: '/explore',
        status: 'fail',
        httpStatus: 500,
        detail: 'Route failed.',
      },
    ],
    loopChecks: [],
    alerts: [],
    ...overrides,
  };
}

describe('/api/internal/launch-ops', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('keeps the 24-hour route report scoped to 24-hour queue telemetry while still surfacing live runtime failures', async () => {
    const { fetchPilotOpsSummary, requireAdminPilotSession } = await import('@/lib/server/pilot-ops');
    const { fetchPilotProofSnapshot } = await import('@/lib/server/pilot-proof');

    vi.mocked(requireAdminPilotSession).mockResolvedValue({
      ok: true,
      session: { userId: 'admin-1' },
    } as never);
    vi.mocked(fetchPilotProofSnapshot).mockResolvedValue(null);
    vi.mocked(fetchPilotOpsSummary).mockImplementation(async (hours?: number) => {
      if (hours === 24) {
        return buildPilotOpsSummary({
          generatedAt: '2026-04-22T20:00:00.000Z',
          queue: [
            buildQueueItem({
              id: 'route-1',
              source: 'route_failure',
              route: '/passport',
              updatedAt: '2026-04-22T18:00:00.000Z',
            }),
            buildQueueItem({
              id: 'runtime-1',
              source: 'runtime',
              route: '/passport',
              updatedAt: '2026-04-22T19:00:00.000Z',
            }),
            buildQueueItem({
              id: 'feedback-1',
              source: 'feedback',
              route: '/review/entity-1',
              blocking: false,
              severity: 'medium',
              updatedAt: '2026-04-22T19:30:00.000Z',
            }),
            buildQueueItem({
              id: 'support-1',
              source: 'support',
              route: '/review/entity-1',
              blocking: false,
              severity: 'high',
              updatedAt: '2026-04-22T19:45:00.000Z',
            }),
          ],
        }) as never;
      }

      return buildPilotOpsSummary({
        queue: [
          buildQueueItem({
            id: 'known-1',
            source: 'manual',
            status: 'KNOWN_ISSUE',
            route: '/review/entity-2',
            updatedAt: '2026-04-22T19:50:00.000Z',
            blocking: false,
            details: { path: '/review/entity-2', workaround: 'Fallback workaround' },
            lastAction: {
              status: 'KNOWN_ISSUE',
              owner: 'ops-1',
              note: 'Use manual review until the state board source recovers.',
              actorId: 'ops-1',
              updatedAt: '2026-04-22T19:50:00.000Z',
            },
          }),
        ],
      }) as never;
    });

    vi.mocked(global.fetch).mockResolvedValue(new Response(
      JSON.stringify(buildLaunchReadiness()),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ) as never);

    const { GET } = await import('../app/api/internal/launch-ops/route');
    const { NextRequest } = await import('next/server');

    const response = await GET(new NextRequest('http://localhost/api/internal/launch-ops'));
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot.report24h.topFailingRoutes).toEqual([
      { route: '/passport', count: 2 },
    ]);
    expect(snapshot.report24h.topConfusingSurfaces).toEqual([
      { route: '/review/entity-1', count: 2 },
    ]);
    expect(snapshot.triageIssues.some((issue: { id: string; route: string }) => (
      issue.id === 'runtime:route:explore' && issue.route === '/explore'
    ))).toBe(true);
  });

  it('builds stable known-issue playbooks and ordered support items across multiple cases', async () => {
    const { fetchPilotOpsSummary, requireAdminPilotSession } = await import('@/lib/server/pilot-ops');
    const { fetchPilotProofSnapshot } = await import('@/lib/server/pilot-proof');

    vi.mocked(requireAdminPilotSession).mockResolvedValue({
      ok: true,
      session: { userId: 'admin-1' },
    } as never);
    vi.mocked(fetchPilotProofSnapshot).mockResolvedValue(null);
    vi.mocked(fetchPilotOpsSummary).mockImplementation(async (hours?: number) => {
      const queue = [
        buildQueueItem({
          id: 'support-new',
          source: 'support',
          route: '/review/entity-9',
          updatedAt: '2026-04-22T19:55:00.000Z',
          email: 'ops@hospital.org',
        }),
        buildQueueItem({
          id: 'feedback-old',
          source: 'feedback',
          route: '/passport',
          updatedAt: '2026-04-22T19:10:00.000Z',
          email: 'feedback@hospital.org',
        }),
        buildQueueItem({
          id: 'issue-new',
          source: 'manual',
          status: 'KNOWN_ISSUE',
          route: '/review/entity-9',
          updatedAt: '2026-04-22T19:58:00.000Z',
          blocking: false,
          details: { path: '/review/entity-9', workaround: 'Legacy note' },
          lastAction: {
            status: 'KNOWN_ISSUE',
            owner: 'ops-2',
            note: 'Route to manual review until data refresh completes.',
            actorId: 'ops-2',
            updatedAt: '2026-04-22T19:58:00.000Z',
          },
        }),
        buildQueueItem({
          id: 'issue-old',
          source: 'manual',
          status: 'MITIGATED',
          route: '/passport',
          updatedAt: '2026-04-22T19:20:00.000Z',
          blocking: false,
          details: { path: '/passport', workaround: 'Older workaround' },
          lastAction: null,
        }),
      ];

      return buildPilotOpsSummary({ generatedAt: hours === 24 ? '2026-04-22T20:00:00.000Z' : '2026-04-22T20:05:00.000Z', queue }) as never;
    });

    vi.mocked(global.fetch).mockResolvedValue(new Response(
      JSON.stringify(buildLaunchReadiness()),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ) as never);

    const { GET } = await import('../app/api/internal/launch-ops/route');
    const { NextRequest } = await import('next/server');

    const response = await GET(new NextRequest('http://localhost/api/internal/launch-ops'));
    const snapshot = await response.json();

    expect(response.status).toBe(200);
    expect(snapshot.supportItems.map((item: { id: string }) => item.id)).toEqual([
      'support-new',
      'feedback-old',
    ]);
    expect(snapshot.knownIssues.map((item: { id: string }) => item.id)).toEqual([
      'issue-new',
      'issue-old',
    ]);
    expect(snapshot.knownIssues[0]).toEqual(expect.objectContaining({
      id: 'issue-new',
      affectedFlow: '/review/entity-9',
      workaround: 'Route to manual review until data refresh completes.',
    }));
    expect(snapshot.knownIssues[1]).toEqual(expect.objectContaining({
      id: 'issue-old',
      affectedFlow: '/passport',
      workaround: 'Older workaround',
    }));
  });
});
