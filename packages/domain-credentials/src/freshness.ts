/**
 * Freshness and Time-Bound Validity Logic
 *
 * All "truth" is time-bound. Credentials have finite validity periods.
 * Freshness requirements enforce additional constraints beyond expiration.
 */

import {
  type Credential,
  type FreshnessRequirement,
  type TemporalBounds,
  TemporalBoundsViolationError,
  AmbiguousStateError,
} from './types';

/**
 * Validate temporal bounds
 *
 * INVARIANT: All credentials must have valid temporal bounds.
 *
 * @throws AmbiguousStateError if temporal bounds are invalid
 */
export function validateTemporalBounds(temporal: TemporalBounds): void {
  if (!temporal.issued_at) {
    throw new AmbiguousStateError('Temporal bounds missing issued_at');
  }

  if (!temporal.expires_at) {
    throw new AmbiguousStateError('Temporal bounds missing expires_at');
  }

  if (temporal.issued_at >= temporal.expires_at) {
    throw new AmbiguousStateError(
      `Invalid temporal bounds: issued_at (${temporal.issued_at.toISOString()}) >= expires_at (${temporal.expires_at.toISOString()})`
    );
  }

  if (temporal.not_before && temporal.not_before < temporal.issued_at) {
    throw new AmbiguousStateError(
      `Invalid temporal bounds: not_before (${temporal.not_before.toISOString()}) < issued_at (${temporal.issued_at.toISOString()})`
    );
  }

  if (temporal.not_before && temporal.not_before >= temporal.expires_at) {
    throw new AmbiguousStateError(
      `Invalid temporal bounds: not_before (${temporal.not_before.toISOString()}) >= expires_at (${temporal.expires_at.toISOString()})`
    );
  }
}

/**
 * Check if credential is expired
 *
 * PURE: Time-bound check
 */
export function isExpired(temporal: TemporalBounds, checkTime: Date = new Date()): boolean {
  validateTemporalBounds(temporal);
  return checkTime >= temporal.expires_at;
}

/**
 * Check if credential is not yet valid
 *
 * PURE: Time-bound check
 */
export function isNotYetValid(temporal: TemporalBounds, checkTime: Date = new Date()): boolean {
  validateTemporalBounds(temporal);

  // If no not_before, credential is valid from issuance
  if (!temporal.not_before) {
    return checkTime < temporal.issued_at;
  }

  return checkTime < temporal.not_before;
}

/**
 * Check if credential is within temporal bounds
 *
 * PURE: Combined temporal check
 */
export function isWithinTemporalBounds(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);
  return !isExpired(temporal, checkTime) && !isNotYetValid(temporal, checkTime);
}

/**
 * Get credential age in seconds
 *
 * PURE: Calculate age from issuance
 */
export function getAgeSeconds(temporal: TemporalBounds, checkTime: Date = new Date()): number {
  validateTemporalBounds(temporal);
  const ageMs = checkTime.getTime() - temporal.issued_at.getTime();
  return Math.floor(ageMs / 1000);
}

/**
 * Get time until expiration in seconds
 *
 * PURE: Calculate remaining validity
 *
 * @returns Seconds until expiration (negative if expired)
 */
export function getTimeUntilExpirationSeconds(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): number {
  validateTemporalBounds(temporal);
  const remainingMs = temporal.expires_at.getTime() - checkTime.getTime();
  return Math.floor(remainingMs / 1000);
}

/**
 * Check if credential is fresh enough
 *
 * INVARIANT: Credentials older than max_age are considered stale.
 */
export function isFresh(
  temporal: TemporalBounds,
  requirement: FreshnessRequirement,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);

  // Check age requirement
  const ageSeconds = getAgeSeconds(temporal, checkTime);
  if (ageSeconds > requirement.max_age_seconds) {
    return false;
  }

  // Check not_before if required
  if (!requirement.allow_not_before && temporal.not_before) {
    if (checkTime < temporal.not_before) {
      return false;
    }
  }

  return true;
}

/**
 * Check if credential is within grace period after expiration
 *
 * Some use cases allow a grace period after expiration for practical reasons.
 */
export function isWithinGracePeriod(
  temporal: TemporalBounds,
  gracePeriodSeconds: number,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);

  if (!isExpired(temporal, checkTime)) {
    return true; // Not expired = within grace period
  }

  const secondsSinceExpiration = Math.floor(
    (checkTime.getTime() - temporal.expires_at.getTime()) / 1000
  );

  return secondsSinceExpiration <= gracePeriodSeconds;
}

/**
 * Calculate staleness score
 *
 * Returns a score from 0 (fresh) to 1 (maximally stale).
 * Stale credentials are less trustworthy.
 */
export function calculateStalenessScore(
  temporal: TemporalBounds,
  maxAgeSeconds: number,
  checkTime: Date = new Date(),
): number {
  validateTemporalBounds(temporal);

  const ageSeconds = getAgeSeconds(temporal, checkTime);

  // Expired = maximally stale
  if (isExpired(temporal, checkTime)) {
    return 1.0;
  }

  // Not yet valid = maximally stale
  if (isNotYetValid(temporal, checkTime)) {
    return 1.0;
  }

  // Calculate staleness based on age
  const staleness = Math.min(ageSeconds / maxAgeSeconds, 1.0);
  return staleness;
}

/**
 * Get validity window
 *
 * Returns the start and end times when the credential is valid.
 */
export function getValidityWindow(temporal: TemporalBounds): { start: Date; end: Date } {
  validateTemporalBounds(temporal);

  return {
    start: temporal.not_before || temporal.issued_at,
    end: temporal.expires_at,
  };
}

/**
 * Check if two credentials overlap in validity
 *
 * Useful for detecting superseded credentials or conflicts.
 */
export function doValidityWindowsOverlap(
  temporal1: TemporalBounds,
  temporal2: TemporalBounds,
): boolean {
  validateTemporalBounds(temporal1);
  validateTemporalBounds(temporal2);

  const window1 = getValidityWindow(temporal1);
  const window2 = getValidityWindow(temporal2);

  // Check if windows overlap
  return window1.start < window2.end && window2.start < window1.end;
}
