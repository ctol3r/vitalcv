import { describe, expect, it } from '@jest/globals';

import {
  WorkforceDemandUrgency,
  calculateCoverageGap,
  mergePrivilegeCodes,
  normalizeWorkforceDemand,
} from '../models/WorkforceDemand.js';

describe('WorkforceDemand model', () => {
  it('normalizes shift time inputs and enforces ordering', () => {
    const demand = normalizeWorkforceDemand({
      orgId: 'org-1',
      deptId: 'dept-icu',
      role: 'ICU RN',
      privilegeCodes: ['ACLS'],
      shiftTime: {
        start: '2025-11-15T22:00:00Z',
        end: '2025-11-16T06:00:00Z',
        timezone: 'UTC',
      },
      location: {
        state: 'ca',
        city: 'San Francisco',
      },
      urgency: WorkforceDemandUrgency.PRIORITY,
      requiredHeadcount: 2,
    });

    expect(demand.shiftTime.start).toBeInstanceOf(Date);
    expect(demand.location.state).toBe('CA');
  });

  it('computes coverage gaps and statuses', () => {
    const demand = normalizeWorkforceDemand({
      orgId: 'org-1',
      deptId: 'dept-icu',
      role: 'ICU RN',
      privilegeCodes: [],
      shiftTime: {
        start: new Date('2025-11-15T22:00:00Z'),
        end: new Date('2025-11-16T06:00:00Z'),
      },
      location: {},
      requiredHeadcount: 3,
      fulfilledHeadcount: 1,
    });

    const gap = calculateCoverageGap(demand);
    expect(gap.deficit).toBe(2);
    expect(gap.status).toBe('AT_RISK');
  });

  it('merges privilege codes uniquely and preserves order', () => {
    const merged = mergePrivilegeCodes(['ACLS', 'CRRT'], ['CRRT', 'VENT'], undefined, ['  ACLS  ']);
    expect(merged).toEqual(['ACLS', 'CRRT', 'VENT']);
  });
});


