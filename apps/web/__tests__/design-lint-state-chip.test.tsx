import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StateChip } from '@/components/vital/StateChip';
import { EVIDENCE_STATE, type EvidenceState } from '@/lib/vital/evidenceState';

/**
 * LINT-07 (DG-18.4) — gated/unavailable must NEVER render a checkmark.
 *
 * This is do/don't pair #1 in the design system, and it is a truth rule before
 * it is a style rule: a check beside "access required" tells a clinician their
 * licensure was confirmed when nobody looked.
 *
 * `EVIDENCE_STATE` already declares the contract as an `affirmative` flag, so
 * these tests assert the RENDER agrees with the DECLARATION rather than
 * re-listing the states. That way adding a state, or flipping a flag, is
 * checked automatically — and a mismatch between what the data promises and
 * what the pixels show is exactly the failure this rule exists to catch.
 *
 * `truth-state-chip.test.tsx` guards a different component (`TruthStateChip` /
 * `TRUTH_STATE_META`); `components/vital/StateChip.tsx` had no coverage.
 */

/** lucide's CheckCircle2 draws this polyline; no other glyph in the set does. */
const CHECK_PATH = /m9 12 2 2 4-4|M9 12l2 2 4-4/i;

const STATES = Object.keys(EVIDENCE_STATE) as EvidenceState[];
const render = (state: EvidenceState) => renderToStaticMarkup(<StateChip state={state} attribution="declared" />);

describe('LINT-07 — the check glyph is reserved for affirmative states', () => {
  it('covers every declared evidence state', () => {
    expect(STATES.length).toBeGreaterThanOrEqual(7);
  });

  it.each(STATES)('%s renders with its declared label', (state) => {
    expect(render(state)).toContain(EVIDENCE_STATE[state].label);
  });

  it.each(STATES)('%s renders a check only if it is declared affirmative', (state) => {
    const hasCheck = CHECK_PATH.test(render(state));
    expect(hasCheck).toBe(EVIDENCE_STATE[state].affirmative);
  });

  it('keeps at least one non-affirmative state, or the rule is vacuous', () => {
    expect(STATES.some((s) => !EVIDENCE_STATE[s].affirmative)).toBe(true);
  });

  it('never marks a gated, review, or unavailable state as affirmative', () => {
    // The declaration itself must stay honest — a flipped flag would make the
    // render assertion above pass while the product lied.
    for (const state of ['access_required', 'needs_review', 'unavailable', 'employer_decision'] as const) {
      expect(EVIDENCE_STATE[state].affirmative).toBe(false);
    }
    // Self-attested is clinician-entered; a check would imply a source backed it.
    expect(EVIDENCE_STATE.self_attested.affirmative).toBe(false);
  });

  it('distinguishes states by text, not by colour alone', () => {
    const labels = new Set(STATES.map((s) => EVIDENCE_STATE[s].label.toLowerCase()));
    expect(labels.size).toBe(STATES.length);
  });

  it('never labels any state with the bare word "Verified"', () => {
    for (const state of STATES) {
      expect(EVIDENCE_STATE[state].label.trim().toLowerCase()).not.toBe('verified');
    }
  });
});
