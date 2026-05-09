/**
 * Trust-class taxonomy primitives.
 *
 * Doctrine: docs/ops/trust-class-taxonomy.md
 *           docs/ops/runtime-trust-class-map.md
 *
 * 5 trust classes:
 *   C-1 Transactional canonical    — prisma.$transaction wrapping mutation+audit
 *   C-2 Cosmetic transactional     — single-row tx wrap; audit IS persistence
 *   T0  Fire-and-forget eventual   — void-discard dual-write
 *   R0  Replay-instrumentation     — replay event emission
 *   D0  Denial-instrumentation     — denied-path emission
 *
 * Class assignment is REQUIRED for every audit-emitting code path.
 * Operators MUST NOT mistake T0 for C-1 (per docs/ops/trust-class-taxonomy.md §9
 * class-substitution rules).
 */

export const TRUST_CLASSES = ["C-1", "C-2", "T0", "R0", "D0"] as const;

export type TrustClass = (typeof TRUST_CLASSES)[number];

/**
 * Per-class operational profile (per docs/ops/operational-guarantee-matrix.md §1).
 * Every class profiled across 7 dimensions.
 */
export interface TrustClassProfile {
  readonly trustClass: TrustClass;
  readonly lineageDurability: GuaranteeStrength;
  readonly replaySurvivability: GuaranteeStrength;
  readonly attributionDurability: GuaranteeStrength;
  readonly exportDurability: GuaranteeStrength;
  readonly denialSurvivability: GuaranteeStrength;
  readonly asyncSurvivability: GuaranteeStrength | "n/a";
  readonly forensicSurvivability: GuaranteeStrength;
}

export const GUARANTEE_STRENGTHS = ["STRONG", "PARTIAL", "WEAK", "FRAGILE"] as const;
export type GuaranteeStrength = (typeof GUARANTEE_STRENGTHS)[number];

/**
 * Frozen profiles per docs/ops/operational-guarantee-matrix.md §1.
 * Single source of truth; downstream consumers MUST query via getTrustClassProfile.
 */
const PROFILES: Readonly<Record<TrustClass, TrustClassProfile>> = Object.freeze({
  "C-1": Object.freeze({
    trustClass: "C-1",
    lineageDurability: "STRONG",
    replaySurvivability: "PARTIAL", // best-effort; DB UNIQUE deferred to MIG-A
    attributionDurability: "STRONG",
    exportDurability: "PARTIAL", // EX-3 STRONG; EX-1/EX-2 FRAGMENTED via DL-8
    denialSurvivability: "STRONG",
    asyncSurvivability: "PARTIAL", // side effects fire-and-forget post-tx
    forensicSurvivability: "PARTIAL", // depends on retention SLA (gate G7)
  }),
  "C-2": Object.freeze({
    trustClass: "C-2",
    lineageDurability: "PARTIAL", // audit IS persistence; cosmetic tx wrap
    replaySurvivability: "WEAK", // share-packet retry mints fresh token
    attributionDurability: "STRONG",
    exportDurability: "PARTIAL",
    denialSurvivability: "PARTIAL",
    asyncSurvivability: "n/a", // no async side effects
    forensicSurvivability: "WEAK", // retention DIRECTLY affects token TTL
  }),
  "T0": Object.freeze({
    trustClass: "T0",
    lineageDurability: "WEAK", // partial-write states by design
    replaySurvivability: "FRAGILE", // T0 dual-write race
    attributionDurability: "WEAK", // in-memory volatile
    exportDurability: "PARTIAL",
    denialSurvivability: "WEAK", // T0 not designed for denial-path
    asyncSurvivability: "n/a", // T0 IS the async path
    forensicSurvivability: "WEAK",
  }),
  "R0": Object.freeze({
    trustClass: "R0",
    lineageDurability: "STRONG",
    replaySurvivability: "STRONG", // by definition
    attributionDurability: "STRONG",
    exportDurability: "PARTIAL",
    denialSurvivability: "STRONG",
    asyncSurvivability: "n/a",
    forensicSurvivability: "PARTIAL",
  }),
  "D0": Object.freeze({
    trustClass: "D0",
    lineageDurability: "STRONG",
    replaySurvivability: "STRONG",
    attributionDurability: "STRONG",
    exportDurability: "PARTIAL", // EX-3 STRONG; SIEM gap
    denialSurvivability: "STRONG", // by definition
    asyncSurvivability: "n/a",
    forensicSurvivability: "PARTIAL",
  }),
});

/**
 * Query the operational profile for a given trust class.
 * Type-safe; no fallback. Unknown class fails compile-time via TrustClass union.
 */
export function getTrustClassProfile(cls: TrustClass): TrustClassProfile {
  // eslint-disable-next-line security/detect-object-injection -- cls is TrustClass union, exhaustive
  return PROFILES[cls];
}

/**
 * Validate that a runtime string corresponds to a known trust class.
 * Returns null if not — caller MUST handle (no silent default).
 */
export function parseTrustClass(value: unknown): TrustClass | null {
  if (typeof value !== "string") return null;
  for (const cls of TRUST_CLASSES) {
    if (cls === value) return cls;
  }
  return null;
}

/**
 * Lexicon-aligned wording per class.
 * Per docs/ops/operational-alias-layer.md + TRUST_GUARANTEE_LEXICON.md §2.
 */
export function trustClassDescription(cls: TrustClass): string {
  switch (cls) {
    case "C-1":
      return "Transactional canonical: prisma.$transaction wrapping mutation+audit (atomic)";
    case "C-2":
      return "Cosmetic transactional: single-row tx wrap; audit IS persistence (not additional rollback)";
    case "T0":
      return "Fire-and-forget eventual: void-discard dual-write (in-memory + best-effort Postgres)";
    case "R0":
      return "Replay-instrumentation: replay event emission (observability, not prevention)";
    case "D0":
      return "Denial-instrumentation: denied-path audit emission (post-Lock-v2 Step-2+ only; Step-1 silent BY DESIGN)";
  }
}
