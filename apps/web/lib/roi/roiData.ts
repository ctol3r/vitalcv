/**
 * Wave E Phase 1 — Executive ROI dashboard data shape + demo fixture.
 *
 * Pure types + a single demoCohort() fixture. No fetch, no DB, no DOM.
 *
 * Truth contract:
 *   - All values returned by demoCohort() are demonstrative. They do
 *     NOT describe a real customer's outcomes. The page that renders
 *     them always carries a "Demo cohort — illustrative only" banner.
 *   - The financial-impact methodology is intentionally surfaced
 *     verbatim on the page so a viewer can see where each number
 *     comes from and that a confidence range is applied.
 *   - No banned overclaim copy is used (no "automatically verified",
 *     no bare-word status label per CLAUDE.md, etc.). DTS = days-to-start, a
 *     credentialing operations metric — not a verification claim.
 */

export interface RoiMeta {
  org: string;
  facilities: number;
  cohortSize: number;
  reportPeriod: string;
  generatedAt: string;
  trailing: string;
  comparator: string;
  /** Always true in Phase 1 — drives the demo banner. */
  isDemo: true;
}

export interface DtsTimelineEntry {
  period: string;
  /** Pre-VitalCV baseline DTS, kept constant across the timeline so
   *  the chart can show a baseline reference line. */
  baseline: number;
  cohortP50: number;
  cohortP10: number;
  cohortP90: number;
  /** Number of files in this period's cohort. */
  n: number;
  label: string;
}

export interface BlockerFunnelStage {
  id: 'detected' | 'auto' | 'clinician' | 'reviewer' | 'committee';
  label: string;
  count: number;
  /** Subline rationale for the stage. */
  sub: string;
  /** Fraction of total detected (0..1). detected stage is 1.0. */
  pct: number;
}

export type ComplianceAuthority = 'NCQA' | 'TJC' | 'CMS';

export interface ComplianceGridRow {
  authority: ComplianceAuthority;
  std: string;
  topic: string;
  /** 'aligned' is the strongest claim allowed in Phase 1.
   *  'gap' / 'pending' would be allowed for non-demo data, but the
   *  demo cohort intentionally renders 'aligned' for every row to
   *  exercise the success render. */
  status: 'aligned' | 'gap' | 'pending';
  cohort: string;
  detail: string;
}

export interface FinancialImpactBreakdown {
  facility: string;
  files: number;
  days: number;
  capture: number;
}

export interface FinancialImpact {
  capturedRevenue: number;
  capturedRevenueLabel: string;
  contributingDays: number;
  perFileMargin: number;
  filesContributing: number;
  comparator: string;
  methodology: ReadonlyArray<{ k: string; v: string; sub: string }>;
  rangeLow: number;
  rangeHigh: number;
  platformCost: number;
  netImpact: number;
  netImpactLabel: string;
  paybackDays: number;
  byFacility: ReadonlyArray<FinancialImpactBreakdown>;
}

export interface RoiCohort {
  meta: RoiMeta;
  dtsTimeline: ReadonlyArray<DtsTimelineEntry>;
  blockerFunnel: ReadonlyArray<BlockerFunnelStage>;
  complianceGrid: ReadonlyArray<ComplianceGridRow>;
  financialImpact: FinancialImpact;
}

/** Convenience: latest DTS row from the timeline. */
export function latestDts(timeline: ReadonlyArray<DtsTimelineEntry>): DtsTimelineEntry | null {
  if (timeline.length === 0) return null;
  return timeline[timeline.length - 1];
}

/** DTS compression %, current vs baseline. Returns null when no data. */
export function dtsCompressionPct(timeline: ReadonlyArray<DtsTimelineEntry>): number | null {
  const last = latestDts(timeline);
  if (!last) return null;
  if (last.baseline === 0) return null;
  return Math.round(((last.baseline - last.cohortP50) / last.baseline) * 100);
}

/** Auto-resolve %, percent of detected blockers handled without human
 *  reviewer touch (auto + clinician routes count as not-reviewer). */
export function autoResolvePct(funnel: ReadonlyArray<BlockerFunnelStage>): number | null {
  const detected = funnel.find((s) => s.id === 'detected');
  const auto = funnel.find((s) => s.id === 'auto');
  if (!detected || !auto || detected.count === 0) return null;
  return Math.round((auto.count / detected.count) * 100);
}

/** Compliance alignment %, fraction of grid rows with status='aligned'. */
export function complianceAlignmentPct(grid: ReadonlyArray<ComplianceGridRow>): number {
  if (grid.length === 0) return 0;
  const aligned = grid.filter((r) => r.status === 'aligned').length;
  return Math.round((aligned / grid.length) * 100);
}

