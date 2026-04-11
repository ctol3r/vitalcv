'use client';

import { useMemo } from 'react';

import {
  SOURCE_LABELS,
  UNKNOWN_CONFIDENCE,
  isConfidenceField,
  type Confidence,
  type ConfidenceField,
  type ConfidenceType,
} from '@domain-common/dataConfidence';

/**
 * UI-facing representation of a ConfidenceField.
 *
 * Pairs the field value with everything a badge needs to render:
 *   - `type`  → 'verified' | 'inferred' | 'unknown'
 *   - `glyph` → ✔ | ≈ | ⚠
 *   - `label` → 'Verified' | 'Inferred' | 'Unknown'
 *   - `sourceLabel` → human-readable source name
 *   - `tooltip` → full one-line explanation for the badge tooltip
 */
export interface FieldConfidenceView<T> {
  value: T;
  confidence: Confidence;
  type: ConfidenceType;
  glyph: string;
  label: string;
  sourceLabel: string;
  score: number;
  tooltip: string;
}

const GLYPHS: Readonly<Record<ConfidenceType, string>> = {
  verified: '\u2714', // ✔
  inferred: '\u2248', // ≈
  unknown: '\u26A0', // ⚠
};

const LABELS: Readonly<Record<ConfidenceType, string>> = {
  verified: 'Verified',
  inferred: 'Inferred',
  unknown: 'Unknown',
};

/**
 * Build the view for a single ConfidenceField. Pure — safe to call outside
 * React for server rendering or tests.
 *
 * If `field` is missing or malformed, returns an `unknown`-typed view. This
 * is the final safety net behind {@link assertAllFieldsHaveConfidence} — it
 * guarantees the UI can NEVER render a bare value without a badge.
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
      tooltip: 'No source available for this field.',
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

function buildTooltip(
  type: ConfidenceType,
  sourceLabel: string,
  score: number,
  reason?: string,
): string {
  const head =
    type === 'verified'
      ? `Verified by ${sourceLabel}`
      : type === 'inferred'
        ? `Inferred from ${sourceLabel}`
        : `Unknown source`;
  const body = `${head} (confidence ${score}/100)`;
  return reason ? `${body} — ${reason}` : body;
}

/**
 * React hook: produce a memoized badge-ready view for a single ConfidenceField.
 *
 * @example
 *   const nameView = useFieldConfidence(provider.name);
 *   return <Badge glyph={nameView.glyph} label={nameView.label} />;
 */
export function useFieldConfidence<T>(
  field: ConfidenceField<T> | null | undefined,
): FieldConfidenceView<T | null> {
  return useMemo(() => viewField(field), [field]);
}

/**
 * React hook: produce memoized views for a record of ConfidenceFields.
 *
 * Each key in `fields` is projected into a FieldConfidenceView, preserving
 * keys. Missing/malformed fields collapse to an `unknown`-typed view.
 *
 * @example
 *   const views = useFieldConfidences({
 *     name:     provider.name,
 *     license:  provider.license,
 *     specialty: provider.specialty,
 *   });
 *   return (
 *     <>
 *       <FieldRow view={views.name} />
 *       <FieldRow view={views.license} />
 *     </>
 *   );
 */
export function useFieldConfidences<
  K extends string,
  V extends Record<K, ConfidenceField<unknown> | null | undefined>,
>(fields: V): Record<K, FieldConfidenceView<unknown>> {
  // NOTE: memoized on `fields` identity. Callers should either pass a stable
  // reference (e.g. a value from state/props) or wrap their literal in their
  // own `useMemo`. We cannot spread-depend on values because React requires a
  // stable dependency array length across renders.
  return useMemo(() => {
    const out = {} as Record<K, FieldConfidenceView<unknown>>;
    for (const key of Object.keys(fields) as K[]) {
      out[key] = viewField(fields[key] ?? null);
    }
    return out;
  }, [fields]);
}
