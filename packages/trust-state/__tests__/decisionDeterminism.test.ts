import { describe, expect, it } from 'vitest';
import {
  calculateDeterministicElapsedDays,
  summarizeDeterministicDecision,
} from '../decisionDeterminism';

describe('decision determinism', () => {
  it('returns the same decision output for the same input on repeated calls', () => {
    const input = {
      verifiedEvidenceCount: 2,
      limitationLabels: ['State license source still pending'],
      explicitBlockers: [],
      nextAction: null,
      deaStatus: 'registered',
      licenseStatus: 'pending',
      exclusionStatus: 'CLEAR',
    } as const;

    const first = summarizeDeterministicDecision(input);
    const second = summarizeDeterministicDecision(input);

    expect(first).toEqual(second);
    expect(first.state).toBe('partial');
    expect(first.blockers).toEqual([]);
  });

  it('always blocks when DEA standing is expired even if verified evidence exists', () => {
    const result = summarizeDeterministicDecision({
      verifiedEvidenceCount: 3,
      limitationLabels: [],
      explicitBlockers: [],
      deaStatus: 'expired',
      licenseStatus: 'verified',
      exclusionStatus: 'CLEAR',
    });

    expect(result.state).toBe('blocked');
    expect(result.blockers).toContain('DEA registration expired');
  });

  it('routes access-required cases to credentialing review instead of a generic refresh', () => {
    const result = summarizeDeterministicDecision({
      verifiedEvidenceCount: 2,
      limitationLabels: ['State board access required'],
      explicitBlockers: [],
      deaStatus: 'registered',
      licenseStatus: 'pending',
      exclusionStatus: 'CLEAR',
    });

    expect(result.state).toBe('partial');
    expect(result.nextAction).toContain('institutional access');
    expect(result.nextAction).toContain('credentialing review');
  });

  it('routes manual-review cases to adjudication instead of a generic refresh', () => {
    const result = summarizeDeterministicDecision({
      verifiedEvidenceCount: 2,
      limitationLabels: ['Conflicting authority record'],
      explicitBlockers: [],
      deaStatus: 'registered',
      licenseStatus: 'verified',
      exclusionStatus: 'CLEAR',
    });

    expect(result.state).toBe('partial');
    expect(result.nextAction).toContain('Manual credentialing review');
    expect(result.nextAction).toContain('adjudicated');
  });

  it('calculates elapsed days conservatively and reproducibly for partial days', () => {
    const earlier = '2026-03-01T12:00:00.000Z';
    const later = '2026-03-02T11:59:59.000Z';

    expect(calculateDeterministicElapsedDays(earlier, later)).toBe(1);
    expect(calculateDeterministicElapsedDays(earlier, later)).toBe(1);
    expect(calculateDeterministicElapsedDays(later, earlier)).toBe(0);
    expect(calculateDeterministicElapsedDays(null, later)).toBeNull();
  });
});
