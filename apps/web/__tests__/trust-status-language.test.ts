import { describe, expect, it } from 'vitest';
import {
  getStatusDisplayLabel,
  getStatusTone,
  getTrustStatusLabel,
  getVdsTrustStatusLabel,
  isBlockingStatus,
  isInspectableStatus,
  isPositiveStatus,
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
    expect(mapSourceCoverageStateToTrustStatus('checked', { kind: 'verification', satisfied: true })).toBe('verified');
    expect(mapSourceCoverageStateToTrustStatus('checked', { kind: 'clearance', satisfied: true })).toBe('clear');
    expect(mapSourceCoverageStateToTrustStatus('checked', { kind: 'generic', satisfied: false })).toBe('checked');
    expect(mapSourceCoverageStateToTrustStatus('stale')).toBe('stale');
    expect(mapSourceCoverageStateToTrustStatus('accessRequired')).toBe('access_required');
    expect(mapSourceCoverageStateToTrustStatus('reviewRequired')).toBe('review_required');
    expect(mapSourceCoverageStateToTrustStatus('notDecisionGrade')).toBe('pending');
    expect(mapSourceCoverageStateToTrustStatus('pending')).toBe('pending');
    expect(mapSourceCoverageStateToTrustStatus('previewOnly')).toBe('demo');
  });

  it('lets demo mode override the underlying source state', () => {
    expect(resolveTrustUiStatus({
      demo: true,
      state: 'checked',
      kind: 'verification',
      satisfied: true,
    })).toBe('demo');
  });

  it('exposes shared tone and inspection helpers for canonical statuses', () => {
    expect(getStatusTone('verified')).toBe('positive');
    expect(getStatusTone('checked')).toBe('informational');
    expect(getStatusTone('access_required')).toBe('warning');
    expect(getStatusTone('review_required')).toBe('critical');
    expect(getStatusTone('preview_only')).toBe('preview_only');

    expect(isPositiveStatus('checked')).toBe(true);
    expect(isPositiveStatus('pending')).toBe(false);
    expect(isBlockingStatus('review_required')).toBe(true);
    expect(isBlockingStatus('clear')).toBe(false);
    expect(isInspectableStatus('preview_only')).toBe(true);
    expect(isInspectableStatus('access_required')).toBe(false);
  });

  it('keeps domain-specific labels from overstating canonical truth', () => {
    expect(getStatusDisplayLabel('clear', 'No sanctions found')).toBe('No sanctions found');
    expect(getStatusDisplayLabel('preview_only', 'Preview only')).toBe('Preview only');
    expect(getStatusDisplayLabel('checked', 'Enrolled')).toBe('Checked');
    expect(getStatusDisplayLabel('pending', 'Verified')).toBe('Pending');
  });
});
