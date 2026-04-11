/**
 * Confidence view projection — the pure, server-safe core of the
 * field-level provenance UI contract.
 *
 * Turns a {@link ConfidenceField} into a {@link FieldConfidenceView}: the
 * shape {@link FieldConfidenceBadge} (and any future compliance surface) needs to
 * render a glyph, a label, and a one-line compliance tooltip.
 *
 * ─ Design notes ────────────────────────────────────────────────────────────
 *
 *   • No 'use client' directive. This module is intentionally pure and
 *     server-safe so `ProfileView` can render in an RSC tree and so tests
 *     can exercise the projection without a React renderer. If a memoized
 *     React hook is needed later (e.g. `useFieldConfidence`), it should be
 *     a thin wrapper in `apps/web/hooks/` that calls `viewField` — DO NOT
 *     duplicate the projection logic.
 *
 *   • The `inferred` tooltip is compliance-mandated copy. See
 *     {@link INFERRED_TOOLTIP} below.
 *
 *   • A null/malformed field falls through to an `unknown`-typed view. This
 *     is the UI safety net behind `assertAllFieldsHaveConfidence` in
 *     `@domain-common/dataConfidence` — it guarantees the UI can NEVER
 *     render a bare value without a badge.
 */

import {
  SOURCE_LABELS,
  UNKNOWN_CONFIDENCE,
  isConfidenceField,
  type Confidence,
  type ConfidenceField,
  type ConfidenceType,
} from '@domain-common/dataConfidence';

// ── View shape ─────────────────────────────────────────────────────────────

/**
 * UI-facing representation of a {@link ConfidenceField}.
 *
 * Pairs the field value with everything a badge needs to render:
 *   - `type`        → 'verified' | 'inferred' | 'unknown'
 *   - `glyph`       → ✔ | ≈ | ⚠
 *   - `label`       → 'Verified' | 'Inferred' | 'Unknown'  (raw data label)
 *   - `sourceLabel` → human-readable source name (e.g. "NPPES")
 *   - `tooltip`     → one-line compliance-aware explanation
 */
export interface FieldConfidenceView<T> {
  readonly value: T;
  readonly confidence: Confidence;
  readonly type: ConfidenceType;
  readonly glyph: string;
  readonly label: string;
  readonly sourceLabel: string;
  readonly score: number;
  readonly tooltip: string;
}

// ── Presentation constants ─────────────────────────────────────────────────

const GLYPHS: Readonly<Record<ConfidenceType, string>> = Object.freeze({
  verified: '\u2714', // ✔
  inferred: '\u2248', // ≈
  unknown: '\u26A0', // ⚠
});

/**
 * Raw data-layer labels. Presentation layers MAY add clarifiers (the
 * canonical surface appends "(AI)" to the inferred label in its badge) but
 * the raw label here is what analytics, a11y fallbacks, and tests should
 * key off.
 */
const LABELS: Readonly<Record<ConfidenceType, string>> = Object.freeze({
  verified: 'Verified',
  inferred: 'Inferred',
  unknown: 'Unknown',
});

// ── Compliance-mandated copy ───────────────────────────────────────────────

/**
 * Tooltip for any `inferred` field. Do NOT append source name, score, or
 * reason to this string — the "not source verified" disclaimer is
 * load-bearing for NCQA posture and must read identically everywhere the
 * canonical badge is rendered.
 *
 * Changing this literal is a product/legal decision, not a styling one.
 */
export const INFERRED_TOOLTIP =
  'Inferred from available data — not source verified';

// ── Core projection ────────────────────────────────────────────────────────

/**
 * Build the view for a single ConfidenceField. Pure — safe to call outside
 * React for server rendering or tests.
 *
 * If `field` is missing or malformed, returns an `unknown`-typed view (the
 * UI safety net — see file header).
 */
export function viewField<T>(
  field: ConfidenceField<T> | null | undefined,
): FieldConfidenceView<T | null> {
  if (!isConfidenceField<T>(field)) {
    return {
      value: null,
      confidence: UNKNOWN_CONFIDENCE,
      type: 'unknown',
      glyph: GLYPHS.unknown,
      label: LABELS.unknown,
      sourceLabel: SOURCE_LABELS.UNKNOWN,
      score: 0,
      tooltip: buildTooltip('unknown', SOURCE_LABELS.UNKNOWN, 0),
    };
  }

  const { value, confidence } = field;
  const { type, source, score } = confidence;
  const sourceLabel = SOURCE_LABELS[source];

  return {
    value,
    confidence,
    type,
    glyph: GLYPHS[type],
    label: LABELS[type],
    sourceLabel,
    score,
    tooltip: buildTooltip(type, sourceLabel, score, confidence.reason),
  };
}

// ── Tooltip builder ────────────────────────────────────────────────────────

function buildTooltip(
  type: ConfidenceType,
  sourceLabel: string,
  score: number,
  reason?: string,
): string {
  // Inferred case is globally fixed by compliance — see INFERRED_TOOLTIP.
  if (type === 'inferred') return INFERRED_TOOLTIP;

  const head =
    type === 'verified'
      ? `Verified by ${sourceLabel}`
      : 'No source available';
  const body = `${head} (confidence ${score}/100)`;
  return reason ? `${body} — ${reason}` : body;
}
