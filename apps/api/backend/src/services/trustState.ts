/**
 * Deterministic trust-state computation for verification artifacts.
 *
 * Trust states:
 *   verified             – PSV confirmed, within validity window
 *   verified_monitoring  – PSV confirmed, continuous monitoring active
 *   expiring_soon        – Valid but expiration within 30 days
 *   needs_review         – No recent verification or ambiguous status
 *   expired              – Past expiration date
 */

export type TrustState =
  | 'verified'
  | 'verified_monitoring'
  | 'expiring_soon'
  | 'needs_review'
  | 'expired';

const EXPIRING_SOON_THRESHOLD_DAYS = 30;

type ArtifactInput = {
  status: string;
  expiresAt: Date | null;
  monitoring: boolean;
};

/**
 * Compute trust state from artifact properties.
 * Pure function — no side effects, no database access.
 */
export function computeTrustState(artifact: ArtifactInput, now: Date = new Date()): TrustState {
  // Expired statuses always map to expired
  if (artifact.status === 'EXPIRED' || artifact.status === 'REVOKED' || artifact.status === 'SUSPENDED') {
    return 'expired';
  }

  // Check date-based expiration
  if (artifact.expiresAt) {
    if (artifact.expiresAt.getTime() <= now.getTime()) {
      return 'expired';
    }

    const msUntilExpiry = artifact.expiresAt.getTime() - now.getTime();
    const daysUntilExpiry = msUntilExpiry / (24 * 60 * 60 * 1000);

    if (daysUntilExpiry <= EXPIRING_SOON_THRESHOLD_DAYS) {
      return 'expiring_soon';
    }
  }

  // Active/verified status checks
  if (artifact.status === 'ACTIVE' || artifact.status === 'VERIFIED') {
    if (artifact.monitoring) {
      return 'verified_monitoring';
    }
    return 'verified';
  }

  // Inactive or unknown statuses
  return 'needs_review';
}
