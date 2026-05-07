/**
 * lib/readiness/licensureCap.ts
 *
 * Web-side defense-in-depth mirror of the W1.1 engine cap and the W1.1b
 * backend cap. The authoritative source is the backend (passportService);
 * this module exists for surfaces that consume passport data WITHOUT
 * going through the backend (cached payloads, demo fixtures, server-
 * less cold starts that hand a stale snapshot to the client).
 *
 * Truth contracts mirrored here:
 *   - When `standing.licensureStatus !== 'verified'`, the readiness score
 *     cannot exceed `READINESS_LICENSURE_UNVERIFIED_CEILING` (45).
 *   - The cap is a hard ceiling — `Math.min` only, never raises a lower
 *     score.
 *   - The displayed `level` is derived from the capped score, so a
 *     45 cap deterministically becomes L1 (Provisional).
 *   - Source-state distinction (`access_required` vs `unsupported` vs
 *     `missing` etc.) is preserved on the original object — the cap
 *     only modifies score/level, never the underlying coverage shape.
 *
 * Aligned numerically with `CRS_LICENSURE_UNVERIFIED_CEILING` in
 * packages/crs/CrsEngine.ts and `READINESS_LICENSURE_UNVERIFIED_CEILING`
 * in apps/api/backend/src/services/entity/passportService.ts. If any
 * one of these three constants changes, all three must change together.
 */
import type { PassportData } from '@/lib/trust/passport-contract';

export const READINESS_LICENSURE_UNVERIFIED_CEILING = 45;

export type LicensureUiState =
  | 'verified'
  | 'unverified'
  | 'unknown';

/**
 * Reduces the four-state `standing.licensureStatus` to the boolean cap
 * decision (verified ↔ uncapped). Other fields (`'pending'`, `'expired'`,
 * `'unknown'`) all leave the cap engaged.
 *
 * Returns the original string for use as a `data-licensure-state`
 * attribute when the surface wants a richer audit trail.
 */
export function readLicensureUiState(
  passport: Pick<PassportData, 'standing'>,
): { capEngaged: boolean; rawStatus: PassportData['standing']['licensureStatus']; uiState: LicensureUiState } {
  const rawStatus = passport.standing.licensureStatus;
  const verified = rawStatus === 'verified';
  return {
    capEngaged: !verified,
    rawStatus,
    uiState: verified ? 'verified' : rawStatus === 'unknown' ? 'unknown' : 'unverified',
  };
}

/**
 * Clamp a score by the licensure cap. Pure — never raises.
 */
export function clampReadinessScore(
  score: number,
  licensureStatus: PassportData['standing']['licensureStatus'],
): number {
  if (licensureStatus === 'verified') {
    return score;
  }
  return Math.min(score, READINESS_LICENSURE_UNVERIFIED_CEILING);
}

/**
 * Derive the readiness level from a (post-cap) score. Mirrors the
 * backend `derivePassportReadinessLevel` so a capped score deterministically
 * resolves to L1, never L2+.
 *
 * Note: backend returns level as a free-form string. This helper returns
 * only the levels actually emitted today (L0–L3) so callers can switch on
 * a finite set when rendering.
 */
export function deriveLevelFromScore(score: number, status: PassportData['readiness']['status']): 'L0' | 'L1' | 'L2' | 'L3' {
  if (status === 'BLOCKED') return 'L0';
  if (score >= 80 && status === 'DECISION_GRADE') return 'L3';
  if (score >= 60) return 'L2';
  if (score > 0) return 'L1';
  return 'L0';
}

/**
 * Apply the licensure cap to a PassportData copy. Does NOT mutate the
 * input. Returns a fresh object with `readiness.score`, `readiness.readiness_score`,
 * and `readiness.level` clamped when `standing.licensureStatus !== 'verified'`.
 *
 * Surfaces that already trust a backend-capped passport are free to
 * skip this — it's a no-op when the input is already capped. Surfaces
 * that handle demo/cached/legacy payloads should call this before render.
 */
export function applyLicensureCapToPassport(passport: PassportData): PassportData {
  const { capEngaged } = readLicensureUiState(passport);
  if (!capEngaged) {
    return passport;
  }
  const cappedScore = clampReadinessScore(passport.readiness.score, passport.standing.licensureStatus);
  if (cappedScore === passport.readiness.score) {
    return passport;
  }
  const cappedLevel = deriveLevelFromScore(cappedScore, passport.readiness.status);
  return {
    ...passport,
    readiness: {
      ...passport.readiness,
      score: cappedScore,
      readiness_score: cappedScore,
      level: cappedLevel,
    },
  };
}
