import { describe, expect, it } from 'vitest';
import type { PassportData } from '../lib/trust/passport-contract';
import {
  isDecisionGradeAuthorityCredential,
  resolveAuthorityAccordionStatus,
  resolveAuthorityDecisionBasisBucket,
  resolveAuthorityEvidenceLabel,
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
  resolveAuthoritySectionStatus,
  resolveAuthorityStatusLead,
  resolveAuthorityTitle,
  resolveAuthorityTrustStatus,
  resolveAuthorityVdsStatus,
} from '../lib/trust/passport-truth';

function buildCredential(
  overrides: Partial<PassportData['authority']['credentials'][number]> = {},
): PassportData['authority']['credentials'][number] {
  return {
    id: 'cred-1',
    domain: 'LICENSURE',
    type: 'STATE_LICENSE',
    status: 'ACTIVE',
    verificationLevel: 'SOURCE_VERIFIED',
    issuerName: 'California Medical Board',
    sourceId: 'STATE_BOARD',
    jurisdiction: 'CA',
    observedAt: '2026-03-23T12:00:00.000Z',
    verifiedAt: '2026-03-23T12:00:00.000Z',
    stale: false,
    confidenceLabel: 'HIGH',
    claimConfidenceLabel: 'HIGH',
    dataFreshness: 'Weekly',
    dataFreshnessLabel: 'Weekly',
    reviewRequired: false,
    authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
    ...overrides,
  };
}

describe('passport truth helpers', () => {
  it('keeps manual-only authority explicitly non-decision-grade across surfaces', () => {
    const credential = buildCredential({
      status: 'UNRESOLVED',
      authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
      participationStatus: 'manual_verification_required',
      sourceScope: 'STATE_BOARD_MANUAL',
      jurisdiction: 'TX',
    });

    expect(resolveAuthorityTitle(credential)).toBe('License verification — manual lane only (TX)');
    expect(resolveAuthorityMethodLabel(credential)).toBe('TX state board (manual)');
    expect(resolveAuthorityStatusLead(credential)).toBe('Manual only');
    expect(resolveAuthorityVdsStatus(credential)).toBe('unavailable');
    expect(resolveAuthorityTrustStatus(credential)).toBe('unavailable');
    expect(resolveAuthorityAccordionStatus(credential)).toBe('unavailable');
    expect(resolveAuthoritySectionStatus([credential], [])).toBe('unavailable');
    expect(resolveAuthorityEvidenceLabel(credential)).toBe('License source (TX)');
    expect(resolveAuthorityNote(credential)).toContain('is not decision-grade');
    expect(isDecisionGradeAuthorityCredential(credential)).toBe(false);
    expect(resolveAuthorityDecisionBasisBucket(credential)).toBe('missingOrAccessRequired');
  });

  it('marks institutional access gaps as access-required instead of verified', () => {
    const credential = buildCredential({
      status: 'UNRESOLVED',
      authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
      participationStatus: 'institution_access_unavailable',
      sourceScope: 'STATE_BOARD_CA_API',
    });

    expect(resolveAuthorityStatusLead(credential)).toBe('Access required');
    expect(resolveAuthorityVdsStatus(credential)).toBe('access required');
    expect(resolveAuthorityTrustStatus(credential)).toBe('access_required');
    expect(resolveAuthorityAccordionStatus(credential)).toBe('access_required');
    expect(resolveAuthorityNote(credential)).toContain('Access required.');
    expect(isDecisionGradeAuthorityCredential(credential)).toBe(false);
    expect(resolveAuthorityDecisionBasisBucket(credential)).toBe('missingOrAccessRequired');
  });

  it('keeps mixed authority states from collapsing to verified at the section level', () => {
    const active = buildCredential();
    const gated = buildCredential({
      id: 'cred-2',
      status: 'UNRESOLVED',
      authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
      participationStatus: 'institution_access_unavailable',
      sourceScope: 'FSMB_MED_API',
    });

    expect(resolveAuthoritySectionStatus([active], [])).toBe('checked');
    expect(resolveAuthoritySectionStatus([gated], [])).toBe('access_required');
    expect(resolveAuthoritySectionStatus([active, gated], [])).toBe('review_required');
    expect(isDecisionGradeAuthorityCredential(active)).toBe(true);
    expect(resolveAuthorityDecisionBasisBucket(active)).toBe('sourceBackedNow');
    expect(resolveAuthorityDecisionBasisBucket({
      ...active,
      id: 'cred-3',
      stale: true,
    })).toBe('stale');
  });
});
