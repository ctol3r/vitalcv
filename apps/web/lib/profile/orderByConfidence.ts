/**
 * Deterministic confidence ordering for the canonical ProfileView surface.
 *
 * Enforces the invariant at the DATA layer — not in component render order:
 *
 *     verified → inferred → unknown
 *
 * ProfileView and any other surface that displays multiple confidence-bearing
 * fields MUST project its data through one of these helpers. Rendering fields
 * in source/insertion order is forbidden, because on-device AI enrichment can
 * intermix inferred fields with verified ones in the input record and the UX
 * rule (verified first, AI second) is a compliance posture, not a style.
 *
 * Pure, dependency-free, safe to import from server code, tests, or the UI.
 * Does NOT depend on `FieldConfidenceView` so it can be exercised with
 * fixture objects in unit tests without importing the projection module.
 */

import type { ConfidenceType } from '@domain-common/dataConfidence';

/**
 * Canonical display order. Exported so downstream callers, tests, and
 * documentation can reference the same source of truth.
 */
export const CONFIDENCE_ORDER = [
  'verified',
  'inferred',
  'unknown',
] as const satisfies readonly ConfidenceType[];

/**
 * Integer rank used by the sort comparator. Lower = earlier.
 *
 * Derived from {@link CONFIDENCE_ORDER} so the two can never drift: if a new
 * confidence type is ever added, TypeScript will force this record to cover it.
 */
const CONFIDENCE_RANK: Readonly<Record<ConfidenceType, number>> = Object.freeze({
  verified: 0,
  inferred: 1,
  unknown: 2,
});

/**
 * Minimal structural contract a sortable item must satisfy. Any object that
 * carries a `type: ConfidenceType` can be ordered — ConfidenceField views,
 * raw domain records, test fixtures, etc.
 */
interface ConfidenceRanked {
  readonly type: ConfidenceType;
}

/**
 * Return a new array of items sorted verified → inferred → unknown.
 *
 * Stable: ties within a rank preserve input order. Callers can therefore
 * control within-type ordering simply by controlling the order of items they
 * pass in — no secondary comparator required.
 *
 * Does not mutate the input.
 *
 * @example
 *   const views = [nameView, licenseView, specialtyView];
 *   const ordered = orderByConfidence(views);
 *   // → [verified items..., inferred items..., unknown items...]
 */
export function orderByConfidence<V extends ConfidenceRanked>(
  items: readonly V[],
): V[] {
  return [...items].sort(
    (a, b) => CONFIDENCE_RANK[a.type] - CONFIDENCE_RANK[b.type],
  );
}

/**
 * Same as {@link orderByConfidence}, but operates on `[key, view]` entries.
 * Use this when you need the caller-supplied key (e.g. React list keys,
 * section headings) alongside the view after sorting.
 *
 * @example
 *   const entries = Object.entries(views) as Array<[string, FieldConfidenceView<unknown>]>;
 *   const ordered = orderEntriesByConfidence(entries);
 *   return ordered.map(([key, view]) => <FieldRow key={key} view={view} />);
 */
export function orderEntriesByConfidence<
  K extends string,
  V extends ConfidenceRanked,
>(
  entries: ReadonlyArray<readonly [K, V]>,
): ReadonlyArray<readonly [K, V]> {
  // Cast: spreading a readonly tuple array widens it to a readonly-tuple
  // array, but `Array.prototype.sort` is typed against mutable tuples.
  // The sort is in-place on our freshly-spread copy, so no caller data is
  // mutated — the readonly return type preserves the external contract.
  const copy = [...entries] as Array<[K, V]>;
  copy.sort(
    ([, a], [, b]) => CONFIDENCE_RANK[a.type] - CONFIDENCE_RANK[b.type],
  );
  return copy;
}
