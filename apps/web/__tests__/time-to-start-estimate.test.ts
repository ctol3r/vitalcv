import { describe, expect, it } from 'vitest';
import {
  buildPassportPilotTimeToStartEstimate,
  countMissingSources,
  estimatePilotTimeToStart,
} from '@/lib/trust/time-to-start-estimate';

describe('time-to-start estimate', () => {
  it('matches the pilot wedge example for mid-readiness clinicians', () => {
    const estimate = estimatePilotTimeToStart({
      readinessScore: 65,
      missingSources: 2,
      blockedStates: 1,
    });

    expect(estimate.estimatedStartLabel).toBe('45–60 days');
    expect(estimate.baselineLabel).toBe('~90 days');
    expect(estimate.timeSavedLabel).toBe('~30–45 days');
    expect(estimate.disclosureLabel).toBe('Pilot estimate — based on current credential readiness');
  });

  it('deduplicates incomplete source lanes across coverage buckets', () => {
    expect(countMissingSources({
      checked: ['NPPES_API'],
      stale: ['STATE_BOARD'],
      pending: ['PECOS_PUBLIC'],
      gated: [],
      unavailable: [],
      accessRequired: ['PECOS_PUBLIC'],
      reviewRequired: ['DEA'],
      notDecisionGrade: [],
      previewOnly: [],
    })).toBe(3);
  });

  it('treats blocked readiness as at least one blocker even when the blocker list is empty', () => {
    const estimate = buildPassportPilotTimeToStartEstimate({
      readiness: {
        status: 'BLOCKED',
        score: 55,
        level: 'L1',
        blockers: [],
        gaps: [],
        estimatedStartDays: null,
        nextActions: [],
      },
      sourceCoverage: {
        checks: [],
        summary: {
          checked: [],
          stale: [],
          pending: ['STATE_BOARD'],
          gated: [],
          unavailable: [],
          accessRequired: ['PECOS_PUBLIC'],
          reviewRequired: [],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
    });

    expect(estimate.blockedStates).toBe(1);
    expect(estimate.estimatedStartLabel).toBe('55–70 days');
    expect(estimate.timeSavedLabel).toBe('~20–35 days');
  });
});
