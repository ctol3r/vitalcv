import type { FusionCandidate, PolicyContext, PolicyDecision } from './types';

export interface CandidateEvaluation extends PolicyDecision {}

export function resolveFusionGroup(
  candidates: FusionCandidate[],
  context: PolicyContext,
): PolicyDecision {
  if (!candidates.length) {
    throw new Error('Cannot resolve fusion group without candidates');
  }

  const scored = candidates.map((candidate) => evaluateCandidate(candidate, context));
  scored.sort((a, b) => b.metrics.score - a.metrics.score);
  return scored[0];
}

export function evaluateCandidate(
  candidate: FusionCandidate,
  context: PolicyContext,
): CandidateEvaluation {
  const trust = deriveTrust(candidate, context);
  const recency = deriveRecency(candidate, context.now);
  const anchor = candidate.anchor ? 1 : 0;
  const score = clamp01(trust * 0.6 + recency * 0.3 + anchor * 0.1);
  const policy =
    anchor >= trust && anchor >= recency
      ? 'anchor'
      : trust >= recency
        ? 'issuer_trust'
        : 'recency';

  return {
    candidate,
    metrics: {
      trust,
      recency,
      anchor,
      score: Number(score.toFixed(4)),
    },
    policy,
    rationale: buildRationale(candidate, { trust, recency, anchor }),
  };
}

function deriveTrust(candidate: FusionCandidate, context: PolicyContext): number {
  if (typeof candidate.trustWeight === 'number') {
    return clamp01(candidate.trustWeight);
  }
  if (candidate.issuerDid && context.trustDirectory.has(candidate.issuerDid)) {
    return clamp01(context.trustDirectory.get(candidate.issuerDid)!);
  }
  return context.defaultTrust;
}

function deriveRecency(candidate: FusionCandidate, now: Date): number {
  if (!candidate.updatedAt) {
    return 0.4;
  }
  const timestamp = new Date(candidate.updatedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return 0.4;
  }
  const diffDays = Math.abs(now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return 1;
  if (diffDays >= 365) return 0;
  return Number((1 - diffDays / 365).toFixed(4));
}

function buildRationale(
  candidate: FusionCandidate,
  metrics: { trust: number; recency: number; anchor: number },
): string[] {
  const lines = [
    `Issuer trust ${(metrics.trust * 100).toFixed(1)}%`,
    `Recency ${(metrics.recency * 100).toFixed(1)}%`,
  ];
  if (candidate.anchor) {
    lines.push('Chain anchor present');
  }
  lines.push(`Selected source ${candidate.sourceId}`);
  return lines;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

