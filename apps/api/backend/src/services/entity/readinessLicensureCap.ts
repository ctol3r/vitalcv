/**
 * readinessLicensureCap.ts
 *
 * Hard ceiling on `readinessScore` when licensure has not been verified.
 * Mirrors the engine-level invariant from
 * `packages/crs/CrsEngine.ts` (`CRS_LICENSURE_UNVERIFIED_CEILING = 45`)
 * and the web-side defense-in-depth helper at
 * `apps/web/lib/readiness/licensureCap.ts`.
 *
 * Numerically aligned with the existing missing-acceptance band so cap
 * composition stays deterministic without inventing a new tier.
 *
 * Truth contracts:
 *   - When `licensureStatus === 'verified'`, the score is returned unchanged.
 *   - When `licensureStatus` is anything else (`'pending'`, `'expired'`,
 *     `'unknown'`), the score is clamped at READINESS_LICENSURE_UNVERIFIED_CEILING.
 *   - The cap is a hard ceiling: Math.min only — it never raises a lower score.
 *
 * Lives in its own module so test files can import the helper without
 * pulling in the rest of passportService.ts (which has unrelated
 * pre-existing TS errors that block the test runner — see
 * apps/api/backend/src/services/entity/passportService.ts:2168, :2209).
 */

export type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';

export const READINESS_LICENSURE_UNVERIFIED_CEILING = 45;

export function applyReadinessLicensureCap(
  score: number,
  licensureStatus: LicensureStatus,
): number {
  if (licensureStatus === 'verified') {
    return score;
  }
  return Math.min(score, READINESS_LICENSURE_UNVERIFIED_CEILING);
}
