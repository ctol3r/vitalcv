import { describe, expect, it } from 'vitest';
import {
  getTrustStatusLabel,
  getVdsTrustStatusLabel,
  mapSourceCoverageStateToTrustStatus,
  resolveTrustUiStatus,
} from '../lib/trust/status-language';

describe('trust status language', () => {
  it('keeps shared label mapping aligned between accordion and VDS pills', () => {
    expect(getTrustStatusLabel('review_required')).toBe('Review required');
    expect(getTrustStatusLabel('access_required')).toBe('Access required');

    expect(getVdsTrustStatusLabel('review required')).toBe('Review required');
    expect(getVdsTrustStatusLabel('access required')).toBe('Access required');
    expect(getVdsTrustStatusLabel('not decision-grade')).toBe('Not decision-grade');
  });

  it('maps canonical source coverage states into honest trust UI states', () => {
    expect(mapSourceCoverageStateToTrustStatus('live', { kind: 'verification', satisfied: true })).toBe('verified');
    expect(mapSourceCoverageStateToTrustStatus('live', { kind: 'clearance', satisfied: true })).toBe('clear');
    expect(mapSourceCoverageStateToTrustStatus('live', { kind: 'generic', satisfied: false })).toBe('checked');
    expect(mapSourceCoverageStateToTrustStatus('stale')).toBe('stale');
    expect(mapSourceCoverageStateToTrustStatus('accessRequired')).toBe('access_required');
    expect(mapSourceCoverageStateToTrustStatus('reviewRequired')).toBe('review_required');
    expect(mapSourceCoverageStateToTrustStatus('notDecisionGrade')).toBe('pending');
    expect(mapSourceCoverageStateToTrustStatus('notChecked')).toBe('pending');
    expect(mapSourceCoverageStateToTrustStatus('mock')).toBe('demo');
  });

  it('lets demo mode override the underlying source state', () => {
    expect(resolveTrustUiStatus({
      demo: true,
      state: 'live',
      kind: 'verification',
      satisfied: true,
    })).toBe('demo');
  });
});
