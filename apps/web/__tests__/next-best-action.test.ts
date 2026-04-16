import {
  buildNextBestActionApiFailure,
  getNextBestActionEvidenceLabel,
  getNextBestActionConfidenceLabel,
  normalizeNextBestAction,
} from '@/lib/next-best-action';

describe('next best action normalization', () => {
  it('returns null when no real NBA payload is provided', () => {
    expect(normalizeNextBestAction()).toBeNull();
  });

  it('normalizes a real omega nba payload', () => {
    expect(normalizeNextBestAction({
      action: 'reverify',
      reason: ' employers requested more data twice ',
      confidence: 0.92,
      evidenceCount: 4,
    })).toMatchObject({
      kind: 'REVERIFY',
      title: 'Refresh verification',
      description: 'employers requested more data twice',
      actionLabel: 'Reverify',
      confidence: 0.92,
      confidenceLabel: 'HIGH',
      evidenceCount: 4,
    });
  });

  it('preserves actor-specific guidance without changing the action kind', () => {
    expect(normalizeNextBestAction({
      action: 'proceed',
      reason: 'base reason',
      summary: 'Decision: Proceed. Risk: Low. Next action: Approve candidate.',
      confidence: 0.81,
      evidenceCount: 3,
      actorType: 'employer',
      highlights: ['State board confirms an active license.'],
      blockers: ['PECOS confirmation is due for refresh.'],
      decision: 'PROCEED',
      nextStep: 'Approve candidate',
      riskLevel: 'LOW',
    })).toMatchObject({
      kind: 'PROCEED',
      actorType: 'employer',
      description: 'Decision: Proceed. Risk: Low. Next action: Approve candidate.',
      highlights: ['State board confirms an active license.'],
      blockers: ['PECOS confirmation is due for refresh.'],
      decision: 'PROCEED',
      nextStep: 'Approve candidate',
      riskLevel: 'LOW',
    });
  });

  it('returns null when the action is not recognized', () => {
    expect(normalizeNextBestAction({
      action: 'hold',
      reason: 'not a backend nba action',
      confidence: 0.7,
      evidenceCount: 2,
    })).toBeNull();
  });

  it('standardizes confidence values passed as whole percentages', () => {
    expect(normalizeNextBestAction({
      action: 'review_manually',
      confidence: 72,
      evidenceCount: 1,
    })).toMatchObject({
      kind: 'REVIEW_MANUALLY',
      confidence: 0.72,
      confidenceLabel: 'MEDIUM',
      actionLabel: 'Review manually',
    });
  });

  it('builds a safe API-failure fallback instead of a mock success state', () => {
    expect(buildNextBestActionApiFailure()).toMatchObject({
      kind: 'REVIEW_MANUALLY',
      title: 'Next step unavailable',
      actionLabel: 'Unavailable',
      confidence: 0,
      confidenceLabel: 'LOW',
      isFailure: true,
    });
  });

  it('formats evidence labels for user-facing badges', () => {
    expect(getNextBestActionEvidenceLabel(0)).toBe('Verified source review pending');
    expect(getNextBestActionEvidenceLabel(1)).toBe('1 source-backed record');
    expect(getNextBestActionEvidenceLabel(4)).toBe('4 source-backed records');
  });

  it('maps confidence labels predictably', () => {
    expect(getNextBestActionConfidenceLabel(0.9)).toBe('HIGH');
    expect(getNextBestActionConfidenceLabel(0.7)).toBe('MEDIUM');
    expect(getNextBestActionConfidenceLabel(0.4)).toBe('LOW');
  });
});
