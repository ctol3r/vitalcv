import { describe, expect, it } from 'vitest';
import { LABEL_QUALIFIER_V2 } from '../lib/roi-v2/label-qualifier';
import {
  getRoiV2DemoSnapshot,
  withHoursOnlyMode,
  ROI_V2_EXPORTS,
} from '../lib/roi-v2/fixtures';

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

describe('LABEL_QUALIFIER_V2', () => {
  it('locks the qualifier vocabulary to exactly six keys', () => {
    expect(Object.keys(LABEL_QUALIFIER_V2).sort()).toEqual(
      ['baseline', 'decisions', 'dollars', 'hours', 'rate', 'vsBaseline'].sort(),
    );
  });

  it('every qualifier carries an explicit "Estimated" / "Projected" / "Observed" / "You entered" / "Comparison" qualifier', () => {
    for (const key of Object.keys(LABEL_QUALIFIER_V2) as Array<
      keyof typeof LABEL_QUALIFIER_V2
    >) {
      const text = LABEL_QUALIFIER_V2[key];
      expect(text).toMatch(/Estimated|Projected|Observed|You entered|Comparison/);
    }
  });

  it('comparison qualifier explicitly disclaims industry-average baselines', () => {
    expect(LABEL_QUALIFIER_V2.vsBaseline).toContain('not an industry average');
  });

  it('contains zero banned strings across all qualifier copy', () => {
    const haystack = Object.values(LABEL_QUALIFIER_V2).join(' ').toLowerCase();
    for (const banned of BANNED) {
      expect(haystack).not.toContain(banned.toLowerCase());
    }
  });
});

describe('getRoiV2DemoSnapshot', () => {
  it('returns a stable seed across calls', () => {
    const a = getRoiV2DemoSnapshot();
    const b = getRoiV2DemoSnapshot();
    expect(a.pilot.pilotId).toBe(b.pilot.pilotId);
    expect(a.decisions.staged).toBe(b.decisions.staged);
    expect(a.timeline).toHaveLength(b.timeline.length);
  });

  it('returns a fresh timeline so mutation does not bleed across calls', () => {
    const a = getRoiV2DemoSnapshot();
    a.timeline[0]!.observed = 999;
    const b = getRoiV2DemoSnapshot();
    expect(b.timeline[0]!.observed).not.toBe(999);
  });

  it('seeds the pilot with a non-null defaultWageUsd by default', () => {
    const snapshot = getRoiV2DemoSnapshot();
    expect(snapshot.pilot.defaultWageUsd).not.toBeNull();
    expect(typeof snapshot.pilot.defaultWageUsd).toBe('number');
  });

  it('snapshot status is one of the four locked states', () => {
    const snapshot = getRoiV2DemoSnapshot();
    expect(['on-track', 'trailing', 'blocked', 'complete']).toContain(
      snapshot.status.state,
    );
  });

  it('lane breakdown column "confirmed" is the receipt-confirmation column (no "verified" row state)', () => {
    const snapshot = getRoiV2DemoSnapshot();
    for (const row of snapshot.laneBreakdown) {
      expect(row).toHaveProperty('confirmed');
      expect(row).not.toHaveProperty('verified');
    }
  });

  it('exports list is exactly three options: csv, pdf, snapshot', () => {
    const ids = ROI_V2_EXPORTS.map((e) => e.id).sort();
    expect(ids).toEqual(['csv', 'pdf', 'snapshot']);
  });

  it('contains zero banned strings across all snapshot copy', () => {
    const snapshot = getRoiV2DemoSnapshot();
    const haystack = JSON.stringify(snapshot).toLowerCase();
    for (const banned of BANNED) {
      expect(haystack).not.toContain(banned.toLowerCase());
    }
  });

  it('methodology panel discloses what is NOT included', () => {
    const snapshot = getRoiV2DemoSnapshot();
    const notIncludedRow = snapshot.methodology.find((r) =>
      r.k.toLowerCase().includes('not include'),
    );
    expect(notIncludedRow).toBeDefined();
    expect(notIncludedRow!.note.toLowerCase()).toContain(
      'reviewer hours and decision throughput',
    );
  });
});

describe('withHoursOnlyMode', () => {
  it('clears defaultWageUsd', () => {
    const original = getRoiV2DemoSnapshot();
    expect(original.pilot.defaultWageUsd).not.toBeNull();
    const muted = withHoursOnlyMode(original);
    expect(muted.pilot.defaultWageUsd).toBeNull();
  });

  it('does not mutate the original snapshot', () => {
    const original = getRoiV2DemoSnapshot();
    const originalWage = original.pilot.defaultWageUsd;
    withHoursOnlyMode(original);
    expect(original.pilot.defaultWageUsd).toBe(originalWage);
  });
});
