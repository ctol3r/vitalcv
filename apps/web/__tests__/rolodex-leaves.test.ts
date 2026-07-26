/**
 * rolodex-leaves.test.ts — SHD-3.2 rotary file.
 *
 * The homepage story flips like a rolodex. The masterlist's exit criterion:
 * at rest, at least TWO leaves each side of the active card stay visibly
 * fanned (the old curve faded neighbours to a whisper, hiding the card-file
 * mechanic). The homepage's custom clipped-scroll model can't be driven
 * headlessly, so this locks the contract at the curve level instead — where it
 * can't rot regardless of the runtime.
 */
import { describe, expect, it } from 'vitest';

import {
  rolodexLeafOpacity,
  rolodexLeafVisible,
  ROLODEX_OPACITY_OFFSETS,
  ROLODEX_OPACITY_VALUES,
} from '@/lib/home/rolodex';

describe('SHD-3.2 rotary file — visible fanned leaves', () => {
  it('keeps at least two leaves visible on EACH side of the active card', () => {
    // active
    expect(rolodexLeafVisible(0)).toBe(true);
    // two upcoming
    expect(rolodexLeafVisible(1)).toBe(true);
    expect(rolodexLeafVisible(2)).toBe(true);
    // two preceding (symmetric)
    expect(rolodexLeafVisible(-1)).toBe(true);
    expect(rolodexLeafVisible(-2)).toBe(true);
  });

  it('culls leaves beyond the two-each-side fan', () => {
    expect(rolodexLeafVisible(3)).toBe(false);
    expect(rolodexLeafVisible(-3)).toBe(false);
  });

  it('does not fade the ±1 neighbours to a whisper (the bug it replaces)', () => {
    // The pre-SHD-3.2 curve put ±1 at 0.55 and ±2 at ~0; the fan must be clearly
    // readable now.
    expect(rolodexLeafOpacity(1)).toBeGreaterThanOrEqual(0.85);
    expect(rolodexLeafOpacity(-1)).toBeGreaterThanOrEqual(0.85);
    expect(rolodexLeafOpacity(2)).toBeGreaterThanOrEqual(0.4);
    expect(rolodexLeafOpacity(-2)).toBeGreaterThanOrEqual(0.4);
  });

  it('keeps the active card the most opaque (front of the file)', () => {
    expect(rolodexLeafOpacity(0)).toBeGreaterThan(rolodexLeafOpacity(1));
    expect(rolodexLeafOpacity(0)).toBeGreaterThan(rolodexLeafOpacity(-1));
    expect(rolodexLeafOpacity(0)).toBe(1);
  });

  it('is symmetric — the up-fan and down-fan mirror each other', () => {
    for (const o of [0.5, 1, 1.5, 2]) {
      expect(rolodexLeafOpacity(o)).toBeCloseTo(rolodexLeafOpacity(-o), 6);
    }
  });

  it('curve arrays are aligned and monotonic away from the centre', () => {
    expect(ROLODEX_OPACITY_OFFSETS).toHaveLength(ROLODEX_OPACITY_VALUES.length);
    const mid = ROLODEX_OPACITY_OFFSETS.indexOf(0);
    expect(ROLODEX_OPACITY_VALUES[mid]).toBe(1);
    for (let i = mid; i < ROLODEX_OPACITY_VALUES.length - 1; i += 1) {
      expect(ROLODEX_OPACITY_VALUES[i]).toBeGreaterThanOrEqual(ROLODEX_OPACITY_VALUES[i + 1]);
    }
  });
});