/** Build the demonstrative cohort. */
export function demoCohort(): RoiCohort {
  return {
    meta: {
      org: 'Demo Health · System',
      facilities: 4,
      cohortSize: 84,
      reportPeriod: 'Q1 2026 · Jan 1 – Apr 18',
      generatedAt: '2026-04-18T14:32:00Z',
      trailing: 'Trailing 12 mo',
      comparator: 'Demo baseline (FY24 H2)',
      isDemo: true,
    },
    dtsTimeline: [
      { period: '2024-Q3', baseline: 47, cohortP50: 47, cohortP10: 38, cohortP90: 64, n: 22, label: 'Pre-rollout' },
      { period: '2024-Q4', baseline: 47, cohortP50: 44, cohortP10: 36, cohortP90: 60, n: 18, label: 'Pilot · 2 facilities' },
      { period: '2025-Q1', baseline: 47, cohortP50: 36, cohortP10: 27, cohortP90: 51, n: 26, label: 'Pilot · 3 facilities' },
      { period: '2025-Q2', baseline: 47, cohortP50: 31, cohortP10: 24, cohortP90: 44, n: 31, label: 'System rollout' },
      { period: '2025-Q3', baseline: 47, cohortP50: 27, cohortP10: 21, cohortP90: 39, n: 38, label: 'System rollout' },
      { period: '2025-Q4', baseline: 47, cohortP50: 24, cohortP10: 18, cohortP90: 34, n: 47, label: 'Steady state' },
      { period: '2026-Q1', baseline: 47, cohortP50: 21, cohortP10: 17, cohortP90: 28, n: 84, label: 'Current' },
    ],
    blockerFunnel: [
      { id: 'detected',  label: 'Total potential blockers detected', count: 1247, sub: 'Across 84 active files · ingestion + monitoring',                       pct: 1.0   },
      { id: 'auto',      label: 'Resolved autonomously',              count: 1019, sub: 'Re-pulled from primary source · normalized · re-checked',             pct: 0.817 },
      { id: 'clinician', label: 'Routed to clinician (1 step)',       count: 154,  sub: 'Single attestation or doc upload · no employer touch',               pct: 0.124 },
      { id: 'reviewer',  label: 'Reached human reviewer',              count: 62,   sub: 'Required credentialing reviewer judgment',                            pct: 0.050 },
      { id: 'committee', label: 'Escalated to Credentials Committee', count: 12,   sub: 'Bylaws-mandated review · adverse-event hits, gap explanation',         pct: 0.010 },
    ],
    complianceGrid: [
      // Demo detail strings describe the *control* — what the standard
      // requires — not the specific upstream sources that satisfy it.
      // Real integrations (OIG/LEIE, SAM, NPDB, state medical boards,
      // AAMC, ABMS, etc.) are vendor-gated and out of scope for this
      // demo render. Source operational state is reported separately
      // on /status; this grid only shows control alignment.
      { authority: 'NCQA', std: 'CR-3 · Element A', topic: 'Sanctions screening within 180 days', status: 'aligned', cohort: '84/84', detail: 'Sanctions controls run at intake and on a monthly cadence' },
      { authority: 'NCQA', std: 'CR-3 · Element B', topic: 'License — primary-source review',     status: 'aligned', cohort: '84/84', detail: 'State-by-state license review with persisted receipt' },
      { authority: 'NCQA', std: 'CR-3 · Element D', topic: 'Controlled-substance authority — primary-source review', status: 'aligned', cohort: '78/78', detail: '6 files do not require this credential · documented exception' },
      { authority: 'NCQA', std: 'CR-3 · Element F', topic: 'Education / training PSV',            status: 'aligned', cohort: '84/84', detail: 'Education and training reviewed against the requesting program' },
      { authority: 'NCQA', std: 'CR-7',             topic: 'Ongoing monitoring',                  status: 'aligned', cohort: '84/84', detail: 'Continuous-monitoring schedule defined per credential type' },
      { authority: 'TJC',  std: 'MS.06.01.05',      topic: 'Privilege-specific PSV before grant', status: 'aligned', cohort: '84/84', detail: 'Privilege-by-privilege evidence binder per file' },
      { authority: 'TJC',  std: 'MS.08.01.01',      topic: 'FPPE plan documented',                status: 'aligned', cohort: '84/84', detail: 'FPPE plan attached to every privilege grant' },
      { authority: 'CMS',  std: 'CoP §482.22',      topic: 'Medical staff credentialing process', status: 'aligned', cohort: '84/84', detail: 'Process map · committee minutes · receipts' },
    ],
    financialImpact: {
      capturedRevenue: 4_192_400,
      capturedRevenueLabel: '$4.19M',
      contributingDays: 2184,
      perFileMargin: 1820,
      filesContributing: 84,
      comparator: '47-day demo baseline (FY24 H2)',
      methodology: [
        { k: 'Days saved',             v: '2,184 clinician-days', sub: 'Σ (47 − DTS_actual) over 84 files this period' },
        { k: 'Net daily contribution', v: '$1,820 / day',          sub: 'Service-line blended; nets malpractice, locum offset, support cost' },
        { k: 'Captured revenue',       v: '$4.19M',                sub: '2,184 × $1,820 · floored to whole dollars' },
        { k: 'Confidence',             v: 'Mid-band',              sub: 'Net daily contribution sourced from a finance memo · ±18% range applied below' },
      ],
      rangeLow: 3_437_700,
      rangeHigh: 4_947_100,
      platformCost: 312_000,
      netImpact: 3_880_400,
      netImpactLabel: '$3.88M',
      paybackDays: 27,
      byFacility: [
        { facility: 'Demo Surgical Pavilion', files: 28, days: 812, capture: 1_477_840 },
        { facility: 'Demo West Hospital',     files: 24, days: 658, capture: 1_197_560 },
        { facility: 'Demo Specialty Plaza',   files: 19, days: 462, capture:   840_840 },
        { facility: 'Demo South Ambulatory',  files: 13, days: 252, capture:   458_640 },
      ],
    },
  };
}
