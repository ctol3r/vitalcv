import { describe, expect, it } from 'vitest';
import { resolveEmployerDirectoryCountSummary } from '../lib/employers/directory-count-summary';

describe('employers page truth counts', () => {
  it('uses the displayed employer count while preserving total directory context', () => {
    const summary = resolveEmployerDirectoryCountSummary({
      employers: [
        {
          id: 'org_1',
          slug: 'alpha-health',
          name: 'Alpha Health',
          facilityType: 'Hospital',
          tagline: 'Regional acute care system',
          specialties: ['ICU'],
          states: ['CA'],
          openRoles: 3,
          trustScore: 92,
          hiringStatus: 'HIRING_NOW',
          verified: true,
          trustIndicators: [],
        },
        {
          id: 'org_2',
          slug: 'beta-medical',
          name: 'Beta Medical',
          facilityType: 'Clinic',
          tagline: 'Outpatient specialty network',
          specialties: ['Cardiology'],
          states: ['WA'],
          openRoles: 2,
          trustScore: 88,
          hiringStatus: 'ACTIVELY_HIRING',
          verified: true,
          trustIndicators: [],
        },
      ],
      total: 5,
    });

    expect(summary.displayed).toBe(2);
    expect(summary.total).toBe(5);
    expect(summary.helperText).toBe('2 shown on this page · 5 total live directory employers.');
  });

  it('keeps the helper text simple when the page shows the full live set', () => {
    const summary = resolveEmployerDirectoryCountSummary({
      employers: [],
      total: 0,
    });

    expect(summary.displayed).toBe(0);
    expect(summary.total).toBe(0);
    expect(summary.helperText).toBe('Organizations currently visible in the public directory.');
  });
});
