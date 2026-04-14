/**
 * drift.ts — pure drift signal derivation for Omega.
 *
 * Produces a monitoring badge from data the orchestrator already has in
 * hand. This module MUST NOT call any service, mutate any record, or
 * influence the decision/trust/acceptance/activation paths — it is a
 * pure function over an already-assembled snapshot.
 *
 * States:
 *   STABLE       — no triggers fired
 *   SOFT_DRIFT   — attention needed but not blocking
 *   HARD_DRIFT   — decision-grade signal degraded; review required
 */

import type { PassportDataContract } from '../services/passport/npiPassportContract';
import type { ReuseSignal } from '../services/actions/reuseSignal';

export type DriftState = 'STABLE' | 'SOFT_DRIFT' | 'HARD_DRIFT';

export interface DriftSignal {
  state: DriftState;
  reasons: string[];
  lastChecked: string;
}

export interface DriftInput {
  passport: PassportDataContract | null;
  reuseSignal: ReuseSignal | null;
}

export function computeDriftSignal(
  input: DriftInput,
  now: Date = new Date(),
): DriftSignal {
  const reasons: string[] = [];
  let state: DriftState = 'STABLE';

  const { passport, reuseSignal } = input;

  // HARD triggers — dominant.
  if (passport?.decision?.decision === 'DO_NOT_PROCEED') {
    reasons.push('Decision is DO_NOT_PROCEED');
    state = 'HARD_DRIFT';
  }
  if (passport?.readiness?.blockers && passport.readiness.blockers.length > 0) {
    reasons.push(`Readiness blockers present: ${passport.readiness.blockers.length}`);
    state = 'HARD_DRIFT';
  }
  if (passport?.standing?.exclusionStatus === 'EXCLUDED') {
    reasons.push('OIG/LEIE exclusion detected');
    state = 'HARD_DRIFT';
  }
  if (passport?.standing?.licensureStatus === 'expired') {
    reasons.push('Licensure expired');
    state = 'HARD_DRIFT';
  }

  // SOFT triggers — only upgrade if we're not already HARD.
  if (state !== 'HARD_DRIFT') {
    if (passport?.decision?.decision === 'INSUFFICIENT_DATA') {
      reasons.push('Decision is INSUFFICIENT_DATA');
      state = 'SOFT_DRIFT';
    }
    if (passport?.decision?.decision === 'PROCEED_WITH_CAUTION') {
      reasons.push('Decision is PROCEED_WITH_CAUTION');
      state = 'SOFT_DRIFT';
    }
    if (passport?.readiness?.gaps && passport.readiness.gaps.length > 0) {
      reasons.push(`Coverage gaps: ${passport.readiness.gaps.length}`);
      state = 'SOFT_DRIFT';
    }
    const staleCount = passport?.sourceCoverage?.checks?.filter(
      (check) => check.state === 'stale',
    ).length ?? 0;
    if (staleCount > 0) {
      reasons.push(`Stale source checks: ${staleCount}`);
      state = 'SOFT_DRIFT';
    }
    if (reuseSignal && reuseSignal.flagged_count > 0) {
      reasons.push(`Flagged by ${reuseSignal.flagged_count} prior employer(s)`);
      state = 'SOFT_DRIFT';
    }
  }

  return {
    state,
    reasons,
    lastChecked: now.toISOString(),
  };
}
