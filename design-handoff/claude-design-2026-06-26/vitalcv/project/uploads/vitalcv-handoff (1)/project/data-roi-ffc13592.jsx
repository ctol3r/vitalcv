// WAVE 16 · Executive ROI Dashboard data

const ROI_META = {
  org: 'Cedar Health · System',
  facilities: 4,
  cohortSize: 84,                          // active credentialing files this period
  reportPeriod: 'Q1 2026 · Jan 1 – Apr 18',
  generatedAt: '2026-04-18 14:32 UTC',
  trailing: 'Trailing 12 mo',
  comparator: 'Cedar baseline (FY24 H2)',
};
window.ROI_META = ROI_META;

// DTS Compression — monthly p50, p10/p90, n
const DTS_TIMELINE = [
  { period: '2024-Q3', baseline: 47, cohortP50: 47, cohortP10: 38, cohortP90: 64, n: 22, label: 'Pre-VitalCV' },
  { period: '2024-Q4', baseline: 47, cohortP50: 44, cohortP10: 36, cohortP90: 60, n: 18, label: 'Pilot · 2 facilities' },
  { period: '2025-Q1', baseline: 47, cohortP50: 36, cohortP10: 27, cohortP90: 51, n: 26, label: 'Pilot · 3 facilities' },
  { period: '2025-Q2', baseline: 47, cohortP50: 31, cohortP10: 24, cohortP90: 44, n: 31, label: 'System rollout' },
  { period: '2025-Q3', baseline: 47, cohortP50: 27, cohortP10: 21, cohortP90: 39, n: 38, label: 'System rollout' },
  { period: '2025-Q4', baseline: 47, cohortP50: 24, cohortP10: 18, cohortP90: 34, n: 47, label: 'BAU' },
  { period: '2026-Q1', baseline: 47, cohortP50: 21, cohortP10: 17, cohortP90: 28, n: 84, label: 'Current' },
];
window.DTS_TIMELINE = DTS_TIMELINE;

// Blocker Resolution Funnel — counts of issues at each stage
const BLOCKER_FUNNEL = [
  { id: 'detected',  label: 'Total potential blockers detected', count: 1247, sub: 'Across 84 active files · ingestion + monitoring',  pct: 1.0 },
  { id: 'auto',      label: 'Resolved autonomously',              count: 1019, sub: 'Re-pulled from primary source · normalized · re-checked', pct: 0.817 },
  { id: 'clinician', label: 'Routed to clinician (1 step)',       count: 154,  sub: 'Single attestation or doc upload · no employer touch',    pct: 0.124 },
  { id: 'reviewer',  label: 'Reached human reviewer',              count: 62,   sub: 'Required Cedar credentialing reviewer judgment',          pct: 0.050 },
  { id: 'committee', label: 'Escalated to Credentials Committee', count: 12,   sub: 'Bylaws-mandated review · NPDB hits, gap explanation',     pct: 0.010 },
];
window.BLOCKER_FUNNEL = BLOCKER_FUNNEL;

// Compliance grid — strict standards mapped
const COMPLIANCE_GRID = [
  { authority: 'NCQA',        std: 'CR-3 · Element A',  topic: 'Sanctions screening within 180 days',    status: 'aligned', cohort: '84/84', detail: 'OIG/LEIE + SAM checked at intake and monthly thereafter' },
  { authority: 'NCQA',        std: 'CR-3 · Element B',  topic: 'License verified · primary source',       status: 'aligned', cohort: '84/84', detail: 'State-by-state board PSV with persisted receipt' },
  { authority: 'NCQA',        std: 'CR-3 · Element D',  topic: 'DEA verified · primary source',           status: 'aligned', cohort: '78/78', detail: '6 files do not require DEA · documented exception' },
  { authority: 'NCQA',        std: 'CR-3 · Element F',  topic: 'Education / training PSV',                status: 'aligned', cohort: '84/84', detail: 'AAMC / CAQH · ABMS where applicable' },
  { authority: 'NCQA',        std: 'CR-7',              topic: 'Ongoing monitoring',                       status: 'aligned', cohort: '84/84', detail: 'Sanctions monitored monthly · NPDB nightly continuous query' },
  { authority: 'TJC',         std: 'MS.06.01.05',       topic: 'Privilege-specific PSV before grant',      status: 'aligned', cohort: '84/84', detail: 'Privilege-by-privilege evidence binder per file' },
  { authority: 'TJC',         std: 'MS.08.01.01',       topic: 'FPPE plan documented',                     status: 'aligned', cohort: '84/84', detail: 'FPPE Plan v2.4 attached to every privilege grant' },
  { authority: 'CMS',         std: 'CoP §482.22',        topic: 'Medical staff credentialing process',      status: 'aligned', cohort: '84/84', detail: 'Process map · committee minutes · receipts' },
];
window.COMPLIANCE_GRID = COMPLIANCE_GRID;

// Financial impact — careful methodology
const FINANCIAL_IMPACT = {
  capturedRevenue: 4_192_400,
  capturedRevenueLabel: '$4.19M',
  contributingDays: 2184,                       // total days saved across cohort
  perFileMargin: 1820,                          // $/day net contribution per provider (after malpractice, support, etc.)
  filesContributing: 84,
  comparator: '47-day Cedar baseline (FY24 H2)',
  methodology: [
    { k: 'Days saved',        v: '2,184 clinician-days', sub: 'Σ (47 − DTS_actual) over 84 files this period' },
    { k: 'Net daily contribution', v: '$1,820 / day',    sub: 'Cedar Finance · service-line blended · already nets malpractice, locum offset, support cost' },
    { k: 'Captured revenue',  v: '$4.19M',                sub: '2,184 × $1,820 · floored to whole dollars' },
    { k: 'Confidence',        v: 'Mid-band',              sub: 'Net daily contribution sourced from Cedar Finance memo · ±18% range applied below' },
  ],
  rangeLow:  3_437_700,
  rangeHigh: 4_947_100,
  // attribution check: paid platform cost vs. captured revenue
  platformCost: 312_000,
  netImpact:    3_880_400,
  netImpactLabel: '$3.88M',
  paybackDays: 27,
  // breakouts
  byFacility: [
    { facility: 'Cedar Surgical Pavilion', files: 28, days: 812,  capture: 1_477_840 },
    { facility: 'Cedar West Hospital',     files: 24, days: 658,  capture: 1_197_560 },
    { facility: 'Cedar Specialty Plaza',   files: 19, days: 462,  capture:   840_840 },
    { facility: 'Cedar South Ambulatory',  files: 13, days: 252,  capture:   458_640 },
  ],
};
window.FINANCIAL_IMPACT = FINANCIAL_IMPACT;
