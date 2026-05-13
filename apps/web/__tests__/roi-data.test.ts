import { describe, expect, it } from 'vitest';

import {
  autoResolvePct,
  complianceAlignmentPct,
  demoCohort,
  dtsCompressionPct,
  latestDts,
  type RoiCohort,
} from '@/lib/roi/roiData';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

describe('demoCohort', () => {
  it('returns a cohort with isDemo === literal true', () => {
    const c = demoCohort();
    expect(c.meta.isDemo).toBe(true);
  });

  it('has 7 DTS timeline entries (Q3 2024 through Q1 2026)', () => {
    const c = demoCohort();
    expect(c.dtsTimeline.length).toBe(7);
    expect(c.dtsTimeline[0].period).toBe('2024-Q3');
    expect(c.dtsTimeline[c.dtsTimeline.length - 1].period).toBe('2026-Q1');
  });

  it('has all 5 funnel stages in canonical order', () => {
    const c = demoCohort();
    expect(c.blockerFunnel.map((s) => s.id)).toEqual([
      'detected',
      'auto',
      'clinician',
      'reviewer',
      'committee',
    ]);
  });

  it('funnel counts strictly decrease from detected onwards', () => {
    const c = demoCohort();
    for (let i = 1; i < c.blockerFunnel.length; i++) {
      expect(c.blockerFunnel[i].count).toBeLessThanOrEqual(c.blockerFunnel[i - 1].count);
    }
  });

  it('funnel stage pcts sum (auto + clinician + reviewer + committee) to 100% of detected', () => {
    const c = demoCohort();
    const detected = c.blockerFunnel.find((s) => s.id === 'detected')!;
    const others = c.blockerFunnel
      .filter((s) => s.id !== 'detected')
      .reduce((acc, s) => acc + s.count, 0);
    expect(others).toBe(detected.count);
  });

  it('compliance grid has 8 rows; demo cohort renders all aligned', () => {
    const c = demoCohort();
    expect(c.complianceGrid.length).toBe(8);
    for (const row of c.complianceGrid) {
      expect(row.status).toBe('aligned');
    }
  });

  it('financial impact: rangeLow < capturedRevenue < rangeHigh', () => {
    const c = demoCohort();
    const fi = c.financialImpact;
    expect(fi.rangeLow).toBeLessThan(fi.capturedRevenue);
    expect(fi.capturedRevenue).toBeLessThan(fi.rangeHigh);
  });

  it('financial impact: byFacility days sum equals contributingDays', () => {
    const c = demoCohort();
    const fi = c.financialImpact;
    const sumDays = fi.byFacility.reduce((acc, row) => acc + row.days, 0);
    expect(sumDays).toBe(fi.contributingDays);
  });

  it('financial impact: netImpact = capturedRevenue - platformCost', () => {
    const c = demoCohort();
    const fi = c.financialImpact;
    expect(fi.netImpact).toBe(fi.capturedRevenue - fi.platformCost);
  });
});

describe('latestDts', () => {
  it('returns the last entry in the timeline', () => {
    const c = demoCohort();
    const last = latestDts(c.dtsTimeline);
    expect(last?.period).toBe('2026-Q1');
  });

  it('returns null when timeline is empty', () => {
    expect(latestDts([])).toBeNull();
  });
});

describe('dtsCompressionPct', () => {
  it('computes (baseline - p50) / baseline * 100', () => {
    const c = demoCohort();
    const pct = dtsCompressionPct(c.dtsTimeline);
    // Baseline 47, current p50 21 => (47-21)/47 = 55.3% rounded
    expect(pct).toBe(55);
  });

  it('returns null when timeline is empty', () => {
    expect(dtsCompressionPct([])).toBeNull();
  });

  it('returns null when baseline is zero (avoid divide by zero)', () => {
    const pct = dtsCompressionPct([
      { period: 'X', baseline: 0, cohortP10: 0, cohortP50: 0, cohortP90: 0, n: 0, label: '' },
    ]);
    expect(pct).toBeNull();
  });
});

describe('autoResolvePct', () => {
  it('computes auto/detected as a rounded percent', () => {
    const c = demoCohort();
    const pct = autoResolvePct(c.blockerFunnel);
    // 1019 / 1247 = 81.7% → 82
    expect(pct).toBe(82);
  });

  it('returns null when detected stage is missing', () => {
    expect(autoResolvePct([])).toBeNull();
  });
});

describe('complianceAlignmentPct', () => {
  it('returns 100 when all rows are aligned', () => {
    const c = demoCohort();
    expect(complianceAlignmentPct(c.complianceGrid)).toBe(100);
  });

  it('returns 0 for an empty grid', () => {
    expect(complianceAlignmentPct([])).toBe(0);
  });

  it('returns 50 when half are aligned and half are gap', () => {
    const grid: RoiCohort['complianceGrid'] = [
      { authority: 'NCQA', std: 'A', topic: 't', status: 'aligned', cohort: '1/1', detail: '' },
      { authority: 'NCQA', std: 'B', topic: 't', status: 'gap',     cohort: '0/1', detail: '' },
    ];
    expect(complianceAlignmentPct(grid)).toBe(50);
  });
});

describe('demoCohort — banned phrases', () => {
  it('renders no banned overclaim copy in any field', () => {
    const c = demoCohort();
    const blob = JSON.stringify(c).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});
