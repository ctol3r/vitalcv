import { describe, expect, it } from '@jest/globals';

import { detectCriticalDemand } from '../detectors/criticalDemand.js';
import { WorkforceDemandUrgency, normalizeWorkforceDemand } from '../models/WorkforceDemand.js';

describe('CriticalDemandDetector', () => {
  it('flags imminent unfilled shifts and specialty shortages', () => {
    const now = new Date('2025-11-15T00:00:00Z');
    const demands = [
      normalizeWorkforceDemand({
        id: 'd1',
        orgId: 'org-1',
        deptId: 'dept-icu',
        role: 'ICU RN',
        shiftTime: {
          start: '2025-11-15T02:00:00Z',
          end: '2025-11-15T10:00:00Z',
        },
        location: { state: 'CA' },
        urgency: WorkforceDemandUrgency.CRITICAL,
        requiredHeadcount: 2,
      }),
      normalizeWorkforceDemand({
        id: 'd2',
        orgId: 'org-1',
        deptId: 'dept-icu',
        role: 'ICU RN',
        shiftTime: {
          start: '2025-11-16T02:00:00Z',
          end: '2025-11-16T10:00:00Z',
        },
        location: { state: 'CA' },
        urgency: WorkforceDemandUrgency.ROUTINE,
        requiredHeadcount: 4,
      }),
    ];

    const fulfillments = [
      { demandId: 'd1', filledHeadcount: 1 },
      { demandId: 'd2', filledHeadcount: 1 },
    ];

    const alerts = detectCriticalDemand({
      demands,
      fulfillments,
      now,
      leadTimeMinutes: 240,
      capacityThreshold: 0.9,
    });

    expect(alerts).toHaveLength(2);
    expect(alerts.find((alert) => alert.reason === 'UNFILLED_SHIFT')).toBeDefined();
    const specialtyAlert = alerts.find((alert) => alert.reason === 'SPECIALTY_BELOW_CAPACITY');
    expect(specialtyAlert).toBeDefined();
    expect(specialtyAlert?.shortage).toBeGreaterThan(0);
  });
});


