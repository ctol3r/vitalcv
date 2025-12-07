import { describe, expect, it } from '@jest/globals';

import type { CompactsStatusData } from '../../compacts/models/CompactsStatus.js';
import type { JobPostingWithCompacts } from '../compactAwareMatcher.js';
import { evaluateJobAgainstCompacts } from '../compactAwareMatcher.js';

const baseStatus: CompactsStatusData = {
  clinicianDid: 'did:example:compact',
  imlcStatus: 'LICENSED',
  imlcHomeState: 'TX',
  imlcCompactStates: ['WA', 'UT'],
  psypactStatus: 'NOT_ELIGIBLE',
  psypactStates: [],
  counselingStatus: 'NOT_ELIGIBLE',
  counselingHomeState: undefined,
  counselingStates: [],
  lastComputedAt: new Date().toISOString(),
  nextRefreshAt: new Date().toISOString(),
  metadata: {},
};

const job: JobPostingWithCompacts = {
  id: 'job-imlc',
  title: 'Compact-enabled physician role',
  specialty: '207Q00000X',
  requiredStates: ['WA'],
  targetLicenseJurisdictions: [],
  imlcAllowed: true,
  psypactAllowed: false,
  counselingCompactAllowed: false,
  compactAllowed: true,
  modality: 'telehealth',
  telehealth: true,
};

describe('compact-aware matcher helper', () => {
  it('marks jobs as eligible when IMLC covers the job state', () => {
    const result = evaluateJobAgainstCompacts(baseStatus, job);
    expect(result.matchEligible).toBe(true);
    expect(result.compactMatches.imlc).toBe(true);
    expect(result.eligibleStates).toContain('WA');
  });
});

