/**
 * confidenceView — projection from ConfidenceField to FieldConfidenceView.
 *
 * Three things we're pinning here:
 *
 *   1. The type/glyph/label/sourceLabel/score mapping matches each source's
 *      classification. If SOURCE_WEIGHTS or classifyConfidence shifts, this
 *      test should loudly tell us our UI label implications changed.
 *
 *   2. The null/malformed safety net ALWAYS returns an unknown-typed view.
 *      This is the UI contract that ProfileView leans on — no field can
 *      ever reach the DOM without a badge.
 *
 *   3. INFERRED_TOOLTIP is the frozen compliance literal. If someone
 *      "improves" the copy, this test will block it at the test layer and
 *      force a product/legal conversation.
 */

import { describe, expect, it } from 'vitest';

import {
  confidenceField,
  fromSource,
  SOURCE_LABELS,
  UNKNOWN_CONFIDENCE,
  type Confidence,
} from '@domain-common/dataConfidence';

import {
  INFERRED_TOOLTIP,
  viewField,
} from '@/lib/profile/confidenceView';

describe('INFERRED_TOOLTIP', () => {
  it('is the frozen compliance literal', () => {
    // Changing this is a product decision, not a typo fix.
    expect(INFERRED_TOOLTIP).toBe(
      'Inferred from available data — not source verified',
    );
  });
});

describe('viewField — authoritative sources', () => {
  it('projects an NPPES field as verified with score 100', () => {
    const field = confidenceField('1346053246', fromSource('NPPES'));
    const view = viewField(field);

    expect(view.type).toBe('verified');
    expect(view.glyph).toBe('\u2714'); // ✔
    expect(view.label).toBe('Verified');
    expect(view.sourceLabel).toBe(SOURCE_LABELS.NPPES);
    expect(view.score).toBe(100);
    expect(view.value).toBe('1346053246');
    // Verified tooltip mentions the source and score, NOT the compliance line.
    expect(view.tooltip).toContain('Verified by');
    expect(view.tooltip).toContain('100/100');
    expect(view.tooltip).not.toBe(INFERRED_TOOLTIP);
  });

  it('projects a STATE_BOARD field as verified', () => {
    const field = confidenceField('CA-12345', fromSource('STATE_BOARD'));
    const view = viewField(field);

    expect(view.type).toBe('verified');
    expect(view.sourceLabel).toBe(SOURCE_LABELS.STATE_BOARD);
    expect(view.score).toBe(100);
  });

  it('includes reason in the tooltip when present on a verified field', () => {
    const confidence: Confidence = fromSource('NPPES', {
      reason: 'matched primary taxonomy',
    });
    const field = confidenceField('Emergency Medicine', confidence);
    const view = viewField(field);

    expect(view.tooltip).toContain('matched primary taxonomy');
  });
});

describe('viewField — inferred sources', () => {
  it('projects a USER_UPLOAD field as inferred with score 80', () => {
    const field = confidenceField('Macie Miller', fromSource('USER_UPLOAD'));
    const view = viewField(field);

    expect(view.type).toBe('inferred');
    expect(view.glyph).toBe('\u2248'); // ≈
    expect(view.label).toBe('Inferred');
    expect(view.sourceLabel).toBe(SOURCE_LABELS.USER_UPLOAD);
    expect(view.score).toBe(80);
  });

  it('projects an INFERENCE field as inferred with score 60', () => {
    const field = confidenceField('PA-C', fromSource('INFERENCE'));
    const view = viewField(field);

    expect(view.type).toBe('inferred');
    expect(view.score).toBe(60);
    expect(view.sourceLabel).toBe(SOURCE_LABELS.INFERENCE);
  });

  it('uses the frozen compliance tooltip for ANY inferred field', () => {
    // Irrespective of source, reason, or score, the tooltip is fixed.
    const a = viewField(confidenceField('x', fromSource('USER_UPLOAD')));
    const b = viewField(
      confidenceField(
        'y',
        fromSource('INFERENCE', { reason: 'derived from NPI record' }),
      ),
    );
    expect(a.tooltip).toBe(INFERRED_TOOLTIP);
    expect(b.tooltip).toBe(INFERRED_TOOLTIP);
  });

  it('collapses an inference-sourced field scoring below the inferred floor to unknown', () => {
    // classifyConfidence drops a score < INFERRED_THRESHOLD (50) to 'unknown'
    // even when the source was INFERENCE. This is a quiet but load-bearing
    // rule — if the threshold ever changes, this test pins it explicitly.
    const field = confidenceField(
      'weakly-derived',
      fromSource('INFERENCE', { score: 40 }),
    );
    const view = viewField(field);

    expect(view.type).toBe('unknown');
    expect(view.glyph).toBe('\u26A0'); // ⚠
    expect(view.label).toBe('Unknown');
  });
});

describe('viewField — safety net', () => {
  it('projects null to an unknown-typed view with null value', () => {
    const view = viewField(null);
    expect(view.type).toBe('unknown');
    expect(view.value).toBeNull();
    expect(view.label).toBe('Unknown');
    expect(view.sourceLabel).toBe(SOURCE_LABELS.UNKNOWN);
    expect(view.score).toBe(0);
    expect(view.confidence).toBe(UNKNOWN_CONFIDENCE);
  });

  it('projects undefined to an unknown-typed view with null value', () => {
    const view = viewField(undefined);
    expect(view.type).toBe('unknown');
    expect(view.value).toBeNull();
  });

  it('projects a malformed field-like object to an unknown-typed view', () => {
    // Anything that doesn't pass isConfidenceField → unknown. Cast is
    // deliberate: we're simulating what happens when ingest feeds us garbage.
    const malformed = { value: 'hmm', confidence: { wrong: true } };
    const view = viewField(malformed as never);
    expect(view.type).toBe('unknown');
    expect(view.value).toBeNull();
  });

  it('unknown-view tooltip does NOT use the inferred literal', () => {
    const view = viewField(null);
    expect(view.tooltip).not.toBe(INFERRED_TOOLTIP);
    expect(view.tooltip).toContain('No source available');
  });
});
