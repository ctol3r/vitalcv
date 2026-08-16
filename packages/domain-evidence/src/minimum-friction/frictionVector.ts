/**
 * Minimum Friction — friction vector (MF-WAVE-01).
 *
 * The per-plan measurement vector defined in
 * docs/minimum-friction/MINIMUM_FRICTION_OPTIMIZATION_MODEL.md §2, and the
 * lexicographic ordering over it defined in §3.
 *
 * Discipline (inherited from the repo's truth posture):
 * - PURE. No fetch, no DB, no clock, no randomness.
 * - UNKNOWN STAYS `null`. "We did not measure this" is a distinct state from
 *   "this is zero" (the `notFound`/`checked` split; `estimatedDays` is always
 *   `null` in the pure mobility layer). Comparators SKIP an unmeasured
 *   dimension rather than defaulting it — a measured value is never compared
 *   against an unmeasured one, and `null` is never imputed to `0`.
 * - NO NUMERIC WEIGHTS. The ordering is purely lexicographic; weighted
 *   scalarization is a later step gated on observed product data.
 */

/** Per-plan friction measurement. Unknown stays `null` — never zero, never imputed. */
export interface FrictionVector {
  /** Discrete clinician-required steps. */
  readonly clinicianActions: number;
  /** Null until telemetry exists. */
  readonly clinicianMinutes: number | null;
  /** NEW sensitive attributes this plan collects. */
  readonly sensitiveAttributesCollected: number;
  readonly documentsRequested: number;
  /** Attributes revealed to a recipient. */
  readonly disclosedAttributes: number;
  readonly sourceQueries: number;
  /** Clinician OR reviewer review steps. */
  readonly humanReviews: number;
  readonly waitMinutes: number | null;
  readonly monetaryCost: number | null;
}

/**
 * The fixed lexicographic minimization order (OPTIMIZATION §3). No plan with a
 * higher-priority advantage is ever traded for a lower-priority one.
 *
 * Sensitive-collection outranks clinician-actions deliberately: a plan that
 * saves the clinician one click by collecting an SSN it does not need is the
 * wrong plan. Data minimization is a safety property; click-count is a
 * comfort property. Safety wins.
 */
export const FRICTION_OBJECTIVE_ORDER = [
  'sensitiveAttributesCollected',
  'clinicianActions',
  'clinicianMinutes',
  'documentsRequested',
  'disclosedAttributes',
  'sourceQueries',
  'humanReviews',
  'waitMinutes',
  'monetaryCost',
] as const satisfies readonly (keyof FrictionVector)[];

export type FrictionDimension = (typeof FRICTION_OBJECTIVE_ORDER)[number];

/** Dimensions that may legitimately be unmeasured (`null`). */
export const NULLABLE_FRICTION_DIMENSIONS = [
  'clinicianMinutes',
  'waitMinutes',
  'monetaryCost',
] as const satisfies readonly FrictionDimension[];

const NULLABLE_SET: ReadonlySet<FrictionDimension> = new Set(
  NULLABLE_FRICTION_DIMENSIONS,
);

/**
 * Compares two friction vectors lexicographically in the fixed
 * FRICTION_OBJECTIVE_ORDER. Negative = `a` is less friction (better).
 *
 * Null-aware: when EITHER side of a nullable dimension is `null`, that
 * dimension is skipped entirely — an unmeasured dimension can neither win nor
 * lose a comparison, so `null` never behaves as a value. Returns 0 only when
 * every comparable dimension ties.
 */
export function compareFrictionVectors(a: FrictionVector, b: FrictionVector): number {
  for (const dimension of FRICTION_OBJECTIVE_ORDER) {
    const av = a[dimension];
    const bv = b[dimension];
    if (NULLABLE_SET.has(dimension) && (av === null || bv === null)) {
      continue;
    }
    // Non-nullable dimensions are `number` by type; nullable ones reach here
    // only when both are measured.
    const delta = (av as number) - (bv as number);
    if (delta !== 0) return delta;
  }
  return 0;
}
