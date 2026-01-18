/**
 * Credential Validity - Revocation-First + Temporal + Freshness
 *
 * CRITICAL ORDER:
 * 1. Check revocation (terminal state)
 * 2. Check temporal bounds (expiration, not-yet-valid)
 * 3. Check freshness (staleness)
 * 4. Return status
 */

import {
  type Credential,
  CredentialStatus,
  type RevocationRecord,
  type StatusCheckResult,
  type FreshnessRequirement,
} from './types';
import { checkRevocationFirst } from './revocation';
import {
  isExpired,
  isNotYetValid,
  isWithinTemporalBounds,
  isFresh,
  isWithinGracePeriod,
} from './freshness';

/**
 * Check credential status at a specific time
 *
 * REVOCATION-FIRST: Always check revocation before temporal validity.
 *
 * PURE: No side effects, no network calls
 */
export function checkCredentialStatus(
  credential: Credential,
  revocationRecord: RevocationRecord | null,
  checkTime: Date = new Date(),
  freshness?: FreshnessRequirement,
): StatusCheckResult {
  // STEP 1: Check revocation FIRST (terminal state)
  const revocationResult = checkRevocationFirst(credential, revocationRecord, checkTime);
  if (revocationResult) {
    return revocationResult;
  }

  // STEP 2: Check temporal bounds
  const temporal = credential.temporal;

  // Check expiration
  if (isExpired(temporal, checkTime)) {
    // Check grace period if specified
    if (freshness?.grace_period_seconds) {
      if (isWithinGracePeriod(temporal, freshness.grace_period_seconds, checkTime)) {
        // Within grace period = still valid but with warning
        return {
          credential_id: credential.id,
          status: CredentialStatus.VALID,
          checked_at: checkTime,
          valid_until: new Date(
            temporal.expires_at.getTime() + freshness.grace_period_seconds * 1000
          ),
          reason: `Valid within grace period (expires ${temporal.expires_at.toISOString()})`,
        };
      }
    }

    return {
      credential_id: credential.id,
      status: CredentialStatus.EXPIRED,
      checked_at: checkTime,
      valid_until: undefined,
      reason: `Expired on ${temporal.expires_at.toISOString()}`,
    };
  }

  // Check not-yet-valid
  if (isNotYetValid(temporal, checkTime)) {
    const validFrom = temporal.not_before || temporal.issued_at;
    return {
      credential_id: credential.id,
      status: CredentialStatus.NOT_YET_VALID,
      checked_at: checkTime,
      valid_until: undefined,
      reason: `Not valid until ${validFrom.toISOString()}`,
    };
  }

  // STEP 3: Check freshness if required
  if (freshness && !isFresh(temporal, freshness, checkTime)) {
    return {
      credential_id: credential.id,
      status: CredentialStatus.EXPIRED, // Treat stale credentials as expired
      checked_at: checkTime,
      valid_until: undefined,
      reason: `Credential too old (max age: ${freshness.max_age_seconds}s)`,
    };
  }

  // STEP 4: Valid
  return {
    credential_id: credential.id,
    status: CredentialStatus.VALID,
    checked_at: checkTime,
    valid_until: temporal.expires_at,
    reason: `Valid until ${temporal.expires_at.toISOString()}`,
  };
}

/**
 * Check if credential is valid (boolean convenience)
 *
 * PURE: Wraps checkCredentialStatus for boolean result
 */
export function isCredentialValid(
  credential: Credential,
  revocationRecord: RevocationRecord | null,
  checkTime: Date = new Date(),
  freshness?: FreshnessRequirement,
): boolean {
  const result = checkCredentialStatus(credential, revocationRecord, checkTime, freshness);
  return result.status === CredentialStatus.VALID;
}

/**
 * Get credential validity period in seconds
 *
 * PURE: Calculate total validity period
 */
export function getValidityPeriodSeconds(credential: Credential): number {
  const temporal = credential.temporal;
  const periodMs =
    temporal.expires_at.getTime() - (temporal.not_before || temporal.issued_at).getTime();
  return Math.floor(periodMs / 1000);
}

/**
 * Get remaining validity in seconds
 *
 * PURE: Calculate remaining validity
 *
 * @returns Seconds until expiration (negative if expired)
 */
export function getRemainingValiditySeconds(
  credential: Credential,
  checkTime: Date = new Date(),
): number {
  const temporal = credential.temporal;
  const remainingMs = temporal.expires_at.getTime() - checkTime.getTime();
  return Math.floor(remainingMs / 1000);
}
