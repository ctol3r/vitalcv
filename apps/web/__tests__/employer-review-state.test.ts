import { describe, expect, it } from 'vitest';
import { isAcceptBlockedDecisionPosture } from '../lib/employer-review-state';

describe('employer review state guards', () => {
  it('disables accept only for BLOCKED decision posture', () => {
    expect(isAcceptBlockedDecisionPosture('BLOCKED')).toBe(true);
    expect(isAcceptBlockedDecisionPosture('READY')).toBe(false);
    expect(isAcceptBlockedDecisionPosture('PARTIAL')).toBe(false);
    expect(isAcceptBlockedDecisionPosture(null)).toBe(false);
  });
});
