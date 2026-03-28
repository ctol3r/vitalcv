import { describe, expect, it } from 'vitest';
import { buildEmployerReviewHref } from '../lib/trust/public-wedge-parity';

describe('public wedge review href contract', () => {
  it('preserves organization context, bundle fallback, and sharer attribution in the review URL', () => {
    expect(buildEmployerReviewHref('entity_123', {
      contextId: 'ctx_abc123',
      bundleId: 'bundle_456',
      from: 'Ada Lovelace',
    })).toBe('/review/entity_123?contextId=ctx_abc123&bundleId=bundle_456&from=Ada+Lovelace');
  });
});
