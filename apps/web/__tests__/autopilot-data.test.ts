import { describe, expect, it } from 'vitest';

import {
  ACTION_META,
  DRIFT_META,
  KIND_META,
  PORTABILITY_META,
  SEVERITY_META,
  computeCompositeTrustScore,
  computeRenewalCounts,
  demoAutopilot,
  sumFactorWeights,
} from '@/lib/autopilot/autopilotData';

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

describe('status meta tables', () => {
  it('no status meta uses the bare label "Verified"', () => {
    for (const map of [ACTION_META, KIND_META, PORTABILITY_META, SEVERITY_META, DRIFT_META]) {
      for (const meta of Object.values(map)) {
        expect(meta.label).not.toBe('Verified');
      }
    }
  });

  it('renewal kind meta covers the 6 design-mandated kinds', () => {
    expect(Object.keys(KIND_META)).toEqual([
      'license',
      'controlled_substance',
      'board',
      'certification',
      'enrollment',
      'clearance',
    ]);
  });

  it('drift meta covers fresh / aging / stale / divergent', () => {
    expect(Object.keys(DRIFT_META)).toEqual(['fresh', 'aging', 'stale', 'divergent']);
  });
});

describe('demoAutopilot', () => {
  it('clinician is marked isDemo === literal true', () => {
    const a = demoAutopilot();
    expect(a.clinician.isDemo).toBe(true);
  });

  it('trust level is a tier label, not the bare word "Verified"', () => {
    const a = demoAutopilot();
    expect(a.clinician.trustLevel).not.toBe('Verified');
    expect(a.clinician.trustLevel).toMatch(/^T[0-9]$/);
  });

  it('has 9 renewals across all 6 kinds', () => {
    const a = demoAutopilot();
    expect(a.renewals.length).toBe(9);
    const kinds = new Set(a.renewals.map((r) => r.kind));
    for (const k of ['license', 'controlled_substance', 'board', 'certification', 'enrollment', 'clearance']) {
      expect(kinds.has(k as never)).toBe(true);
    }
  });

  it('renewal actions cover all 4 categories', () => {
    const a = demoAutopilot();
    const actions = new Set(a.renewals.map((r) => r.action));
    expect(actions.has('monitor')).toBe(true);
    expect(actions.has('renew_self')).toBe(true);
    expect(actions.has('expiring')).toBe(true);
    expect(actions.has('urgent')).toBe(true);
  });

  it('has 6 portability rows covering the 3 design-mandated statuses', () => {
    const a = demoAutopilot();
    expect(a.portability.length).toBe(6);
    const statuses = new Set(a.portability.map((p) => p.status));
    expect(statuses.has('licensed')).toBe(true);
    expect(statuses.has('compact_eligible')).toBe(true);
    expect(statuses.has('dormant')).toBe(true);
  });

  it('has exactly one primary portability state', () => {
    const a = demoAutopilot();
    const primary = a.portability.filter((p) => p.primary);
    expect(primary.length).toBe(1);
  });

  it('has 3 NBA items ranked 1..3 with descending severity', () => {
    const a = demoAutopilot();
    expect(a.nba.length).toBe(3);
    expect(a.nba.map((n) => n.rank)).toEqual([1, 2, 3]);
    expect(a.nba.map((n) => n.severity)).toEqual(['high', 'medium', 'low']);
  });

  it('has 7 drift fields covering all 4 statuses including divergent', () => {
    const a = demoAutopilot();
    expect(a.drift.length).toBe(7);
    const statuses = new Set(a.drift.map((d) => d.status));
    expect(statuses.has('fresh')).toBe(true);
    expect(statuses.has('aging')).toBe(true);
    expect(statuses.has('stale')).toBe(true);
    expect(statuses.has('divergent')).toBe(true);
  });

  it('divergent drift fields have null verifiedAt', () => {
    const a = demoAutopilot();
    for (const d of a.drift) {
      if (d.status === 'divergent') {
        expect(d.verifiedAt).toBeNull();
      }
    }
  });

  it('has 6 trust factors with weights summing to 1.0', () => {
    const a = demoAutopilot();
    expect(a.trustFactors.length).toBe(6);
    expect(sumFactorWeights(a.trustFactors)).toBe(1);
  });

  it('does not name specific upstream vendors', () => {
    // Real upstream vendors (Medical Board of California, NCCPA, AHA,
    // CAQH, IRS, OIG, SAM.gov, NPDB, CMS, PECOS, IMLC, MedPro,
    // Cedar Health) are genericised in the demo so the page does not
    // imply real integrations.
    //
    // Word-boundary regex prevents false positives like "sam" matching
    // inside "same day" or "irs" matching inside other words.
    const a = demoAutopilot();
    const blob = JSON.stringify(a);
    const vendorPatterns: ReadonlyArray<RegExp> = [
      /Medical Board of California/i,
      /\bNCCPA\b/,
      /American Heart/i,
      /\bCAQH\b/,
      /\bIRS\b/,
      /\bOIG\b/,
      /\bSAM\.gov\b/i,
      /\bNPDB\b/,
      /\bPECOS\b/,
      /\bIMLC\b/,
      /\bMedPro\b/i,
      /\bCedar\b/i,
    ];
    for (const pattern of vendorPatterns) {
      expect(blob).not.toMatch(pattern);
    }
  });

  it('renders no banned overclaim copy', () => {
    const a = demoAutopilot();
    const blob = JSON.stringify(a).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('computeCompositeTrustScore', () => {
  it('weighted sum of factors', () => {
    const score = computeCompositeTrustScore([
      { label: 'a', weight: 0.5, score: 1.0, note: '' },
      { label: 'b', weight: 0.5, score: 0.5, note: '' },
    ]);
    expect(score).toBe(0.75);
  });

  it('demoAutopilot composite is in the [0, 1] band', () => {
    const a = demoAutopilot();
    const s = computeCompositeTrustScore(a.trustFactors);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe('computeRenewalCounts', () => {
  it('matches demoAutopilot composition', () => {
    const a = demoAutopilot();
    const c = computeRenewalCounts(a.renewals);
    expect(c.total).toBe(9);
    // From the fixture: 1 urgent, 1 expiring, 3 renew_self, 4 monitoring.
    expect(c.urgent).toBe(1);
    expect(c.expiring).toBe(1);
    expect(c.renewSelf).toBe(3);
    expect(c.monitoring).toBe(4);
    expect(c.urgent + c.expiring + c.renewSelf + c.monitoring).toBe(c.total);
  });
});
