import {
  buildNextBestActionApiFailure,
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
      title: 'Next best action unavailable',
      actionLabel: 'Unavailable',
      confidence: 0,
      confidenceLabel: 'LOW',
      isFailure: true,
    });
  });

  it('maps confidence labels predictably', () => {
    expect(getNextBestActionConfidenceLabel(0.9)).toBe('HIGH');
    expect(getNextBestActionConfidenceLabel(0.7)).toBe('MEDIUM');
    expect(getNextBestActionConfidenceLabel(0.4)).toBe('LOW');
  });
});
