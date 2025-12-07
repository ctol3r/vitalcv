/**
 * B212B-ENROLL-008: PECOS v2 Status Mapping
 *
 * Maps PECOS statuses to numeric scores for enrollment completeness calculation.
 */

export type PecosStatusV2 =
  | 'ENROLLED'
  | 'PENDING'
  | 'DEACTIVATED'
  | 'REVOKED'
  | 'REVALIDATION_DUE'
  | 'UNKNOWN';

/**
 * Maps PECOS status to a numeric score (0-1)
 * Higher scores indicate better enrollment status
 */
export const PECOS_STATUS_SCORES: Record<PecosStatusV2, number> = {
  ENROLLED: 1.0,
  PENDING: 0.5,
  REVALIDATION_DUE: 0.6, // Needs attention but still active
  DEACTIVATED: 0.0,
  REVOKED: 0.0, // Same as deactivated
  UNKNOWN: 0.2,
};

/**
 * Get numeric score for a PECOS status
 */
export function getPecosStatusScore(status: PecosStatusV2 | string | null | undefined): number {
  if (!status) return PECOS_STATUS_SCORES.UNKNOWN;
  const normalized = status.toUpperCase() as PecosStatusV2;
  return PECOS_STATUS_SCORES[normalized] ?? PECOS_STATUS_SCORES.UNKNOWN;
}

/**
 * Check if PECOS status is considered active (not deactivated/revoked)
 */
export function isPecosStatusActive(status: PecosStatusV2 | string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase() as PecosStatusV2;
  return normalized === 'ENROLLED' || normalized === 'PENDING' || normalized === 'REVALIDATION_DUE';
}

/**
 * Check if PECOS status requires immediate attention
 */
export function isPecosStatusActionRequired(
  status: PecosStatusV2 | string | null | undefined
): boolean {
  if (!status) return true;
  const normalized = status.toUpperCase() as PecosStatusV2;
  return normalized === 'REVALIDATION_DUE' || normalized === 'DEACTIVATED' || normalized === 'REVOKED';
}

