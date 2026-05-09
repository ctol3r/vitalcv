/**
 * renewalSemantics.ts — W2-PR44A
 *
 * Ambiguity-preserving renewal semantics.
 *
 * The core invariant: a renewal is interpretable as EITHER (a) a continuation
 * of the prior artifact OR (b) a fresh issue that happens to share identity.
 * Both readings can be plausible at once. Collapsing the ambiguity at this
 * layer hides risk from downstream verification — so we DO NOT do that.
 *
 * What we do: emit a RenewalInterpretation that scores both readings
 * independently using only properties that are safe to inspect (issuer,
 * artifact type, gap days). Confidence is bounded to [0, 1] but the two
 * branches are NOT required to sum to 1 — both can be high (genuinely
 * ambiguous), or both low (we don't know).
 */

import type { LifecycleEvent, LifecycleNode, RenewalInterpretation } from './types';

const MS_PER_DAY = 86_400_000;

export interface RenewalContext {
  predecessor: LifecycleNode;
  successor: LifecycleNode;
  renewalEvent: LifecycleEvent;
}

export function interpretRenewal(ctx: RenewalContext): RenewalInterpretation {
  const { predecessor, successor, renewalEvent } = ctx;

  const sameType = predecessor.artifactType === successor.artifactType;
  const sameOrg =
    predecessor.organizationId === successor.organizationId &&
    predecessor.organizationId !== null;

  const predExpiresAt = predecessor.expiresAt ? new Date(predecessor.expiresAt).getTime() : null;
  const succIssuedAt = successor.issuedAt ? new Date(successor.issuedAt).getTime() : null;

  let gapDays: number | null = null;
  if (predExpiresAt !== null && succIssuedAt !== null) {
    gapDays = Math.round((succIssuedAt - predExpiresAt) / MS_PER_DAY);
  }

  // ── Continuation reading ────────────────────────────────────────────────
  // Plausible when type matches, issuer/org matches, and the gap is short
  // (or negative — successor issued before predecessor expired).
  let contConfidence = 0;
  const contReasons: string[] = [];
  if (sameType) {
    contConfidence += 0.4;
    contReasons.push('artifact_type_unchanged');
  }
  if (sameOrg) {
    contConfidence += 0.3;
    contReasons.push('issuer_unchanged');
  }
  if (gapDays !== null) {
    if (gapDays <= 0) {
      contConfidence += 0.3;
      contReasons.push('successor_issued_before_predecessor_expired');
    } else if (gapDays <= 30) {
      contConfidence += 0.2;
      contReasons.push('renewal_gap_within_30_days');
    } else if (gapDays <= 90) {
      contConfidence += 0.1;
      contReasons.push('renewal_gap_within_90_days');
    }
  }
  contConfidence = Math.min(1, contConfidence);

  // ── Fresh-issue reading ────────────────────────────────────────────────
  // Plausible when there's evidence of independent re-evaluation: long gap,
  // type or issuer change, or explicit fresh-issue cause.
  let freshConfidence = 0;
  const freshReasons: string[] = [];
  if (!sameType) {
    freshConfidence += 0.45;
    freshReasons.push('artifact_type_changed');
  }
  if (!sameOrg && predecessor.organizationId !== null) {
    freshConfidence += 0.35;
    freshReasons.push('issuer_changed');
  }
  if (gapDays !== null && gapDays > 90) {
    freshConfidence += 0.3;
    freshReasons.push('renewal_gap_exceeds_90_days');
  }
  if (gapDays !== null && gapDays > 365) {
    freshConfidence += 0.2;
    freshReasons.push('renewal_gap_exceeds_365_days');
  }
  if ((renewalEvent.cause ?? '').toLowerCase().includes('fresh')) {
    freshConfidence += 0.2;
    freshReasons.push('cause_indicates_fresh_issue');
  }
  freshConfidence = Math.min(1, freshConfidence);

  // ── Floor: ambiguity must be preserved per-branch. Either branch hitting
  //          exactly zero would tell downstream code "this reading is
  //          impossible," which we are not in a position to assert. Lift
  //          any zero to a low residual.
  const RESIDUAL = 0.15;
  if (contConfidence === 0) {
    contConfidence = RESIDUAL;
    contReasons.push('residual_continuation_floor');
  }
  if (freshConfidence === 0) {
    freshConfidence = RESIDUAL;
    freshReasons.push('residual_fresh_issue_floor');
  }

  return {
    renewalEventId: renewalEvent.eventId,
    asContinuation: {
      plausible: contConfidence >= 0.3,
      confidence: round2(contConfidence),
      rationale: contReasons.join(','),
    },
    asFreshIssue: {
      plausible: freshConfidence >= 0.3,
      confidence: round2(freshConfidence),
      rationale: freshReasons.join(','),
    },
    ambiguityPreserved: true,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Detect renewal interpretations that have been incorrectly collapsed.
 * If a downstream consumer flattened ambiguity (e.g. by setting only one
 * branch as plausible when both should be), we surface it here.
 */
export function detectFlattenedAmbiguity(
  interpretations: ReadonlyArray<RenewalInterpretation>,
): string[] {
  const flattened: string[] = [];
  for (const interp of interpretations) {
    if (interp.ambiguityPreserved !== true) {
      flattened.push(interp.renewalEventId);
      continue;
    }
    // If both readings have meaningful confidence (>=0.5) but only one is
    // marked plausible, that's a flattening bug.
    const contStrong = interp.asContinuation.confidence >= 0.5;
    const freshStrong = interp.asFreshIssue.confidence >= 0.5;
    if (contStrong && freshStrong) {
      if (!interp.asContinuation.plausible || !interp.asFreshIssue.plausible) {
        flattened.push(interp.renewalEventId);
      }
    }
  }
  return flattened;
}
