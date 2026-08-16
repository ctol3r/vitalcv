/**
 * vital-foundation.test.tsx — Wave 0A shared primitives.
 * Guards the NPI validation, the canonical evidence-state vocabulary, and the
 * StateChip / TrustGlyph render invariants (color-independent, no check for
 * gated/unavailable evidence).
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { checkNpi, isValidNpiChecksum, npiDigits } from '@/lib/vital/npi';
import { EVIDENCE_STATE, evidenceStateMeta, type EvidenceState } from '@/lib/vital/evidenceState';
import { EvidenceProvenanceChip as StateChip } from '@/lib/vital/evidenceStateToProvenance';
import { TrustGlyph } from '@/components/vital/TrustGlyph';
import { NpiInput } from '@/components/vital/NpiInput';

describe('vital/npi — validation', () => {
  // 1234567893 is the worked example from the CMS NPI check-digit spec
  // (123456789 + check digit 3): an EXTERNAL ground-truth vector, so an
  // algorithm error here cannot be masked by computing the expectation with
  // the code under test. NPPES result_count 0, verified 2026-08-16 — but a
  // valid-format number can be assigned later, so re-verify against NPPES
  // before reusing it anywhere that renders or fetches. Never use a
  // registrant's NPI here: only checksum-valid numbers can name real people.
  it('accepts the CMS worked-example NPI checksum (1234567893)', () => {
    expect(isValidNpiChecksum('1234567893')).toBe(true);
  });

  it('rejects a 10-digit number that fails the check digit', () => {
    expect(isValidNpiChecksum('1234567894')).toBe(false); // last digit tampered
    expect(isValidNpiChecksum('1234567890')).toBe(false);
  });

  it('checkNpi classifies each state', () => {
    expect(checkNpi('').validity).toBe('empty');
    expect(checkNpi('12ab').validity).toBe('not_numeric');
    expect(checkNpi('123456').validity).toBe('incomplete');
    expect(checkNpi('1234567894').validity).toBe('bad_checksum');
    const ok = checkNpi('1234567893');
    expect(ok.validity).toBe('valid');
    expect(ok.npi).toBe('1234567893');
  });

  it('npiDigits strips non-digits and caps at 10', () => {
    expect(npiDigits('123-456 7893xx99')).toBe('1234567893');
  });
});

describe('vital/evidenceState — vocabulary invariants', () => {
  it('only source-backed and checked are affirmative (may show a check)', () => {
    const affirmative = (Object.keys(EVIDENCE_STATE) as EvidenceState[]).filter(
      (s) => evidenceStateMeta(s).affirmative,
    );
    expect(affirmative.sort()).toEqual(['checked', 'source_backed']);
  });

  it('gated / unavailable / review states are NOT affirmative', () => {
    for (const s of ['access_required', 'unavailable', 'needs_review', 'self_attested', 'employer_decision'] as const) {
      expect(evidenceStateMeta(s).affirmative).toBe(false);
    }
  });
});

describe('evidence chip + TrustGlyph — render', () => {
  it('the chip renders the label text (not color-only)', () => {
    expect(renderToStaticMarkup(<StateChip state="source_backed" attribution={{ source: 'NPPES', asOf: 'Jul 15, 2026' }} />)).toContain('Source-backed');
    expect(renderToStaticMarkup(<StateChip state="access_required" attribution="declared" />)).toContain('Access required');
  });

  it('no evidence state renders an affirmative check glyph (LINT-07, new register)', () => {
    // UX-02 Step 4 deleted components/vital/StateChip; these surfaces now
    // render ProvenanceChip, whose register is dot-based. The old assertions
    // (`lucide-circle-check` on affirmative, `lucide-lock` on gated) described
    // a mechanism that no longer exists. The RULE they protected is unchanged
    // and is asserted here in the form the new register can carry.
    // `design-lint-state-chip.test.tsx` holds the declaration half.
    for (const s of ['source_backed', 'access_required', 'unavailable', 'needs_review'] as const) {
      expect(renderToStaticMarkup(<StateChip state={s} attribution="legend" />)).not.toContain('lucide-circle-check');
    }
  });

  it('separates affirmative from gated by WORD — what survives grayscale', () => {
    const backed = renderToStaticMarkup(<StateChip state="source_backed" attribution="legend" />);
    const gated = renderToStaticMarkup(<StateChip state="access_required" attribution="legend" />);
    expect(backed).toContain('Source-backed');
    expect(gated).toContain('Access required');
    expect(backed).not.toContain('Access required');
  });

  it('TrustGlyph always carries its label (never icon-only)', () => {
    expect(renderToStaticMarkup(<TrustGlyph state="unavailable" labelHidden />)).toContain('Unavailable');
  });
});

describe('vital/NpiInput — render', () => {
  it('renders the digit count and the not-PHI reassurance', () => {
    const html = renderToStaticMarkup(<NpiInput />);
    expect(html).toContain('0/10 digits');
    expect(html).toContain('public identifier — not PHI');
  });
});
