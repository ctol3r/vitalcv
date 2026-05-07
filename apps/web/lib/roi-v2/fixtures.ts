/**
 * Demo fixtures for ROI Console v2.
 *
 * Phase 1: every value is fixture-driven. The page that consumes these is
 * banner-disclosed as a demo until TRUST-PERSIST-1 Phase 2 lands the writer
 * and a real receipt log is queryable.
 *
 * Replacement plan: when persistence Phase 2 ships, replace this module with
 * a fetcher that queries the org's receipt log within the pilot window. The
 * Snapshot shape is the contract; component code does not change.
 */

import type {
  RoiV2CostDrilldown,
  RoiV2Decisions,
  RoiV2ExportOption,
  RoiV2Hours,
  RoiV2LaneRow,
  RoiV2MethodologyRow,
  RoiV2Pilot,
  RoiV2Snapshot,
  RoiV2StatusBlock,
  RoiV2TimelineEntry,
  RoiV2Ttfd,
} from './types';

const ROI_V2_PILOT_DEMO: RoiV2Pilot = {
  orgId: 'org_demo_pilot_01',
  orgName: 'Cedar Health Surgical Pavilion',
  pilotId: 'PILOT-2026-Q2-014',
  pilotStartedAt: '2026-04-22 09:12 UTC',
  pilotWindowDays: 30,
  daysElapsed: 14,
  defaultWageUsd: 65,
  baselineDays: 21,
  ownerContact: 'Karen Patel · VP, Credentialing',
  tier: 'Pilot',
};

const ROI_V2_STATUS_DEMO: RoiV2StatusBlock = {
  state: 'on-track',
  summary:
    'Halfway through the pilot window. Decisions are accumulating at the rate we projected at activation.',
  asOf: '2026-05-06 11:08 UTC',
};

const ROI_V2_DECISIONS_DEMO: RoiV2Decisions = {
  staged: 142,
  decided: 87,
  acceptedFirstPass: 71,
  disputed: 9,
  refreshedAndAccepted: 7,
  dailyDecisionRate: 6.2,
  dailyRateLast3: 7.4,
  windowStart: '2026-04-22',
  windowEnd: '2026-05-22',
};

function buildTimelineDemo(): RoiV2TimelineEntry[] {
  const observed = [0, 1, 2, 3, 5, 4, 6, 7, 8, 6, 9, 8, 11, 10];
  const start = new Date(Date.UTC(2026, 3, 22));
  const rows: RoiV2TimelineEntry[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isPast = i < observed.length;
    const isToday = i === observed.length - 1;
    rows.push({
      day: i + 1,
      date: dateStr,
      observed: isPast ? observed[i] : null,
      projected: isPast ? null : Math.round(7.4 * (1 + (i - 13) * 0.02)),
      isToday,
    });
  }
  return rows;
}

const ROI_V2_HOURS_DEMO: RoiV2Hours = {
  observedSavedHours: 96,
  projectedTotalHoursAt30d: 214,
  hoursPerDecisionLegacy: 2.4,
  hoursPerDecisionVitalcv: 0.4,
  hoursSavedPerDecision: 2.0,
};

const ROI_V2_TTFD_DEMO: RoiV2Ttfd = {
  baselineDays: 21,
  pilotMedianHours: 18,
  pilotP10Hours: 11,
  pilotP90Hours: 36,
  speedupVsBaselineX: 28,
  hourSamplesByDay: [22, 24, 19, 21, 18, 17, 19, 16, 18, 15, 17, 16, 17, 18],
};

