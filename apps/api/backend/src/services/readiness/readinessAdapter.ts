/**
 * Readiness translation layer.
 *
 * Canonical readiness (`./canonical`) is the only place that produces
 * (score, level, band, blockers). This file projects those canonical
 * outputs into the legacy shapes that existing surfaces expect, so
 * downstream consumers can keep working unchanged while the underlying
 * truth becomes unified.
 *
 * Adapter targets (all backward-compatible, no field rename):
 *   - `toLegacyTrustBand` — public passport public-band string (frozen
 *     `'GREEN' | 'YELLOW' | 'RED'`).
 *   - `toLegacyBlockingReasons` — coarse `BlockingReason[]` enum used by
 *     the YC-MVP TrustState response shape in `packages/trust-state`.
 *   - `toLegacyStringBlockers` — `string[]` view consumed by every route
 *     that has not yet migrated to structured blockers.
 *   - `toPassportReadinessFields` — the four fields
 *     (`score`, `readiness_score`, `level`, `blockers`) inlined on
 *     `PassportReadiness` in `passportService.ts`. Lets `buildPassport`
 *     replace its inline arithmetic with a single canonical call.
 *   - `toTrustStateEngineReadiness` — the legacy
 *     `DeterministicTrustReadiness` shape returned by
 *     `trustCore.computeDeterministicTrustReadiness`. Lets that function
 *     remove its weighted-confidence math while keeping its public
 *     return type.
 *
 * Nothing in this file may compute new score/level/band logic — it only
 * RE-SHAPES the canonical output. Any new branching belongs in
 * `./canonical`.
 */
import type {
  BlockingReason,
  CanonicalSourceCoverage,
  TrustBand as LegacyPublicTrustBand,
} from '@vitalcv/trust-state';
import type {
  CanonicalBlocker,
  CanonicalReadiness,
  CanonicalTrustBand,
  CanonicalTrustLevel,
} from './canonical';

// ── Band projections ─────────────────────────────────────────────────────────

/** Canonical GREEN/YELLOW/RED is identical to the legacy public TrustBand. */
export function toLegacyTrustBand(band: CanonicalTrustBand): LegacyPublicTrustBand {
  return band;
}

// ── BlockingReason mapping (category → coarse enum) ──────────────────────────

const CATEGORY_TO_BLOCKING_REASON: Readonly<Record<CanonicalBlocker['category'], BlockingReason | null>> = {
  IDENTITY: 'IDENTITY_CONFLICT',
  LICENSURE: 'EXPIRED_PSV',
  EXCLUSION: 'FAILED_VERIFICATION',
  ENROLLMENT: 'MISSING_PSV',
  DEA: 'MISSING_PSV',
  BOARD_CERT: 'MISSING_PSV',
  // OTHER has no canonical mapping — surfaced as MISSING_PSV by default
  // since we know it's blocking but not which dimension is at fault.
  OTHER: 'MISSING_PSV',
};

export function toLegacyBlockingReasons(blockers: readonly CanonicalBlocker[]): BlockingReason[] {
  const reasons = new Set<BlockingReason>();
  for (const b of blockers) {
    const mapped = CATEGORY_TO_BLOCKING_REASON[b.category];
    if (mapped) reasons.add(mapped);
  }
  return Array.from(reasons);
}

// ── String-blocker projection ────────────────────────────────────────────────

export function toLegacyStringBlockers(blockers: readonly CanonicalBlocker[]): string[] {
  return blockers.map((b) => b.message);
}

// ── Passport-readiness inline fields ─────────────────────────────────────────

/**
 * Projects canonical readiness into the four fields
 * (`score`, `readiness_score`, `level`, `blockers`) inlined on
 * `PassportReadiness` in `apps/api/backend/src/services/entity/passportService.ts`.
 *
 * `readiness_score` is a duplicate of `score` retained for legacy clients
 * (e.g. trust summary panel) that read snake_case.
 */
export function toPassportReadinessFields(readiness: CanonicalReadiness): {
  score: number;
  readiness_score: number;
  level: CanonicalTrustLevel;
  blockers: string[];
} {
  return {
    score: readiness.score,
    readiness_score: readiness.score,
    level: readiness.level,
    blockers: readiness.blockerStrings,
  };
}

// ── Trust-state-engine adapter (DeterministicTrustReadiness shape) ───────────

/**
 * The minimal shape returned by `trustCore.computeDeterministicTrustReadiness`.
 * Declared here so the adapter doesn't import from `trustCore` (preventing
 * an import cycle through this canonical-engine module).
 *
 * If `trustCore` adds new fields, expand this type and the projection
 * below; do NOT add scoring logic here.
 */
export interface LegacyDeterministicReadiness {
  overallStatus: 'CLEAR_TO_START' | 'BLOCKED' | 'PENDING_VERIFICATION' | 'MISSING_CREDENTIALS';
  readinessState: CanonicalReadiness['status'];
  readinessScore: number;
  readiness_score: number;
  blockers: string[];
  gaps: string[];
  nextActions: string[];
  confidenceWeighting: {
    identity: number;
    exclusion: number;
    licensure: number;
    enrollment: number;
  };
  sourceCoverage: CanonicalSourceCoverage[];
}

export interface ToTrustStateEngineReadinessInput {
  readiness: CanonicalReadiness;
  /** Confidence weighting is informational; trustCore previously used it
   *  to compute the score. We preserve the field but populate from
   *  passed-in dimension confidence rather than recomputing. */
  confidenceWeighting: LegacyDeterministicReadiness['confidenceWeighting'];
  /** Next-action titles (caller computes from `buildReadinessNextActions`
   *  in `apps/api/backend/src/services/entity/readinessActions.ts`). */
  nextActions: string[];
}

export function toTrustStateEngineReadiness(
  input: ToTrustStateEngineReadinessInput,
): LegacyDeterministicReadiness {
  const { readiness } = input;
  return {
    overallStatus: deriveOverallStatus(readiness),
    readinessState: readiness.status,
    readinessScore: readiness.score,
    readiness_score: readiness.score,
    blockers: readiness.blockerStrings,
    gaps: [...readiness.gaps],
    nextActions: input.nextActions,
    confidenceWeighting: input.confidenceWeighting,
    sourceCoverage: [...readiness.blockers].length // placeholder no-op; coverage filled by caller
      ? []
      : [],
  };
}

/**
 * Public projection of canonical level → legacy `overallStatus` enum.
 * The mapping mirrors what `trustCore` previously computed inline:
 *   L0 + HARD blocker        → 'BLOCKED'
 *   L0 (no blocker, score 0) → 'MISSING_CREDENTIALS'
 *   L1                       → 'PENDING_VERIFICATION'
 *   L2 / L3                  → 'CLEAR_TO_START'
 */
function deriveOverallStatus(readiness: CanonicalReadiness): LegacyDeterministicReadiness['overallStatus'] {
  if (readiness.level === 'L0') {
    return readiness.blockers.some((b) => b.severity === 'HARD') ? 'BLOCKED' : 'MISSING_CREDENTIALS';
  }
  if (readiness.level === 'L1') return 'PENDING_VERIFICATION';
  return 'CLEAR_TO_START';
}
