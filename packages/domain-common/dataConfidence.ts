/**
 * DATA CONFIDENCE ENGINE
 *
 * Field-level provenance and confidence wrapping for every user-visible datum.
 *
 * Every field surfaced to users (providers, employers, verifiers) MUST be wrapped
 * in a ConfidenceField so the UI can render:
 *
 *   - Verified  (authoritative source: NPPES, State Board)
 *   - Inferred  (derived/heuristic)
 *   - Unknown   (no source / low confidence)
 *
 * This module is a pure, dependency-free contract. It does NO network I/O and
 * is safe to import from both backend services and the web UI.
 *
 * Contrast with existing surfaces:
 *   - `packages/trust-state` is clinician-scoped aggregate trust (behavior frozen)
 *   - `packages/domain-common/psvContracts` is evidence-level PSV policy
 *   - This module is field-level data provenance that rides alongside each value
 */

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/**
 * Canonical data source identifiers recognized by the confidence engine.
 *
 * Adding a source: add the literal here, add a weight in {@link SOURCE_WEIGHTS},
 * and add a human label in {@link SOURCE_LABELS}. TypeScript's exhaustiveness
 * checks will then force every downstream switch to handle it.
 */
export const CONFIDENCE_SOURCE_VALUES = [
  'NPPES',
  'STATE_BOARD',
  'USER_UPLOAD',
  'INFERENCE',
  'UNKNOWN',
] as const;

export type ConfidenceSource = (typeof CONFIDENCE_SOURCE_VALUES)[number];

/**
 * Base source weights on a 0–100 scale. A field's score is seeded from its
 * source's weight and may be adjusted downward by decay/conflict policies
 * (not implemented here — callers apply their own adjustments).
 *
 * Weights are authoritative-first:
 *   - NPPES, State Board  → 100 (primary government sources)
 *   - User upload         →  80 (self-attested, rebuttable)
 *   - Inference           →  60 (derived / heuristic)
 *   - Unknown             →   0 (explicit absence)
 */
export const SOURCE_WEIGHTS: Readonly<Record<ConfidenceSource, number>> = Object.freeze({
  NPPES: 100,
  STATE_BOARD: 100,
  USER_UPLOAD: 80,
  INFERENCE: 60,
  UNKNOWN: 0,
});

/**
 * Human-readable labels for sources. Use in UI badges, tooltips, export logs.
 */
export const SOURCE_LABELS: Readonly<Record<ConfidenceSource, string>> = Object.freeze({
  NPPES: 'NPPES',
  STATE_BOARD: 'State Board',
  USER_UPLOAD: 'User Upload',
  INFERENCE: 'Inference',
  UNKNOWN: 'Unknown',
});

// ---------------------------------------------------------------------------
// Confidence kinds
// ---------------------------------------------------------------------------

/**
 * Three discrete confidence classifications, derived from score + source.
 *
 * - `verified` — score ≥ {@link VERIFIED_THRESHOLD} from an authoritative source
 * - `inferred` — derived/heuristic or self-attested
 * - `unknown`  — no source or score below the inferred floor
 */
export const CONFIDENCE_TYPE_VALUES = ['verified', 'inferred', 'unknown'] as const;
export type ConfidenceType = (typeof CONFIDENCE_TYPE_VALUES)[number];

export const VERIFIED_THRESHOLD = 90;
export const INFERRED_THRESHOLD = 50;

/** Sources considered authoritative for `verified` classification. */
export const AUTHORITATIVE_SOURCES: readonly ConfidenceSource[] = Object.freeze([
  'NPPES',
  'STATE_BOARD',
]);

// ---------------------------------------------------------------------------
// Core shapes
// ---------------------------------------------------------------------------

/**
 * Provenance + confidence metadata attached to a single field.
 *
 * Invariants (enforced by {@link assertConfidenceValid}):
 *   - `score` ∈ [0, 100]
 *   - `type` is consistent with `score` and `source`
 */
export interface Confidence {
  readonly source: ConfidenceSource;
  readonly type: ConfidenceType;
  readonly score: number;
  /** Optional ISO8601 timestamp for when the source was last consulted. */
  readonly observedAt?: string;
  /** Optional free-form reason (e.g. "derived from primary specialty"). */
  readonly reason?: string;
}

/**
 * Field-level wrapper that pairs a value with its confidence metadata.
 *
 * Any user-visible field SHOULD be modeled as `ConfidenceField<T>` so the UI
 * can never accidentally render a bare value without provenance.
 *
 * @example
 *   const name: ConfidenceField<string> = confidenceField(
 *     'Jane Doe',
 *     fromSource('NPPES'),
 *   );
 */
