/**
 * replayTrustActivation.ts — W2-PR140A: Replay-Trust Activation Bridge
 *
 * Connects audit replay evidence (replayEngine capsule bundles) to the
 * ecosystem readiness activation gates. A readiness signal for any actor can
 * only claim REPLAY_ACTIVATION_ANCHORED when a real, non-breached replay
 * capsule backs it.
 *
 * Hard invariants:
 *
 *   1. No phantom activations — an activation record with no traceable
 *      capsule or with a breached bundle is UNANCHORED; calling code
 *      receives an ActivationError, not a silent pass.
 *   2. Ambiguity preserved — when two capsules reference the same actor but
 *      produce contradicting integrity signals, the activation is
 *      ACTIVATION_AMBIGUOUS; it does not collapse to either outcome.
 *   3. Activation lineage reconstructable — activationDigest folds the
 *      capsuleId, bundleId, actorId, and outcome so a regulator can verify
 *      no activation record was silently replaced.
 *   4. Fail-closed — any error in the capsule hash verification produces
 *      UNANCHORED, never a default ANCHORED outcome.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivationOutcome =
  | 'ANCHORED'
  | 'ACTIVATION_AMBIGUOUS'
  | 'UNANCHORED'
  | 'ACTIVATION_BREACH';

export interface ReplayActivationInput {
  schema: 'vitalcv.replay-activation-input.v1';
  actorId: string;
  institutionId: string;
  /** The capsule that the actor's readiness signal claims to anchor. */
  capsuleId: string;
  /** The bundle that contains the capsule. */
  bundleId: string;
  /** Hash of the capsule as stored in the audit bundle. */
  capsuleHashStored: string;
  /** Hash recomputed from the live capsule payload. */
  capsuleHashRecomputed: string;
  /** Set by the corruption containment layer. */
  bundleBreached: boolean;
  /** Optional second capsule providing a corroborating or contradicting signal. */
  corroboratingCapsuleId: string | null;
  corroboratingHash: string | null;
  corroboratingRecomputed: string | null;
}

export interface ReplayActivationRecord {
  schema: 'vitalcv.replay-activation-record.v1';
  actorId: string;
  institutionId: string;
  capsuleId: string;
  bundleId: string;
  outcome: ActivationOutcome;
  /** Null when UNANCHORED or ACTIVATION_BREACH. */
  integrityVerified: boolean | null;
  outcomeReason: string;
  activationDigest: string;
  evaluatedAt: string;
}

export const KNOWN_ACTIVATION_OUTCOMES: ActivationOutcome[] = [
  'ANCHORED',
  'ACTIVATION_AMBIGUOUS',
  'UNANCHORED',
  'ACTIVATION_BREACH',
];

export const REPLAY_ACTIVATION_SENTINELS = {
  EMPTY_CAPSULE_ID: '',
  BREACH_HASH_PREFIX: 'breach-',
} as const;

// ── Error ─────────────────────────────────────────────────────────────────────

export class ActivationError extends Error {
  readonly violation: string;
  constructor(violation: string, message: string) {
    super(message);
    this.name = 'ActivationError';
    this.violation = violation;
  }
}

export const KNOWN_ACTIVATION_VIOLATIONS = [
  'PHANTOM_ACTIVATION',
  'UNANCHORED_GATE_PASSED',
  'CONTRADICTING_CORROBORATION_MERGED',
] as const;

// ── Core transform ────────────────────────────────────────────────────────────

function buildActivationDigest(
  input: ReplayActivationInput,
  outcome: ActivationOutcome,
): string {
  return sha256ForPayload({
    actorId: input.actorId,
    capsuleId: input.capsuleId,
    bundleId: input.bundleId,
    outcome,
    capsuleHashStored: input.capsuleHashStored,
    capsuleHashRecomputed: input.capsuleHashRecomputed,
  });
}

export function evaluateReplayActivation(
  input: ReplayActivationInput,
  evaluatedAt: string,
): ReplayActivationRecord {
  // Fail-closed: empty capsule id is a phantom activation
  if (!input.capsuleId) {
    throw new ActivationError(
      'PHANTOM_ACTIVATION',
      `Actor ${input.actorId}: capsuleId is empty — cannot anchor activation without a real capsule`,
    );
  }

  // Breach always wins
  if (input.bundleBreached) {
    const outcome: ActivationOutcome = 'ACTIVATION_BREACH';
    return {
      schema: 'vitalcv.replay-activation-record.v1',
      actorId: input.actorId,
      institutionId: input.institutionId,
      capsuleId: input.capsuleId,
      bundleId: input.bundleId,
      outcome,
      integrityVerified: null,
      outcomeReason: 'Source bundle is containment-breached — activation cannot proceed',
      activationDigest: buildActivationDigest(input, outcome),
      evaluatedAt,
    };
  }

  const primaryMatch = input.capsuleHashStored === input.capsuleHashRecomputed;

  // Check corroboration if present
  if (
    input.corroboratingCapsuleId !== null &&
    input.corroboratingHash !== null &&
    input.corroboratingRecomputed !== null
  ) {
    const corroborationMatch =
      input.corroboratingHash === input.corroboratingRecomputed;

    if (primaryMatch !== corroborationMatch) {
      // Contradicting signals — ambiguity must be preserved
      const outcome: ActivationOutcome = 'ACTIVATION_AMBIGUOUS';
      return {
        schema: 'vitalcv.replay-activation-record.v1',
        actorId: input.actorId,
        institutionId: input.institutionId,
        capsuleId: input.capsuleId,
        bundleId: input.bundleId,
        outcome,
        integrityVerified: null,
        outcomeReason: `Primary capsule integrity=${primaryMatch} contradicts corroborating capsule integrity=${corroborationMatch} — ambiguity preserved`,
        activationDigest: buildActivationDigest(input, outcome),
        evaluatedAt,
      };
    }
  }

  if (!primaryMatch) {
    const outcome: ActivationOutcome = 'UNANCHORED';
    return {
      schema: 'vitalcv.replay-activation-record.v1',
      actorId: input.actorId,
      institutionId: input.institutionId,
      capsuleId: input.capsuleId,
      bundleId: input.bundleId,
      outcome,
      integrityVerified: false,
      outcomeReason: 'Capsule hash mismatch — tamper detected, activation is unanchored',
      activationDigest: buildActivationDigest(input, outcome),
      evaluatedAt,
    };
  }

  const outcome: ActivationOutcome = 'ANCHORED';
  return {
    schema: 'vitalcv.replay-activation-record.v1',
    actorId: input.actorId,
    institutionId: input.institutionId,
    capsuleId: input.capsuleId,
    bundleId: input.bundleId,
    outcome,
    integrityVerified: true,
    outcomeReason: 'Capsule hash verified — replay trust anchor confirmed',
    activationDigest: buildActivationDigest(input, outcome),
    evaluatedAt,
  };
}

// ── Assertion helper ──────────────────────────────────────────────────────────

export function assertActivationAnchored(record: ReplayActivationRecord): void {
  if (record.outcome !== 'ANCHORED') {
    throw new ActivationError(
      'UNANCHORED_GATE_PASSED',
      `Actor ${record.actorId} activation is ${record.outcome} — REPLAY_ACTIVATION_ANCHORED gate must not pass`,
    );
  }
}

// ── Batch evaluator ───────────────────────────────────────────────────────────

export function evaluateReplayActivationBatch(
  inputs: ReplayActivationInput[],
  evaluatedAt: string,
): ReplayActivationRecord[] {
  return inputs.map(input => evaluateReplayActivation(input, evaluatedAt));
}
