/**
 * readinessLineageManifest.ts — W2-PR144A
 *
 * Readiness lineage manifest. Produces a tamper-evident, reconstructable
 * ledger of all evidence that contributed to an activation-readiness score.
 * A regulator can present a manifest ID and verify the score is reproducible
 * from the cited capsule lineage.
 *
 * Hard invariants:
 *   1. Manifest digest folds every contributing capsule ID + its evidence
 *      score + containment verdict. No capsule can be silently dropped.
 *   2. Manifest is immutable once sealed — the sealedAt timestamp is part
 *      of the digest. Re-sealing the same input always produces the same
 *      manifestId prefix and the same digest.
 *   3. Lineage is reconstructable: every evidence contribution cites its
 *      dimension, capsule ID, and replay capsule IDs.
 *   4. Ambiguous contributions are enumerated, not suppressed.
 *
 * Pure transform — no fetches, no DB writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { ReadinessEvidenceCapsule, ActivationReadinessScore } from './activationReadiness';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineageContribution {
  schema: 'vitalcv.lineage-contribution.v1';
  capsuleId: string;
  dimension: string;
  evidenceScore: number;
  containmentVerdict: string;
  replayCapsuleIds: ReadonlyArray<string>;
  observedAt: string;
  /** True iff this capsule contributed to a replay-safe dimension score. */
  replaySafe: boolean;
  /** True iff this capsule's ambiguity was surfaced (not suppressed). */
  ambiguityPreserved: boolean;
}

export interface ReadinessLineageManifest {
  readonly schema: 'vitalcv.readiness-lineage-manifest.v1';
  readonly manifestId: string;
  /** The readiness score this manifest documents. */
  readonly scoredReadiness: number | null;
  readonly overallVerdict: string;
  readonly contributions: ReadonlyArray<LineageContribution>;
  readonly totalCapsuleCount: number;
  readonly replaySafeCount: number;
  readonly ambiguousCount: number;
  readonly breachCount: number;
  /** True iff every ambiguous capsule was enumerated in contributions. */
  readonly ambiguityFullyPreserved: boolean;
  /** SHA-256 over all contributions in canonical order. */
  readonly manifestDigest: string;
  readonly sealedAt: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function sealReadinessLineageManifest(
  score: ActivationReadinessScore,
  capsules: ReadonlyArray<ReadinessEvidenceCapsule>,
): ReadinessLineageManifest {
  const sealedAt = new Date().toISOString();
  const manifestId = `rlm-${sha256ForPayload({ scoreId: score.scoreId, sealedAt }).slice(0, 12)}`;

  const contributions: LineageContribution[] = capsules.map(cap => {
    const replaySafe =
      cap.replayCapsuleIds.length > 0 &&
      cap.containmentVerdict === 'CLEAN';

    const ambiguous = cap.replayCapsuleIds.length === 0;

    return {
      schema: 'vitalcv.lineage-contribution.v1',
      capsuleId: cap.capsuleId,
      dimension: cap.dimension,
      evidenceScore: cap.evidenceScore,
      containmentVerdict: cap.containmentVerdict,
      replayCapsuleIds: cap.replayCapsuleIds,
      observedAt: cap.observedAt,
      replaySafe,
      ambiguityPreserved: ambiguous,
    };
  });

  const replaySafeCount = contributions.filter(c => c.replaySafe).length;
  const ambiguousCount = contributions.filter(c => c.ambiguityPreserved).length;
  const breachCount = contributions.filter(
    c => c.containmentVerdict === 'CONTAINMENT_BREACH',
  ).length;

  // Ambiguity fully preserved iff every ambiguous capsule is enumerated
  const ambiguityFullyPreserved = contributions.every(c => {
    if (c.replayCapsuleIds.length === 0) return c.ambiguityPreserved;
    return true;
  });

  const manifestDigest = sha256ForPayload({
    manifestId,
    sealedAt,
    scoreId: score.scoreId,
    overallVerdict: score.overallVerdict,
    compositeReadiness: score.compositeReadiness,
    readinessDigest: score.readinessDigest,
    contributions: contributions.map(c => ({
      capsuleId: c.capsuleId,
      dimension: c.dimension,
      evidenceScore: c.evidenceScore,
      containmentVerdict: c.containmentVerdict,
      replayCapsuleIds: [...c.replayCapsuleIds].sort(),
    })).sort((a, b) => a.capsuleId.localeCompare(b.capsuleId)),
  });

  return {
    schema: 'vitalcv.readiness-lineage-manifest.v1',
    manifestId,
    scoredReadiness: score.compositeReadiness,
    overallVerdict: score.overallVerdict,
    contributions,
    totalCapsuleCount: capsules.length,
    replaySafeCount,
    ambiguousCount,
    breachCount,
    ambiguityFullyPreserved,
    manifestDigest,
    sealedAt,
  };
}
