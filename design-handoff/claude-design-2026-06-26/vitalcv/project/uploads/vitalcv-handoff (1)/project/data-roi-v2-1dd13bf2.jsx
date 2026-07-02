// WAVE 22 · ROI Console v2 data
// Pilot-revenue surface. Replaces the FY-aggregate "Executive ROI" dashboard
// with a continuously-updating per-pilot console.
//
// CRITICAL CONTRACTS (carried from the wave brief):
//  - Every projected number carries an inline qualifier (LABEL_QUALIFIER_V2).
//  - Dollar lines render only when ORG.defaultWageUsd is non-null. Hours-only is
//    a first-class state, never a degraded one.
//  - Comparison phrasing is always "vs. your baseline of Nd" — never an
//    industry-average baseline.
//  - We never claim "guaranteed" savings, "instant" anything, or "complete
//    credentialing". Banned strings live in the wave brief; rendered copy is
//    sanitized in components/view.
//
// Reuse: ROI_META, FINANCIAL_IMPACT et al. from Wave 16 (data-roi.jsx) remain
// available for the legacy dashboard. v2 introduces per-pilot fixtures below.

const LABEL_QUALIFIER_V2 = {
  hours:     'Projected · subject to volume',
  dollars:   'Estimated · based on your default wage',
  baseline:  'You entered this · used as the comparison point for ROI',
  decisions: 'Observed · receipt-derived count for this pilot window',
  rate:      'Observed · running average over the pilot window',
  vsBaseline:'Comparison vs. your baseline · not an industry average',
};
window.LABEL_QUALIFIER_V2 = LABEL_QUALIFIER_V2;

// Pilot-scope identity — narrows the ROI surface to a SINGLE org pilot,
// not the FY-system rollup that Wave 16 covered.
const ROI_V2_PILOT = {
  orgId: 'org_demo_pilot_01',
  orgName: 'Cedar Health Surgical Pavilion',
  pilotId: 'PILOT-2026-Q2-014',
  pilotStartedAt: '2026-04-22 09:12 UTC',
  pilotWindowDays: 30,
  daysElapsed: 14,                  // half-pilot snapshot
  defaultWageUsd: 65,               // null → hours-only render path
  baselineDays: 21,                 // employer-entered in Wave 21
  ownerContact: 'Karen Patel · VP, Credentialing',
  tier: 'Pilot',                    // marketing tier (Wave 30); informational only
};
window.ROI_V2_PILOT = ROI_V2_PILOT;

// Honest-status pip for the console header. Always one of:
//   on-track     · running at or ahead of the half-pilot midpoint
//   trailing     · running behind midpoint but not blocked
//   blocked      · ingestion paused or sample volume dropped to zero
//   complete     · pilot window has elapsed; final numbers locked
const ROI_V2_STATUS = {
  state: 'on-track',
  summary: 'Halfway through the pilot window. Decisions are accumulating at the rate we projected at activation.',
  asOf: '2026-05-06 11:08 UTC',
};
window.ROI_V2_STATUS = ROI_V2_STATUS;

// Decision-flow counters. These are OBSERVED (receipt-derived), not projected.
// `staged` is everything the Inbox has received; `decided` is everything that
// has at least one accept/dispute/refresh decision logged.
const ROI_V2_DECISIONS = {
  staged: 142,
  decided: 87,
  acceptedFirstPass: 71,            // 81.6% of decided
  disputed: 9,
  refreshedAndAccepted: 7,
  // Per-day rate → drives the projection chart.
  dailyDecisionRate: 6.2,
  dailyRateLast3: 7.4,
  // Window for the chart.
  windowStart: '2026-04-22',
  windowEnd:   '2026-05-22',
};
window.ROI_V2_DECISIONS = ROI_V2_DECISIONS;

// Day-by-day timeline used by RoiTimelineChart.
// Each row carries: date, observed (decisions logged that day), and projected
// (linear projection from the running daily rate, only past day-14).
const ROI_V2_TIMELINE = (() => {
  const rows = [];
  const observed = [0, 1, 2, 3, 5, 4, 6, 7, 8, 6, 9, 8, 11, 10];
  const start = new Date(Date.UTC(2026, 3, 22));
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
      projected: isPast ? null : Math.round(7.4 * (1 + (i - 13) * 0.02)),  // gentle growth
      isToday,
    });
  }
  return rows;
})();
window.ROI_V2_TIMELINE = ROI_V2_TIMELINE;

