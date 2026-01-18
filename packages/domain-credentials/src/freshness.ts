/**
 * Freshness and temporal window logic.
 *
 * Validity and freshness are derived from time only.
 */

import {
  type FreshnessRequirement,
  type TemporalBounds,
  AmbiguousStateError,
  TemporalBoundsViolationError,
} from './types';

function assertValidDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TemporalBoundsViolationError(`${label} must be a valid Date`);
  }
  return value;
}

function assertValidCheckTime(checkTime: Date): Date {
  if (!(checkTime instanceof Date) || Number.isNaN(checkTime.getTime())) {
    throw new AmbiguousStateError('checkTime must be a valid Date');
  }
  return checkTime;
}

export function validateTemporalBounds(temporal: TemporalBounds): void {
  const issuedAt = assertValidDate(temporal.issued_at, 'issued_at');
  const expiresAt = assertValidDate(temporal.expires_at, 'expires_at');

  if (issuedAt >= expiresAt) {
    throw new TemporalBoundsViolationError(
      `issued_at (${issuedAt.toISOString()}) must be before expires_at (${expiresAt.toISOString()})`,
    );
  }

  if (temporal.not_before) {
    const notBefore = assertValidDate(temporal.not_before, 'not_before');
    if (notBefore < issuedAt) {
      throw new TemporalBoundsViolationError(
        `not_before (${notBefore.toISOString()}) must be >= issued_at (${issuedAt.toISOString()})`,
      );
    }
    if (notBefore >= expiresAt) {
      throw new TemporalBoundsViolationError(
        `not_before (${notBefore.toISOString()}) must be < expires_at (${expiresAt.toISOString()})`,
      );
    }
  }
}

export function validateFreshnessRequirement(requirement: FreshnessRequirement): void {
  if (!Number.isFinite(requirement.max_age_seconds) || requirement.max_age_seconds < 0) {
    throw new AmbiguousStateError('max_age_seconds must be a non-negative number');
  }

  if (requirement.grace_period_seconds !== undefined) {
    if (
      !Number.isFinite(requirement.grace_period_seconds) ||
      requirement.grace_period_seconds < 0
    ) {
      throw new AmbiguousStateError('grace_period_seconds must be a non-negative number');
    }
  }
}

export function getValidityWindow(temporal: TemporalBounds): { start: Date; end: Date } {
  validateTemporalBounds(temporal);
  return {
    start: temporal.not_before ?? temporal.issued_at,
    end: temporal.expires_at,
  };
}

export function getFreshnessWindow(
  temporal: TemporalBounds,
  requirement: FreshnessRequirement,
): { start: Date; end: Date } {
  validateTemporalBounds(temporal);
  validateFreshnessRequirement(requirement);

  const start = temporal.not_before ?? temporal.issued_at;
  const maxAgeEnd = new Date(
    temporal.issued_at.getTime() + requirement.max_age_seconds * 1000,
  );
  const end = maxAgeEnd < temporal.expires_at ? maxAgeEnd : temporal.expires_at;

  if (start > end) {
    throw new AmbiguousStateError(
      `Freshness window is empty: start (${start.toISOString()}) > end (${end.toISOString()})`,
    );
  }

  return { start, end };
}

export function isExpired(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);
  const time = assertValidCheckTime(checkTime);
  return time >= temporal.expires_at;
}

export function isNotYetValid(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): boolean {
  const window = getValidityWindow(temporal);
  const time = assertValidCheckTime(checkTime);
  return time < window.start;
}

export function isWithinTemporalBounds(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): boolean {
  const window = getValidityWindow(temporal);
  const time = assertValidCheckTime(checkTime);
  return time >= window.start && time < window.end;
}

export function getAgeSeconds(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): number {
  validateTemporalBounds(temporal);
  const time = assertValidCheckTime(checkTime);
  return Math.floor((time.getTime() - temporal.issued_at.getTime()) / 1000);
}

export function getTimeUntilExpirationSeconds(
  temporal: TemporalBounds,
  checkTime: Date = new Date(),
): number {
  validateTemporalBounds(temporal);
  const time = assertValidCheckTime(checkTime);
  return Math.floor((temporal.expires_at.getTime() - time.getTime()) / 1000);
}

export function isFresh(
  temporal: TemporalBounds,
  requirement: FreshnessRequirement,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);
  validateFreshnessRequirement(requirement);
  const time = assertValidCheckTime(checkTime);
  const window = getFreshnessWindow(temporal, requirement);

  if (time < window.start) {
    return false;
  }

  if (time > window.end) {
    return false;
  }

  if (time >= temporal.expires_at) {
    return false;
  }

  return true;
}

export function isWithinGracePeriod(
  temporal: TemporalBounds,
  gracePeriodSeconds: number,
  checkTime: Date = new Date(),
): boolean {
  validateTemporalBounds(temporal);
  if (!Number.isFinite(gracePeriodSeconds) || gracePeriodSeconds < 0) {
    throw new AmbiguousStateError('grace_period_seconds must be a non-negative number');
  }

  const time = assertValidCheckTime(checkTime);
  const graceEnd = new Date(temporal.expires_at.getTime() + gracePeriodSeconds * 1000);
  return time <= graceEnd;
}
