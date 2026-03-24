import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('/pilot-ops page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.MONITORING_SECRET = 'monitoring-secret';
  });

  it('renders launch-gate criteria as read-only guidance, not interactive checkboxes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        generatedAt: '2026-03-23T12:00:00.000Z',
        windowDays: 90,
        since: '2026-01-01T00:00:00.000Z',
        appliedFilter: {
          pilotId: null,
          workflowLane: null,
          orgContextId: null,
          geographyTag: null,
        },
        isFiltered: false,
        packetShares: {
          total: 3,
          distinctEntities: 2,
          distinctOrgs: 1,
          byDeliveryStatus: { DELIVERED: 3 },
          earliestSharedAt: '2026-03-01T00:00:00.000Z',
          latestSharedAt: '2026-03-22T00:00:00.000Z',
        },
        reviewsOpened: {
          total: 2,
          distinctEntities: 2,
          byOrgContext: [],
          earliestAt: '2026-03-02T00:00:00.000Z',
          latestAt: '2026-03-22T00:00:00.000Z',
        },
        decisions: {
          total: 1,
          byType: { PROCEED: 1 },
          proceedCount: 1,
          refreshCount: 0,
          routeCount: 0,
          rejectCount: 0,
          holdCount: 0,
        },
        velocity: {
          medianDaysFirstReviewToDecision: 2,
          medianDaysFirstReviewToReady: 4,
          medianDaysFirstReviewToStart: 7,
          medianDaysShareToDecision: 3,
          sampleSizes: {
            reviewToDecision: 1,
            reviewToReady: 1,
            reviewToStart: 1,
            shareToDecision: 1,
          },
        },
        blockers: [],
        startOutcomes: {
          totalStarts: 1,
          distinctEntities: 1,
          readinessAtStart: {
            avgScore: 88,
            medianScore: 88,
            withBlockers: 0,
          },
        },
        eventChain: {
          bundleShareEvents: 3,
          advisoryOutcomeEvents: 2,
          employerDecisionEvents: 1,
          blockerResolutionEvents: 0,
          startOutcomeEvents: 1,
          employerAcceptances: 1,
          startAttestations: 1,
        },
        gaps: [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )));

    const { default: PilotOpsPage } = await import('../app/pilot-ops/page');
    const markup = renderToStaticMarkup(await PilotOpsPage({
      searchParams: Promise.resolve({ days: '90' }),
    }));

    expect(markup).toContain('Launch Gate Readiness');
    expect(markup).toContain('Read-only gate criteria');
    expect(markup).toContain('docs/specs/vitalcv-launch-gate.md');
    expect(markup).toContain('Truthful Public Copy');
    expect(markup).not.toContain('type="checkbox"');
  });
});
