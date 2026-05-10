/**
 * fixtures.ts — Deterministic ReplayEvidence builders for economic-trust tests.
 *
 * Wave: W2-PR60A.
 *
 * The builders are seeded so tests are reproducible. They model three traffic
 * profiles: a steady "good" tenant, a noisy "mixed" tenant, and a malicious
 * "bad" tenant whose replays trip every guard.
 */

import type { ReplayEvidence } from '../types';

export interface FixtureOptions {
  count: number;
  seed: number;
  windowStart: Date;
  windowEnd: Date;
  tenantPool?: readonly string[];
  verifierPool?: readonly { id: string; type: ReplayEvidence['verifierType'] }[];
  /** Mean replay-to-evidence verification gap, in ms. */
  meanTimeToStartMs?: number;
  /** Probability a record's integrity verdict is 'pass'. */
  integrityPassProbability?: number;
  /** Probability a record's reuse fully matches artifact count. */
  fullReuseProbability?: number;
}

export function buildReplayEvidence(options: FixtureOptions): ReplayEvidence[] {
  const tenantPool = options.tenantPool ?? ['tenant-a', 'tenant-b', 'tenant-c'];
  const verifierPool = options.verifierPool ?? [
    { id: 'sys-1', type: 'SYSTEM' as const },
    { id: 'sys-2', type: 'SYSTEM' as const },
    { id: 'org-acme', type: 'ORGANIZATION' as const },
    { id: 'reviewer-42', type: 'HUMAN' as const },
  ];
  const meanTimeToStartMs = options.meanTimeToStartMs ?? 90_000;
  const integrityPassProbability = options.integrityPassProbability ?? 0.96;
  const fullReuseProbability = options.fullReuseProbability ?? 0.55;

  const rng = makeRng(options.seed >>> 0);
  const windowSpanMs = options.windowEnd.getTime() - options.windowStart.getTime();
  if (windowSpanMs < 0) throw new Error('windowEnd must be ≥ windowStart');

  const out: ReplayEvidence[] = [];
  for (let i = 0; i < options.count; i += 1) {
    const tenant = tenantPool[Math.floor(rng() * tenantPool.length)];
    const verifier = verifierPool[Math.floor(rng() * verifierPool.length)];
    const decisionOffset = rng() * windowSpanMs;
    const decisionEmittedAt = new Date(options.windowStart.getTime() + decisionOffset);
    const ttsMs = Math.max(0, expSample(rng, meanTimeToStartMs));
    const evidenceVerifiedAt = new Date(decisionEmittedAt.getTime() - ttsMs);
    const replayCompletedAt = new Date(decisionEmittedAt.getTime() + 50 + rng() * 250);
    const replayDurationMs = replayCompletedAt.getTime() - decisionEmittedAt.getTime();

    const evidenceArtifactCount = 4 + Math.floor(rng() * 9); // 4..12
    const reusedArtifactCount =
      rng() < fullReuseProbability
        ? evidenceArtifactCount
        : Math.floor(rng() * (evidenceArtifactCount + 1));
    const integrityRoll = rng();
    const integrityVerdict: ReplayEvidence['integrityVerdict'] =
      integrityRoll < integrityPassProbability
        ? 'pass'
        : integrityRoll < integrityPassProbability + (1 - integrityPassProbability) * 0.6
          ? 'inconclusive'
          : 'fail';
    const decisionOutcomeRoll = rng();
    const decisionOutcome: ReplayEvidence['decisionOutcome'] =
      decisionOutcomeRoll < 0.7
        ? 'APPROVED'
        : decisionOutcomeRoll < 0.85
          ? 'PENDING'
          : decisionOutcomeRoll < 0.95
            ? 'DECLINED'
            : 'WITHDRAWN';
    const authorityChainDepth = 3 + Math.floor(rng() * 4); // 3..6

    out.push({
      replayId: `r-${options.seed}-${i}`,
      capsuleId: `cap-${options.seed}-${i}`,
      tenantId: tenant,
      verifierType: verifier.type,
      verifierId: verifier.id,
      evidenceVerifiedAt,
      decisionEmittedAt,
      replayCompletedAt,
      replayDurationMs,
      evidenceArtifactCount,
      reusedArtifactCount,
      authorityChainDepth,
      integrityVerdict,
      decisionOutcome,
    });
  }
  return out;
}

function makeRng(seed: number): () => number {
  let state = seed || 0xdeadbeef;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function expSample(rng: () => number, mean: number): number {
  // Inverse-CDF sample from Exponential(1/mean).
  const u = Math.max(rng(), 1e-12);
  return -Math.log(u) * mean;
}