// ROI breakdowns. Hours figures are always rendered. Dollar figures are
// computed in the renderer ONLY when defaultWageUsd is non-null — we do NOT
// precompute them here.
const ROI_V2_HOURS = {
  // Reviewer hours saved this pilot window (observed from decision log).
  observedSavedHours: 96,
  // Projected hours saved by end of the 30-day pilot window.
  projectedTotalHoursAt30d: 214,
  // Hours per decision (running average) — drives the per-decision drill-down.
  hoursPerDecisionLegacy: 2.4,        // employer-entered baseline (vs. their own legacy process)
  hoursPerDecisionVitalcv: 0.4,       // observed in this pilot
  hoursSavedPerDecision: 2.0,
};
window.ROI_V2_HOURS = ROI_V2_HOURS;

// Time-to-first-decision distribution — the headline number alongside hours.
const ROI_V2_TTFD = {
  baselineDays: 21,
  pilotMedianHours: 18,
  pilotP10Hours: 11,
  pilotP90Hours: 36,
  // Deltas — rendered as "Xx faster vs. your baseline" with the qualifier
  // that this is *YOUR* baseline, not an industry average.
  speedupVsBaselineX: 28,             // 21d × 24h / 18h ≈ 28x; rendered floor()
  // Daily TTFD samples for the sparkline.
  hourSamplesByDay: [22, 24, 19, 21, 18, 17, 19, 16, 18, 15, 17, 16, 17, 18],
};
window.ROI_V2_TTFD = ROI_V2_TTFD;

// Per-lane decision breakdown — the practical "where is value coming from"
// table. Counts come from receipts; "Verified" is intentionally NOT used as a
// row-state label here — we use "Confirmed" for the confirmed column.
const ROI_V2_LANE_BREAKDOWN = [
  { laneId: 'identity',  laneName: 'Identity',          decided: 84, confirmed: 81, contradicted: 1, refreshed: 2,  hoursSaved: 28.0, pctOfTotal: 0.292 },
  { laneId: 'licensure', laneName: 'Licensure',         decided: 78, confirmed: 73, contradicted: 0, refreshed: 5,  hoursSaved: 24.5, pctOfTotal: 0.255 },
  { laneId: 'sanctions', laneName: 'Sanctions',         decided: 87, confirmed: 86, contradicted: 1, refreshed: 0,  hoursSaved: 22.0, pctOfTotal: 0.229 },
  { laneId: 'dea',       laneName: 'DEA registration',  decided: 41, confirmed: 38, contradicted: 0, refreshed: 3,  hoursSaved: 12.0, pctOfTotal: 0.125 },
  { laneId: 'education', laneName: 'Education / GME',   decided: 22, confirmed: 21, contradicted: 0, refreshed: 1,  hoursSaved:  6.0, pctOfTotal: 0.063 },
  { laneId: 'malprac',   laneName: 'Malpractice hist.', decided: 14, confirmed: 13, contradicted: 0, refreshed: 1,  hoursSaved:  3.5, pctOfTotal: 0.036 },
];
window.ROI_V2_LANE_BREAKDOWN = ROI_V2_LANE_BREAKDOWN;

// Cost-of-decision drill-down. Rendered conditionally — hours always, dollars
// only when wage is set. This drives the "compare apples to apples" table.
const ROI_V2_COST_DRILLDOWN = {
  // Per-decision baseline (employer-entered)
  baselineMinutesPerDecision: 144,    // 2.4h
  pilotMinutesPerDecision: 24,        // 0.4h
  // For dollar conversion: minutes × wage/60. Renderer-side only.
};
window.ROI_V2_COST_DRILLDOWN = ROI_V2_COST_DRILLDOWN;

// Methodology footnotes — rendered in the methodology panel (collapsible).
// These exist so the surface can be honest about how the math works.
const ROI_V2_METHODOLOGY = [
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
window.ROI_V2_METHODOLOGY = ROI_V2_METHODOLOGY;

// Cross-pilot summary — used by the optional comparison strip when an org
// runs multiple pilots concurrently. For the demo, single-pilot is the default.
const ROI_V2_OTHER_PILOTS = [
  // empty by default → renders the "you're running one pilot" hint
];
window.ROI_V2_OTHER_PILOTS = ROI_V2_OTHER_PILOTS;

// Export options surfaced in the header. Each is a placeholder action — the
// surface frames CSV/PDF as user-initiated, never auto-pushed to anyone.
const ROI_V2_EXPORTS = [
  { id: 'csv',      label: 'Download CSV',    sub: 'Decision log + per-lane breakdown · 14d window' },
  { id: 'pdf',      label: 'Generate PDF',    sub: 'Pilot ROI brief · branded for your CFO/board' },
  { id: 'snapshot', label: 'Snapshot link',   sub: 'Read-only URL · expires in 24h · revocable' },
];
window.ROI_V2_EXPORTS = ROI_V2_EXPORTS;
