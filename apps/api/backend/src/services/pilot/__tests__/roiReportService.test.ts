import {
  generateRoiReport,
  roiReportToHtml,
} from '../roiReportService';
import type { PilotKpiSnapshot } from '../pilotKpiService';

function buildSnapshot(overrides: Partial<PilotKpiSnapshot> = {}): PilotKpiSnapshot {
  return {
    generatedAt: '2026-03-29T18:00:00.000Z',
    windowDays: 30,
    since: '2026-02-28T18:00:00.000Z',
    appliedFilter: {
      pilotId: null,
      workflowLane: null,
      orgContextId: null,
      geographyTag: null,
    },
    isFiltered: false,
    packetShares: {
      total: 2,
      distinctEntities: 2,
      distinctOrgs: 1,
      byDeliveryStatus: { DELIVERED: 2 },
      earliestSharedAt: '2026-03-01T00:00:00.000Z',
      latestSharedAt: '2026-03-02T00:00:00.000Z',
    },
    reviewsOpened: {
      total: 2,
      distinctEntities: 2,
      byOrgContext: [],
      earliestAt: '2026-03-02T00:00:00.000Z',
      latestAt: '2026-03-03T00:00:00.000Z',
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
      medianDaysFirstReviewToDecision: 4,
      medianDaysFirstReviewToReady: 2,
      medianDaysFirstReviewToStart: null,
      medianDaysShareToDecision: 5,
      sampleSizes: {
        reviewToDecision: 1,
        reviewToReady: 1,
        reviewToStart: 0,
        shareToDecision: 1,
      },
    },
    blockers: [],
    startOutcomes: {
      totalStarts: 0,
      totalOutcomeRecords: 0,
      didNotStartCount: 0,
      nonStartReasons: [],
      distinctEntities: 0,
      readinessAtStart: {
        avgScore: null,
        medianScore: null,
        withBlockers: 0,
      },
    },
    eventChain: {
      bundleShareEvents: 2,
      advisoryOutcomeEvents: 2,
      employerDecisionEvents: 1,
      blockerResolutionEvents: 0,
      blockerResolvedMetricEvents: 0,
      readinessChangeEvents: 0,
      startOutcomeEvents: 0,
      nonStartOutcomeEvents: 0,
      employerAcceptances: 1,
      startAttestations: 0,
    },
    readinessDistribution: {
      ready: 1,
      partial: 0,
      blocked: 1,
      total: 2,
      noScore: 0,
    },
    proofChain: {
      totalEvents: 0,
      totalCases: 0,
      replayableCases: 0,
      partialCases: 0,
      cases: [],
      events: [],
    },
    gaps: [],
    ...overrides,
  };
}

function findMetric(
  report: ReturnType<typeof generateRoiReport>,
  id: string,
) {
  return report.sections
    .flatMap((section) => section.metrics)
    .find((metric) => metric.id === id);
}

describe('roiReportService', () => {
  it('labels readiness mix as latest-review-in-window instead of a first-review benchmark', () => {
    const report = generateRoiReport(buildSnapshot());
    const readyMetric = findMetric(report, 'ready_at_latest_review');

    expect(report.topLine.percentReadyAtLatestReviewInWindow).toBe(50);
    expect(readyMetric).toEqual(expect.objectContaining({
      label: '% of reviewed clinicians READY at latest review in window',
      industryBaseline: null,
      industryBaselineLabel: 'No direct industry baseline for latest-review readiness mix',
      industryBaselineSource: 'N/A',
      delta: null,
      deltaLabel: 'Window-derived readiness mix; not compared to first-review industry baselines',
    }));
    expect(readyMetric?.note).toContain('latest employer review event per clinician');
    expect(report.executiveSummary).toContain('READY at the latest review in the selected window');
    expect(report.dataDisclaimer).toContain('Latest-review readiness share is window-derived');
  });

  it('dedupes repeated data-gap messages and keeps the HTML card copy aligned', () => {
    const report = generateRoiReport(buildSnapshot({
      packetShares: {
        total: 0,
        distinctEntities: 0,
        distinctOrgs: 0,
        byDeliveryStatus: {},
        earliestSharedAt: null,
        latestSharedAt: null,
      },
      gaps: ['No packets shared — clinicians must share passports for funnel tracking'],
    }));
    const html = roiReportToHtml(report);

    expect(
      report.dataGaps.filter((gap) => gap === 'No packets shared — clinicians must share passports for funnel tracking'),
    ).toHaveLength(1);
    expect(html).toContain('Ready at review');
    expect(html).toContain('latest review in selected window');
    expect(html).not.toContain('baseline: 22%');
  });
});
