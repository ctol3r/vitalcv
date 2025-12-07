import { describe, expect, it } from '@jest/globals';

import type { CompactsStatusData } from '../../compacts/models/CompactsStatus.js';
import { evaluateCompactRule } from '../rules/compactRule.js';

function buildCompactsStatus(overrides: Partial<CompactsStatusData> = {}): CompactsStatusData {
  return {
    clinicianDid: 'did:example:123',
    imlcStatus: 'NOT_ELIGIBLE',
    imlcHomeState: undefined,
    imlcCompactStates: [],
    psypactStatus: 'NOT_ELIGIBLE',
    psypactStates: [],
    counselingStatus: 'NOT_ELIGIBLE',
    counselingHomeState: undefined,
    counselingStates: [],
    lastComputedAt: new Date().toISOString(),
    nextRefreshAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  } as CompactsStatusData;
}

describe('matcher compact rule', () => {
  it('reports IMLC eligibility when coverage exists', () => {
    const status = buildCompactsStatus({
      imlcStatus: 'LICENSED',
      imlcHomeState: 'TX',
      imlcCompactStates: ['WA', 'UT'],
    });

    const result = evaluateCompactRule(status, 'IMLC', 'WA');
    expect(result).toBeTruthy();
    expect(result?.eligible).toBe(true);
  });

  it('returns null when compact data is unavailable', () => {
    const status = buildCompactsStatus();
    const result = evaluateCompactRule(status, 'IMLC', 'WA');
    expect(result).toBeNull();
  });

  it('supports PSYPACT coverage', () => {
    const status = buildCompactsStatus({
      psypactStatus: 'ACTIVE',
      psypactStates: ['AZ', 'WA'],
    });

    const result = evaluateCompactRule(status, 'PSYPACT', 'WA');
    expect(result).toBeTruthy();
    expect(result?.eligible).toBe(true);
  });
});

