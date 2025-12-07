import { describe, expect, it } from '@jest/globals';
import { DEFAULT_STATE_GRAPH } from '../compactGraph.js';
import { evaluateAprnCompactRules } from '../rules/aprnRules.js';

const TX_PARTICIPATION = DEFAULT_STATE_GRAPH.APRN?.TX;

describe('APRN compact rules', () => {
  it('requires an active RN license', () => {
    const result = evaluateAprnCompactRules({
      homeState: 'TX',
      residencyState: 'TX',
      rnLicenseActive: false,
      participation: TX_PARTICIPATION,
    });

    expect(result.isEligible).toBe(false);
    expect(result.rnCompactRequired).toBe(true);
    expect(result.reason).toMatch(/RN license/i);
  });

  it('requires residency to match when flagged by metadata', () => {
    const result = evaluateAprnCompactRules({
      homeState: 'TX',
      residencyState: 'CO',
      rnLicenseActive: true,
      participation: TX_PARTICIPATION,
    });

    expect(result.isEligible).toBe(false);
    expect(result.requiresResidency).toBe(true);
    expect(result.reason).toMatch(/Residency/);
  });

  it('enforces waiting period when clinician recently relocated', () => {
    const asOf = new Date('2025-03-01');
    const result = evaluateAprnCompactRules({
      homeState: 'TX',
      residencyState: 'TX',
      rnLicenseActive: true,
      lastMoveDate: new Date('2025-02-15'),
      asOf,
      participation: TX_PARTICIPATION,
    });

    expect(result.isEligible).toBe(false);
    expect(result.needsWaitingPeriod).toBe(true);
    expect(result.waitingPeriodEndsAt).toBeDefined();
  });

  it('allows privileges once residency and waiting period are satisfied', () => {
    const result = evaluateAprnCompactRules({
      homeState: 'TX',
      residencyState: 'TX',
      rnLicenseActive: true,
      lastMoveDate: new Date('2024-12-01'),
      asOf: new Date('2025-02-15'),
      participation: TX_PARTICIPATION,
    });

    expect(result.needsWaitingPeriod).toBe(false);
    expect(result.isEligible).toBe(true);
  });
});

