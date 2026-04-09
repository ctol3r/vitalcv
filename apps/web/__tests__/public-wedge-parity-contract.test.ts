import { describe, expect, it } from 'vitest';
import {
  buildEmployerReviewHref,
  buildExploreApplyHref,
  buildPassportEntityHref,
} from '../lib/trust/public-wedge-parity';

describe('public wedge review href contract', () => {
  it('preserves organization context, bundle fallback, and sharer attribution in the review URL', () => {
    expect(buildEmployerReviewHref('entity_123', {
      contextId: 'ctx_abc123',
      bundleId: 'bundle_456',
      from: 'Ada Lovelace',
    })).toBe('/review/entity_123?contextId=ctx_abc123&bundleId=bundle_456&from=Ada+Lovelace');
  });

  it('preserves passport-to-apply continuity when routing into explore', () => {
    expect(buildExploreApplyHref('1234567890', {
      roleId: 'opp_456',
      employerSlug: 'legacy-health',
    })).toBe('/explore?npi=1234567890&apply=opp_456&organizationSlug=legacy-health');
  });

  it('preserves apply context when handing a live role into the full passport route', () => {
    expect(buildPassportEntityHref('entity_123', {
      roleId: 'opp_456',
      roleTitle: 'Travel ICU Nurse',
      employerSlug: 'legacy-health',
      employerName: 'Legacy Health',
    })).toBe('/passport/entity_123?role=opp_456&roleTitle=Travel+ICU+Nurse&employer=legacy-health&employerName=Legacy+Health');
  });
});
