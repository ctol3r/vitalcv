/**
 * Tier resolver — derives a categorical confidence tier from field metadata.
 *
 * Surfaces are not required to use this. It's a convenience for callers that
 * carry source/recall metadata on their data shape and want a deterministic
 * tier without writing the decision tree by hand.
 *
 * Decision tree (matches confidenceDoctrineNarrative):
 *   { conflict: true } | { recall: 'conflict' }                            → contradicted
 *   value is null/empty | onFile === false | { recall: 'none' }            → unknown
 *   { recall: 'primary' } | source ∈ KNOWN_PRIMARY_SOURCES                 → verified
 *   { recall: 'inferred' | 'document' } | source === 'cv-upload'           → inferred
 *   default                                                                → inferred
 */

import { useMemo } from 'react';
import type { ConfidenceTier } from '@/components/vds/confidence/doctrine';

/**
 * Source identifiers we treat as primary registries. Conservative — adding to
 * this list MUST be paired with verification that the source genuinely
 * publishes a primary record (not a derivative feed).
 */
export const KNOWN_PRIMARY_SOURCES = [
  'NPPES',
  'DEA',
  'PECOS',
  'NPDB',
  'OIG',
  'SAM',
  'NURSYS',
  'CAQH',
] as const;

export type FieldRecallKind =
  | 'primary'
  | 'inferred'
  | 'document'
  | 'conflict'
  | 'none';

export interface ConfidenceFieldMetadata {
  /** Free-form source identifier (e.g. 'NPPES (CMS)' or 'cv-upload'). */
  source?: string | null;
  /** How the value was recalled. Most authoritative signal when set. */
  recall?: FieldRecallKind;
  /** Pre-resolved tier; if set, overrides everything else. */
  tier?: ConfidenceTier;
  /** True when two authoritative sources disagree on this field. */
  conflict?: boolean;
  /** Whether the field is on file at all. False ⇒ unknown. */
  onFile?: boolean;
  /** The field's value. Empty/null/undefined ⇒ unknown. */
  value?: unknown;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Pure resolver — same input, same tier. Use this in server code, tests, and
 * any non-React caller. React components should prefer `useConfidenceTier`.
 */
export function resolveConfidenceTier(
  field: ConfidenceFieldMetadata,
): ConfidenceTier {
  if (field.tier) return field.tier;
  if (field.conflict || field.recall === 'conflict') return 'contradicted';
  if (
    field.onFile === false ||
    field.recall === 'none' ||
    isEmptyValue(field.value)
  ) {
    return 'unknown';
  }
  if (field.recall === 'primary') return 'verified';
  if (field.recall === 'inferred' || field.recall === 'document') {
    return 'inferred';
  }
  if (field.source === 'cv-upload') return 'inferred';
  if (field.source) {
    const upper = field.source.toUpperCase();
    if (KNOWN_PRIMARY_SOURCES.some((p) => upper.includes(p))) {
      return 'verified';
    }
  }
  return 'inferred';
}

/**
 * React hook variant. Memoizes on the field's identity-shaping properties so
 * downstream components that derive a tier per render don't re-thrash.
 */
export function useConfidenceTier(
  field: ConfidenceFieldMetadata,
): ConfidenceTier {
  return useMemo(
    () => resolveConfidenceTier(field),
    // The resolver only reads these six keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      field.value,
      field.source,
      field.recall,
      field.tier,
      field.conflict,
      field.onFile,
    ],
  );
}
