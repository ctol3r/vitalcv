import { describe, expect, it } from 'vitest';

import {
  ONBOARD_STATUS_META,
  PAYER_STATUS_META,
  PRIV_STATUS_META,
  computeActivationCounts,
  criticalPathCompletion,
  demoCase,
} from '@/lib/activation/activationData';

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

describe('PRIV / PAYER / ONBOARD status meta', () => {
  it('does NOT use bare "Verified" as a status label', () => {
    for (const map of [PRIV_STATUS_META, PAYER_STATUS_META, ONBOARD_STATUS_META]) {
      for (const meta of Object.values(map)) {
        expect(meta.label).not.toBe('Verified');
      }
    }
  });

  it('privilege statuses cover the 5 design-mandated states', () => {
    expect(Object.keys(PRIV_STATUS_META)).toEqual([
      'granted',
      'proctoring',
      'training',
      'pending_review',
      'not_requested',
    ]);
  });

  it('payer statuses cover the 6 design-mandated states', () => {
    expect(Object.keys(PAYER_STATUS_META)).toEqual([
      'enrolled',
      'submitted',
      'waiting_carrier',
      'preparing',
      'rejected',
      'not_in_scope',
    ]);
  });
});

describe('demoCase', () => {
  it('returns isDemo === literal true', () => {
    const c = demoCase();
    expect(c.meta.isDemo).toBe(true);
  });

  it('has 4 critical-path stages in canonical order', () => {
    const c = demoCase();
    expect(c.criticalPath.map((s) => s.id)).toEqual([
      'accepted',
      'privileged',
      'enrolled',
      'cleared',
    ]);
  });

  it('first stage (accepted) is done; last (cleared) is pending', () => {
    const c = demoCase();
    expect(c.criticalPath[0].state).toBe('done');
    expect(c.criticalPath[c.criticalPath.length - 1].state).toBe('pending');
  });

  it('DTS estimate is a P10/P50/P90 range with P10 ≤ P50 ≤ P90 < baseline', () => {
    const dts = demoCase().meta.dtsEstimate;
    expect(dts.p10).toBeLessThanOrEqual(dts.p50);
    expect(dts.p50).toBeLessThanOrEqual(dts.p90);
    expect(dts.p90).toBeLessThan(dts.baseline);
  });

  it('DTS trend ends at the current P50 estimate', () => {
    const c = demoCase();
    const last = c.meta.dtsTrend[c.meta.dtsTrend.length - 1];
    expect(last).toBe(c.meta.dtsEstimate.p50);
  });

  it('has 5 privileges with the 5 design-mandated statuses', () => {
    const c = demoCase();
    expect(c.privileges.length).toBe(5);
    const statuses = new Set(c.privileges.map((p) => p.status));
    expect(statuses.has('granted')).toBe(true);
    expect(statuses.has('proctoring')).toBe(true);
    expect(statuses.has('training')).toBe(true);
    expect(statuses.has('pending_review')).toBe(true);
  });

  it('has 8 payers covering federal / state / commercial', () => {
    const c = demoCase();
    expect(c.payers.length).toBe(8);
    const kinds = new Set(c.payers.map((p) => p.kind));
    expect(kinds.has('Federal')).toBe(true);
    expect(kinds.has('State')).toBe(true);
    expect(kinds.has('Commercial')).toBe(true);
  });

  it('has 10 onboarding tasks', () => {
    const c = demoCase();
    expect(c.onboardingTasks.length).toBe(10);
  });

  it('has 3 handoffs with exactly one marked isCurrent', () => {
    const c = demoCase();
    expect(c.handoffs.length).toBe(3);
    const current = c.handoffs.filter((h) => h.isCurrent === true);
    expect(current.length).toBe(1);
  });

  it('does not name a specific commercial carrier brand', () => {
    // Real commercial carriers (Aetna, UnitedHealthcare, BCBS, Kaiser,
    // Cigna) are renamed to "Commercial Carrier N" in the demo so
    // the page does not imply a real integration with any of them.
    const c = demoCase();
    const blob = JSON.stringify(c.payers).toLowerCase();
    for (const brand of ['aetna', 'unitedhealth', 'anthem', 'kaiser', 'cigna', 'cedar']) {
      expect(blob).not.toContain(brand);
    }
  });

  it('renders no banned overclaim copy', () => {
    const c = demoCase();
    const blob = JSON.stringify(c).toLowerCase();
    for (const phrase of BANNED) {
      expect(blob).not.toContain(phrase.toLowerCase());
    }
  });
});

describe('computeActivationCounts', () => {
  it('matches demoCase composition', () => {
    const c = demoCase();
    const counts = computeActivationCounts(c);
    expect(counts.privileges.total).toBe(5);
    expect(counts.privileges.granted).toBe(1);
    expect(counts.privileges.inFlight).toBe(3); // proctoring + training + pending_review
    expect(counts.payers.total).toBe(8);
    expect(counts.payers.enrolled).toBe(1);
    expect(counts.payers.rejected).toBe(1);
    expect(counts.onboarding.total).toBe(10);
    expect(counts.onboarding.done).toBe(2);
    expect(counts.onboarding.inFlight).toBe(5);
  });
});

describe('criticalPathCompletion', () => {
  it('is 0.25 when 1 of 4 stages is done (demoCase)', () => {
    const c = demoCase();
    expect(criticalPathCompletion(c)).toBeCloseTo(0.25, 5);
  });

  it('is 0 for an empty critical path', () => {
    expect(
      criticalPathCompletion({
        ...demoCase(),
        criticalPath: [],
      }),
    ).toBe(0);
  });
});
