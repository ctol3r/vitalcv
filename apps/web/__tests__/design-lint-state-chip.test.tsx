import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import { EVIDENCE_STATE, type EvidenceState } from '@/lib/vital/evidenceState';
import {
  ProvenanceChip,
  PROVENANCE_META,
  PROVENANCE_ORDER,
  type ProvenanceState,
} from '@/design-system/components/ProvenanceChip';

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
 * `TRUTH_STATE_META`). `components/vital/StateChip.tsx` was the third chip and
 * was DELETED in UX-02 Step 4 — its states now render through
 * `EVIDENCE_TO_PROVENANCE` onto ProvenanceChip, which is what `render()` below
 * exercises.
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

  it.each(STATES)('%s renders no check glyph — the register is dot-based', (state) => {
    // Was `expect(hasCheck).toBe(EVIDENCE_STATE[state].affirmative)`, against
    // components/vital/StateChip's lucide icons. That component was deleted in
    // UX-02 Step 4; these states now render through EVIDENCE_TO_PROVENANCE →
    // ProvenanceChip, which draws dots, so NO state may draw a check.
    // `affirmative` remains load-bearing: the declaration tests below pin it,
    // and the ProvenanceChip block pins it to `checked` alone.
    expect(CHECK_PATH.test(render(state))).toBe(false);
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

/**
 * LINT-07 on ProvenanceChip (UX-02 Step 2).
 *
 * `PROVENANCE_META` gained an `affirmative` flag mirroring `EVIDENCE_STATE`'s,
 * so the one rule covers both chips while StateChip is retired into
 * ProvenanceChip. Without this block, every state that migrates onto the
 * 12-state vocabulary would silently leave LINT-07's coverage — the lint would
 * still pass, on a shrinking set.
 *
 * ProvenanceChip draws a dot, not a lucide check, so the render assertion is
 * necessarily "no check glyph appears". That is deliberately paired with the
 * declaration assertions below: if a future change introduces an affirmative
 * mark, the flag is already there to govern it, and `notFound` / `revoked` are
 * already pinned as non-affirmative.
 */
const P_STATES = PROVENANCE_ORDER as ReadonlyArray<ProvenanceState>;
const renderP = (state: ProvenanceState) =>
  renderToStaticMarkup(<ProvenanceChip state={state} attribution={{ legend: true }} />);

describe('LINT-07 — ProvenanceChip', () => {
  it('covers every state in the vocabulary, not a subset', () => {
    expect(P_STATES.length).toBe(Object.keys(PROVENANCE_META).length);
  });

  it.each(P_STATES)('%s renders with its declared label', (state) => {
    expect(renderP(state)).toContain(PROVENANCE_META[state].label);
  });

  it.each(P_STATES)('%s renders no check glyph (the register is dot-based)', (state) => {
    expect(CHECK_PATH.test(renderP(state))).toBe(false);
  });

  it('declares exactly one affirmative state, and it is `checked`', () => {
    const affirmative = P_STATES.filter((s) => PROVENANCE_META[s].affirmative);
    expect(affirmative).toEqual(['checked']);
  });

  it('never marks a gated, review, unavailable, or revoked state as affirmative', () => {
    for (const state of [
      'gated',
      'accessRequired',
      'reviewRequired',
      'unavailable',
      'notDecisionGrade',
      'previewOnly',
      'revoked',
      'selfAttested',
      'stale',
      'pending',
    ] as const) {
      expect(PROVENANCE_META[state].affirmative).toBe(false);
    }
  });

  it('never marks `notFound` affirmative — a source answering "no record" is a finding', () => {
    // The #934 defect in flag form: folding not-found into an affirmative
    // reading is how a registry returning result_count 0 read as source-backed.
    expect(PROVENANCE_META.notFound.affirmative).toBe(false);
  });

  it('distinguishes states by text, not by colour alone', () => {
    const labels = new Set(P_STATES.map((s) => PROVENANCE_META[s].label.toLowerCase()));
    expect(labels.size).toBe(P_STATES.length);
  });

  it('never labels any state with the bare word "Verified"', () => {
    for (const state of P_STATES) {
      expect(PROVENANCE_META[state].label.trim().toLowerCase()).not.toBe('verified');
    }
  });
});

/**
 * W1082 on ProvenanceChip — the runtime half.
 *
 * The compile-time half lives in `design-system/provenanceChipContract.check.tsx`
 * (outside __tests__, so `next build` checks it). These assert the RENDER
 * carries the attribution, which no type can prove.
 */
describe('W1082 — ProvenanceChip states its attribution', () => {
  it('announces source and as-of in the accessible name', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="checked" attribution={{ source: 'NPPES', asOf: '2026-07-14T09:12:00Z' }} />,
    );
    expect(html).toMatch(/aria-label="[^"]*NPPES[^"]*"/);
    expect(html).toMatch(/aria-label="[^"]*2026-07-14 09:12Z[^"]*"/);
  });

  it('renders the words "as-of not recorded" rather than dropping a null as-of', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="checked" attribution={{ source: 'OIG LEIE', asOf: null }} />,
    );
    // The qualifier lives INSIDE the value, visibly — not in fine print, and
    // never as a silent omission that reads as "checked, just now".
    expect(html).toContain('as-of not recorded');
    expect(html).toMatch(/aria-label="[^"]*as-of not recorded[^"]*"/);
  });

  it('announces a declared attribution without painting a provenance line', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="pending" attribution={{ declared: 'check in progress' }} />,
    );
    expect(html).toMatch(/aria-label="[^"]*check in progress[^"]*"/);
    expect(html).toContain('data-attribution="declared"');
    expect(html).not.toContain('font-mono');
  });

  it('marks an illustrative chip as an example, so it cannot read as a real result', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip state="checked" attribution={{ legend: true, source: 'NPPES' }} />,
    );
    expect(html).toMatch(/aria-label="[^"]*vocabulary example, not a result about anyone[^"]*"/);
    expect(html).toContain('data-attribution="legend"');
  });

  it('still states attribution when the provenance line is hidden for layout', () => {
    const html = renderToStaticMarkup(
      <ProvenanceChip
        state="checked"
        attribution={{ source: 'NPPES', asOf: '2026-07-14T09:12:00Z' }}
        provenanceLine="hidden"
      />,
    );
    expect(html).not.toContain('font-mono');
    expect(html).toMatch(/aria-label="[^"]*NPPES[^"]*"/);
  });
});