const ROI_V2_LANE_BREAKDOWN_DEMO: RoiV2LaneRow[] = [
  { laneId: 'identity', laneName: 'Identity', decided: 84, confirmed: 81, contradicted: 1, refreshed: 2, hoursSaved: 28.0, pctOfTotal: 0.292 },
  { laneId: 'licensure', laneName: 'Licensure', decided: 78, confirmed: 73, contradicted: 0, refreshed: 5, hoursSaved: 24.5, pctOfTotal: 0.255 },
  { laneId: 'sanctions', laneName: 'Sanctions', decided: 87, confirmed: 86, contradicted: 1, refreshed: 0, hoursSaved: 22.0, pctOfTotal: 0.229 },
  { laneId: 'dea', laneName: 'DEA registration', decided: 41, confirmed: 38, contradicted: 0, refreshed: 3, hoursSaved: 12.0, pctOfTotal: 0.125 },
  { laneId: 'education', laneName: 'Education / GME', decided: 22, confirmed: 21, contradicted: 0, refreshed: 1, hoursSaved: 6.0, pctOfTotal: 0.063 },
  { laneId: 'malprac', laneName: 'Malpractice hist.', decided: 14, confirmed: 13, contradicted: 0, refreshed: 1, hoursSaved: 3.5, pctOfTotal: 0.036 },
];

const ROI_V2_COST_DEMO: RoiV2CostDrilldown = {
  baselineMinutesPerDecision: 144,
  pilotMinutesPerDecision: 24,
};

const ROI_V2_METHODOLOGY_DEMO: RoiV2MethodologyRow[] = [
  {
    k: 'Decision count source',
    v: 'Receipt log',
    note: 'Every entry is an actual receipt object on disk. Pilot-window queries filter on receipt.recordedAt within the pilot window.',
  },
  {
    k: 'Hours-saved math',
    v: '(baselineMinutes − pilotMinutes) ÷ 60',
    note: 'Per-decision delta multiplied by decided count. Baseline is employer-entered in Activation Step 3 (your own legacy process), not an industry average.',
  },
  {
    k: 'Dollar conversion',
    v: 'hours × defaultWageUsd',
    note: 'Only computed when default wage is set in Activation Step 1. Otherwise hours-only.',
  },
  {
    k: 'Projection model',
    v: 'Linear from running daily rate',
    note: 'Day-15 onward uses the running daily rate as the slope. We do not extrapolate beyond the 30-day pilot window.',
  },
  {
    k: 'What we do NOT include',
    v: 'Indirect costs, opportunity cost, locum offsets',
    note: 'Pilot ROI is reviewer hours and decision throughput — not a comprehensive financial model.',
  },
];

export const ROI_V2_EXPORTS: readonly RoiV2ExportOption[] = [
  { id: 'csv', label: 'Download CSV', sub: 'Decision log + per-lane breakdown · 14d window' },
  { id: 'pdf', label: 'Generate PDF', sub: 'Pilot ROI brief · branded for your CFO/board' },
  { id: 'snapshot', label: 'Snapshot link', sub: 'Read-only URL · expires in 24h · revocable' },
] as const;

/**
 * Returns a fresh demo snapshot. The timeline is recomputed each call (so
 * tests that mutate it don't bleed across cases), but the seed values are
 * stable.
 */
export function getRoiV2DemoSnapshot(): RoiV2Snapshot {
  return {
    pilot: { ...ROI_V2_PILOT_DEMO },
    status: { ...ROI_V2_STATUS_DEMO },
    decisions: { ...ROI_V2_DECISIONS_DEMO },
    timeline: buildTimelineDemo(),
    hours: { ...ROI_V2_HOURS_DEMO },
    ttfd: { ...ROI_V2_TTFD_DEMO, hourSamplesByDay: [...ROI_V2_TTFD_DEMO.hourSamplesByDay] },
    laneBreakdown: ROI_V2_LANE_BREAKDOWN_DEMO.map((row) => ({ ...row })),
    costDrilldown: { ...ROI_V2_COST_DEMO },
    methodology: ROI_V2_METHODOLOGY_DEMO.map((row) => ({ ...row })),
    exports: ROI_V2_EXPORTS,
  };
}

/**
 * Mutates a snapshot to render the hours-only path (defaultWageUsd = null).
 * Helper for tests + the showcase toggle in the client component.
 */
export function withHoursOnlyMode(snapshot: RoiV2Snapshot): RoiV2Snapshot {
  return {
    ...snapshot,
    pilot: { ...snapshot.pilot, defaultWageUsd: null },
  };
}
