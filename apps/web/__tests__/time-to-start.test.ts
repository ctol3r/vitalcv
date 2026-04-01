import { describe, expect, it } from 'vitest';
import {
  buildTimeToStartEstimate,
  resolveTimeToStartPenalties,
} from '../lib/trust/time-to-start';

describe('time-to-start estimate helpers', () => {
  it('defaults to believable range-based copy', () => {
    const estimate = buildTimeToStartEstimate();

    expect(estimate.withoutVitalCvLabel).toBe('~90 days');
    expect(estimate.withVitalCvLabel).toBe('~45-60 days');
    expect(estimate.timeSavedLabel).toBe('~30-45 days');
  });

  it('maps explicit licensure, enrollment, and stale signals to penalties', () => {
    const penalties = resolveTimeToStartPenalties({
      blockers: [
        'Proof missing: LICENSURE',
        'Medicare enrollment not found — submit PECOS enrollment (45–60 days)',
      ],
      gaps: ['PECOS enrollment verification stale'],
    });

    expect(penalties).toEqual({
      missingLicense: true,
      missingEnrollment: true,
      staleVerification: true,
    });
  });

  it('widens the with-vitalcv range when onboarding blockers are present', () => {
    const estimate = buildTimeToStartEstimate({
      blockers: ['Medicare enrollment not found — submit PECOS enrollment (45–60 days)'],
      gaps: ['PECOS enrollment verification stale'],
    });

    expect(estimate.penaltyDays).toBe(30);
    expect(estimate.withVitalCvLabel).toBe('~75-90 days');
    expect(estimate.timeSavedLabel).toBe('~0-15 days');
  });

  it('clamps the adjusted range so it never exceeds the baseline', () => {
    const estimate = buildTimeToStartEstimate({
      blockers: [
        'Proof missing: LICENSURE',
        'Medicare enrollment not found — submit PECOS enrollment (45–60 days)',
      ],
      gaps: ['PECOS enrollment verification stale'],
    });

    expect(estimate.withVitalCvLabel).toBe('~90 days');
    expect(estimate.timeSavedLabel).toBe('~0 days');
  });
});
