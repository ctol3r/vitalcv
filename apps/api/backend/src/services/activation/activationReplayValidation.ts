/**
 * activationReplayValidation.ts — W2-PR144A
 *
 * Replay-activation validation. Validates that a proposed activation event
 * is backed by an existing, replay-safe audit capsule — preventing ghost
 * activations and detecting attempts to activate on stale or tampered
 * evidence.
 *
 * Hard invariants:
 *   1. No activation without a replay-verifiable capsule anchor.
 *   2. Containment breach in the anchor capsule voids activation.
 *   3. Temporal skew > maxReplayAgeMs is treated as STALE — fail-closed.
 *   4. Ambiguous anchors surface REPLAY_AMBIGUOUS (never silently pass).
 *   5. Validation digest is deterministic over input — same inputs always
 *      produce the same digest, allowing external re-verification.
 *
 * Pure transform — no fetches, no DB writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { ContainmentVerdict } from './activationReadiness';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReplayActivationVerdict =
  | 'REPLAY_VALID'
  | 'REPLAY_STALE'
  | 'REPLAY_AMBIGUOUS'
  | 'REPLAY_BREACH'
  | 'REPLAY_MISSING';

export interface ReplayAnchor {
  schema: 'vitalcv.replay-anchor.v1';
  capsuleId: string;
  capturedAt: string;
  containmentVerdict: ContainmentVerdict;
  /** Deterministic hash of the capsule's evidence spine at capture time. */
  evidenceSpineHash: string;
  /** True iff the capsule has been successfully replayed at least once. */
  replayVerified: boolean;
}

export interface ActivationReplayInput {
  activationId: string;
  proposedAt: string;
  /** The replay anchor cited by this activation attempt. */
  anchor: ReplayAnchor | null;
  /**
   * Current evidence spine hash to compare against the anchor's.
   * Mismatch → drift detected.
   */
  currentEvidenceSpineHash: string;
  /** Max age in ms before a replay anchor is considered stale. Default 7 days. */
  maxReplayAgeMs?: number;
}

export interface ActivationReplayResult {
  readonly schema: 'vitalcv.activation-replay-result.v1';
  readonly activationId: string;
  readonly verdict: ReplayActivationVerdict;
  readonly anchorCapsuleId: string | null;
  readonly replayAgeMs: number | null;
  readonly evidenceSpineDrifted: boolean;
  readonly failureReasons: ReadonlyArray<ReplayActivationFailureReason>;
  readonly validationDigest: string;
  readonly validatedAt: string;
}

export type ReplayActivationFailureReason =
  | 'NO_ANCHOR_CAPSULE'
  | 'ANCHOR_CONTAINMENT_BREACH'
  | 'ANCHOR_CONTAINMENT_AMBIGUOUS'
  | 'ANCHOR_NOT_REPLAY_VERIFIED'
  | 'ANCHOR_STALE'
  | 'EVIDENCE_SPINE_DRIFTED';

export const KNOWN_REPLAY_ACTIVATION_VERDICTS: ReplayActivationVerdict[] = [
  'REPLAY_VALID',
  'REPLAY_STALE',
  'REPLAY_AMBIGUOUS',
  'REPLAY_BREACH',
  'REPLAY_MISSING',
];

export const KNOWN_REPLAY_FAILURE_REASONS: ReplayActivationFailureReason[] = [
  'NO_ANCHOR_CAPSULE',
  'ANCHOR_CONTAINMENT_BREACH',
  'ANCHOR_CONTAINMENT_AMBIGUOUS',
  'ANCHOR_NOT_REPLAY_VERIFIED',
  'ANCHOR_STALE',
  'EVIDENCE_SPINE_DRIFTED',
];

export const REPLAY_ACTIVATION_SENTINELS = {
  DEFAULT_MAX_REPLAY_AGE_MS: 7 * 24 * 60 * 60 * 1_000, // 7 days
} as const;

// ── Public API ─────────────────────────────────────────────────────────────────

export function validateActivationReplay(
  input: ActivationReplayInput,
): ActivationReplayResult {
  const validatedAt = new Date().toISOString();
  const maxAge = input.maxReplayAgeMs ?? REPLAY_ACTIVATION_SENTINELS.DEFAULT_MAX_REPLAY_AGE_MS;
  const failures: ReplayActivationFailureReason[] = [];

  // Missing anchor → fail-closed
  if (!input.anchor) {
    const validationDigest = sha256ForPayload({
      activationId: input.activationId,
      verdict: 'REPLAY_MISSING',
    });
    return {
      schema: 'vitalcv.activation-replay-result.v1',
      activationId: input.activationId,
      verdict: 'REPLAY_MISSING',
      anchorCapsuleId: null,
      replayAgeMs: null,
      evidenceSpineDrifted: false,
      failureReasons: ['NO_ANCHOR_CAPSULE'],
      validationDigest,
      validatedAt,
    };
  }

  const { anchor } = input;

  // Containment breach → fail-closed
  if (anchor.containmentVerdict === 'CONTAINMENT_BREACH') {
    failures.push('ANCHOR_CONTAINMENT_BREACH');
  }

  // Ambiguous containment
  if (
    anchor.containmentVerdict === 'AMBIGUOUS' ||
    anchor.containmentVerdict === 'QUARANTINED' ||
    anchor.containmentVerdict === 'CONTAMINATED'
  ) {
    failures.push('ANCHOR_CONTAINMENT_AMBIGUOUS');
  }

  // Replay not verified
  if (!anchor.replayVerified) {
    failures.push('ANCHOR_NOT_REPLAY_VERIFIED');
  }

  // Temporal staleness check
  const proposedMs = new Date(input.proposedAt).getTime();
  const capturedMs = new Date(anchor.capturedAt).getTime();
  const replayAgeMs = Number.isNaN(proposedMs) || Number.isNaN(capturedMs)
    ? null
    : proposedMs - capturedMs;

  const isStale = replayAgeMs !== null && replayAgeMs > maxAge;
  if (isStale) {
    failures.push('ANCHOR_STALE');
  }

  // Evidence spine drift
  const evidenceSpineDrifted =
    anchor.evidenceSpineHash !== input.currentEvidenceSpineHash;
  if (evidenceSpineDrifted) {
    failures.push('EVIDENCE_SPINE_DRIFTED');
  }

  // Verdict resolution (fail-closed ordering)
  let verdict: ReplayActivationVerdict;
  if (failures.includes('ANCHOR_CONTAINMENT_BREACH')) {
    verdict = 'REPLAY_BREACH';
  } else if (failures.includes('ANCHOR_CONTAINMENT_AMBIGUOUS')) {
    verdict = 'REPLAY_AMBIGUOUS';
  } else if (failures.includes('ANCHOR_STALE')) {
    verdict = 'REPLAY_STALE';
  } else if (failures.length > 0) {
    verdict = 'REPLAY_AMBIGUOUS';
  } else {
    verdict = 'REPLAY_VALID';
  }

  const validationDigest = sha256ForPayload({
    activationId: input.activationId,
    verdict,
    anchorCapsuleId: anchor.capsuleId,
    replayAgeMs,
    evidenceSpineDrifted,
    failures,
  });

  return {
    schema: 'vitalcv.activation-replay-result.v1',
    activationId: input.activationId,
    verdict,
    anchorCapsuleId: anchor.capsuleId,
    replayAgeMs,
    evidenceSpineDrifted,
    failureReasons: failures,
    validationDigest,
    validatedAt,
  };
}
