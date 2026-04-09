import { describe, expect, it } from 'vitest';
import { buildApplyContinuationHref } from '../lib/apply-continuity';

describe('apply continuity helpers', () => {
  it('keeps holder opportunity continuity on the holder route', () => {
    expect(buildApplyContinuationHref({
      pathname: '/holder/opportunities',
      search: 'state=CA&organizationSlug=legacy-health',
      opportunityId: 'opp_1',
    })).toBe('/holder/opportunities?state=CA&organizationSlug=legacy-health&apply=opp_1');
  });

  it('falls back to the canonical explore route for unsupported paths', () => {
    expect(buildApplyContinuationHref({
      pathname: '/opportunities/opp_1',
      search: 'state=CA',
      opportunityId: 'opp_1',
    })).toBe('/explore?state=CA&apply=opp_1');
  });
});
