import { describe, expect, it } from 'vitest';
import {
  ACTION_OWNER,
  resolveBlockerOwnership,
  resolveStateBoardOwnership,
} from '@/lib/trust/action-owner';
import { blockerToCompletionLabel } from '@/components/passport/StartabilityCard';

// Composition-layer tests for the /passport surface.
//
// These tests do not render React — they assert the *surface contract*
// between `deriveBlockers()` + `resolveBlockerOwnership()` +
// `blockerToCompletionLabel()`. The render path on /passport must only
// consume strings produced by the ownership contract. If a future
// caller re-introduces a hardcoded CTA or completion label, these
// assertions surface the drift.

const KNOWN_BLOCKERS = [
  'On OIG exclusion list',
  'Exclusion check failed',
  'Medicare enrollment unresolved',
  'Not enrolled in Medicare',
] as const;

describe('/passport ownership composition', () => {
  it('every known blocker produces a non-empty owner-prefixed line', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      expect(ownership.ownerPrefix.trim().length).toBeGreaterThan(0);
      expect(ownership.actionLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('owner prefix and action label are distinct strings (no accidental drift)', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      expect(ownership.ownerPrefix).not.toBe(ownership.actionLabel);
    }
  });

  it('action label is a short verb, owner prefix is a full sentence', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      // Action label ≤ 6 words (concrete verb form).
      expect(ownership.actionLabel.split(/\s+/).length).toBeLessThanOrEqual(6);
      // Owner prefix reads as a sentence: ≥ 4 words.
      expect(ownership.ownerPrefix.split(/\s+/).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('completion label is non-empty for every known blocker', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const completion = blockerToCompletionLabel(blocker);
      expect(completion.trim().length).toBeGreaterThan(0);
      expect(completion.toLowerCase()).not.toContain('undefined');
    }
  });

  it('state-board step surfaces INSTITUTION ownership, never USER', () => {
    const ownership = resolveStateBoardOwnership();
    expect(ownership.owner).toBe(ACTION_OWNER.INSTITUTION);
    expect(ownership.ownerPrefix.toLowerCase()).not.toMatch(/^you\b/);
  });

  it('the set of action labels contains no generic "Take Action" fallback', () => {
    const labels = KNOWN_BLOCKERS.map(
      (blocker) => resolveBlockerOwnership(blocker).actionLabel.toLowerCase(),
    );
    expect(labels).not.toContain('take action');
    expect(labels).not.toContain('fix');
    expect(labels).not.toContain('resolve');
  });
});
