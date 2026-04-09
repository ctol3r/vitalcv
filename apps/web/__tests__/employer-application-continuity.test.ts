import { describe, expect, it } from 'vitest';
import { resolveEmployerApplicationReviewLink } from '../lib/employer/application-continuity';

describe('employer application continuity', () => {
  it('preserves the active employer review route when continuity is present', () => {
    expect(resolveEmployerApplicationReviewLink({
      continuity: {
        reviewHref: '/review/entity_123?contextId=ctx_1',
      },
    })).toEqual({
      href: '/review/entity_123?contextId=ctx_1',
      label: 'Open review',
      isFallback: false,
    });
  });

  it('falls back to request review instead of archived verifier inbox routes', () => {
    expect(resolveEmployerApplicationReviewLink({
      continuity: {
        reviewHref: null,
      },
    })).toEqual({
      href: '/review/request',
      label: 'Request review',
      isFallback: true,
    });
  });
});
