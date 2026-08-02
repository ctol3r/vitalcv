import { describe, expect, it } from 'vitest';

import { deriveHomePhase } from '@/components/home/ask/AskHome';

/**
 * Wave 4 — the hero phase (contract §7).
 *
 * `data-home-phase` is the single marker the first screen choreographs around.
 * It is a styling coordinate, so these tests pin the STATE MACHINE, not any
 * paint: which inputs produce which phase, and — the part that matters for
 * truth — that a failed lookup is named as a system state rather than a
 * finding about the clinician.
 */
describe('hero phase', () => {
  const before = (inputState: Parameters<typeof deriveHomePhase>[0]['inputState']) =>
    deriveHomePhase({ submitted: false, resultPhase: null, inputState });

  it('is idle until the visitor engages the field', () => {
    expect(before('idle')).toBe('idle');
    // A field nobody can type into has not been engaged with.
    expect(before('disabled')).toBe('idle');
  });

  it('is active for every state that means someone is typing', () => {
    for (const state of ['focused-empty', 'editing', 'valid', 'invalid', 'submitting'] as const) {
      expect(before(state), `${state} should read as active`).toBe('active');
    }
  });

  it('follows the result once an NPI is submitted', () => {
    const after = (resultPhase: Parameters<typeof deriveHomePhase>[0]['resultPhase']) =>
      deriveHomePhase({ submitted: true, resultPhase, inputState: 'idle' });

    expect(after('resolving')).toBe('resolving');
    expect(after('resolved')).toBe('resolved');
    // Null = submitted but the result has not reported yet. Resolving is the
    // only honest reading; anything else would claim an outcome that has not
    // happened.
    expect(after(null)).toBe('resolving');
  });

  /**
   * The rename is the point. `LiveNpiResult` calls a failed fetch `error`; the
   * hero calls it `system-error` so the markup itself keeps saying that the
   * SYSTEM failed, not that something is wrong with this clinician. A CSS
   * author styling `[data-home-phase]` should never be able to reach for a
   * state that reads as an adverse finding.
   */
  it('names a failed lookup as a system state, never as a finding', () => {
    expect(deriveHomePhase({ submitted: true, resultPhase: 'error', inputState: 'idle' })).toBe(
      'system-error',
    );
  });

  it('returns to idle when the result is released on reset', () => {
    // Reset clears both halves; the phase must fall back, not stick on the
    // outcome that produced it.
    expect(deriveHomePhase({ submitted: false, resultPhase: null, inputState: 'idle' })).toBe(
      'idle',
    );
  });

  it('ignores a stale result phase once the submission is cleared', () => {
    // Defence in depth: even if a reset left `resultPhase` behind, an unsubmitted
    // hero may not advertise a resolved lookup.
    expect(deriveHomePhase({ submitted: false, resultPhase: 'resolved', inputState: 'idle' })).toBe(
      'idle',
    );
  });
});