export interface ConfidenceField<T> {
  readonly value: T;
  readonly confidence: Confidence;
  /** Convenience mirror of `confidence.source` for quick access in UIs. */
  readonly source: ConfidenceSource;
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/**
 * Classify a numeric score into a {@link ConfidenceType}.
 *
 * An authoritative source + score ≥ VERIFIED_THRESHOLD → `verified`.
 * Any score ≥ INFERRED_THRESHOLD → `inferred`.
 * Everything else → `unknown`.
 */
export function classifyConfidence(
  source: ConfidenceSource,
  score: number,
): ConfidenceType {
  if (source === 'UNKNOWN') return 'unknown';
  if (score < INFERRED_THRESHOLD) return 'unknown';
  if (score >= VERIFIED_THRESHOLD && AUTHORITATIVE_SOURCES.includes(source)) {
    return 'verified';
  }
  return 'inferred';
}

/**
 * Build a {@link Confidence} object from a source, using the source's base
 * weight as the seed score. Pass `overrides` to adjust score / type / metadata.
 *
 * @example
 *   fromSource('NPPES')                         // score=100, type='verified'
 *   fromSource('INFERENCE', { score: 45 })      // score=45,  type='unknown'
 *   fromSource('USER_UPLOAD', { reason: '…' })  // score=80,  type='inferred'
 */
export function fromSource(
  source: ConfidenceSource,
  overrides: {
    score?: number;
    observedAt?: string;
    reason?: string;
  } = {},
): Confidence {
  const score = clampScore(overrides.score ?? SOURCE_WEIGHTS[source]);
  return Object.freeze({
    source,
    score,
    type: classifyConfidence(source, score),
    observedAt: overrides.observedAt,
    reason: overrides.reason,
  });
}

/**
 * Sentinel confidence for fields with no known source.
 * Use this (not `undefined`) so the UI layer can enforce "no field without confidence".
 */
export const UNKNOWN_CONFIDENCE: Confidence = Object.freeze({
  source: 'UNKNOWN',
  type: 'unknown',
  score: 0,
});

/**
 * Wrap a value in a {@link ConfidenceField}. This is the ONLY sanctioned way
 * to produce a field for rendering — it guarantees the field carries provenance.
 */
export function confidenceField<T>(
  value: T,
  confidence: Confidence,
): ConfidenceField<T> {
  return Object.freeze({
    value,
    confidence,
    source: confidence.source,
  });
}

/**
 * Convenience: wrap a value whose source is unknown (e.g. legacy ingest path).
 * Prefer attaching a real source whenever one is available.
 */
export function unknownField<T>(value: T): ConfidenceField<T> {
  return confidenceField(value, UNKNOWN_CONFIDENCE);
}

// ---------------------------------------------------------------------------
// Guards / validation
// ---------------------------------------------------------------------------

export class ConfidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfidenceError';
  }
}

/** Clamp a raw score into the legal [0, 100] range. */
export function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return raw;
}

/** True if the value is a well-formed {@link Confidence} object. */
export function isConfidence(value: unknown): value is Confidence {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Partial<Confidence>;
  return (
    typeof c.source === 'string' &&
    (CONFIDENCE_SOURCE_VALUES as readonly string[]).includes(c.source) &&
    typeof c.type === 'string' &&
    (CONFIDENCE_TYPE_VALUES as readonly string[]).includes(c.type) &&
    typeof c.score === 'number' &&
    c.score >= 0 &&
    c.score <= 100
  );
}

/** True if the value is a well-formed {@link ConfidenceField}. */
export function isConfidenceField<T = unknown>(
  value: unknown,
): value is ConfidenceField<T> {
  if (value === null || typeof value !== 'object') return false;
  const f = value as Partial<ConfidenceField<T>>;
  return 'value' in f && isConfidence(f.confidence);
}

/**
 * Throw if the confidence object violates invariants. Use at system boundaries
 * (deserialization, API ingress) where TypeScript's compile-time guarantees
 * don't apply.
 */
export function assertConfidenceValid(c: Confidence): void {
  if (!isConfidence(c)) {
    throw new ConfidenceError(`Invalid Confidence shape: ${JSON.stringify(c)}`);
  }
  const expectedType = classifyConfidence(c.source, c.score);
  if (c.type !== expectedType) {
    throw new ConfidenceError(
      `Confidence type mismatch: source=${c.source} score=${c.score} ` +
        `declared=${c.type} expected=${expectedType}`,
    );
  }
}

/**
 * Throw if any field in `fields` is missing confidence metadata. This is the
 * "no field shows without confidence" gate — call it in response serializers
 * and renderer preludes.
 */
export function assertAllFieldsHaveConfidence(
  fields: Readonly<Record<string, unknown>>,
): void {
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (!isConfidenceField(value)) {
      throw new ConfidenceError(
        `Field "${key}" is not a ConfidenceField — every user-visible field ` +
          `must carry provenance metadata.`,
      );
    }
  }
}
