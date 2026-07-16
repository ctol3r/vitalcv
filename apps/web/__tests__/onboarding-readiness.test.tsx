/**
 * onboarding-readiness.test.tsx — the honest trust-state → readiness-lane
 * mapping that finishes the canonical onboarding golden path in place.
 * Mirrors the homepage LiveNpiResult contract: a check-worthy state only for
 * genuinely source-backed / checked evidence; everything else is gated / review
 * / unavailable — never a false positive.
 */
import { describe, expect, it } from 'vitest';

import { trustStateToLanes } from '@/components/onboarding/OnboardingReadiness';

const byId = (lanes: ReturnType<typeof trustStateToLanes>, id: string) => lanes.find((l) => l.id === id)!;

describe('trustStateToLanes — honest mapping', () => {
  it('a strong record: identity source-backed, OIG checked', () => {
    const lanes = trustStateToLanes({ identityVerified: true, exclusionStatus: 'CLEAR', pecosStatus: 'ENROLLED', licensureStatus: 'unknown' });
    expect(byId(lanes, 'nppes').state).toBe('source_backed');
    expect(byId(lanes, 'oig').state).toBe('checked');
    expect(byId(lanes, 'pecos').state).toBe('source_backed');
    // Licensure is never auto-passed — state boards aren't wired.
    expect(byId(lanes, 'state').state).toBe('access_required');
  });

  it('never fabricates a pass: not-found/unchecked/unknown degrade honestly', () => {
    const lanes = trustStateToLanes({ identityVerified: false, exclusionStatus: 'UNCHECKED', pecosStatus: 'NOT_FOUND', licensureStatus: 'unknown' });
    expect(byId(lanes, 'nppes').state).toBe('access_required');
    expect(byId(lanes, 'oig').state).toBe('unavailable');
    expect(byId(lanes, 'pecos').state).toBe('needs_review');
    expect(byId(lanes, 'state').state).toBe('access_required');
  });

  it('an OIG exclusion surfaces as review, not a silent pass', () => {
    const lanes = trustStateToLanes({ exclusionStatus: 'EXCLUDED' });
    expect(byId(lanes, 'oig').state).toBe('needs_review');
  });

  it('null trust-state (source unreachable) yields all-gated lanes, no crash', () => {
    const lanes = trustStateToLanes(null);
    expect(lanes).toHaveLength(4);
    expect(byId(lanes, 'nppes').state).toBe('access_required');
    // No lane is ever affirmative when we have no data.
    expect(lanes.every((l) => l.state !== 'source_backed' && l.state !== 'checked')).toBe(true);
  });
});
