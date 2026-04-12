/**
 * Wave 13: CRS Score Explainability — deterministic breakdown builder.
 *
 * Derives positive contributors, penalties, and trust caps from PassportData
 * so the employer review surface can show "Why this score?" transparently.
 */

import type { PassportData } from '@/lib/trust/passport-contract';

export interface ScoreFactor {
  id: string;
  label: string;
  detail: string;
  impact: number;
  source?: string;
}

export interface TrustCap {
  id: string;
  label: string;
  reason: string;
  cappedAt: string;
}

export interface ScoreExplainability {
  score: number;
  band: string;
  bandLabel: string;
  positiveContributors: ScoreFactor[];
  penalties: ScoreFactor[];
  trustCaps: TrustCap[];
}

export function buildScoreExplainability(passport: PassportData): ScoreExplainability {
  const { trustPosture, divergence, decisionPosture, readiness } = passport;

  const positiveContributors: ScoreFactor[] = [];
  const penalties: ScoreFactor[] = [];
  const trustCaps: TrustCap[] = [];

  // ── Positive contributors ──────────────────────────────────────────────
  for (const dimension of trustPosture.dimensions) {
    if (dimension.state === 'current') {
      positiveContributors.push({
        id: `dim-${dimension.id}`,
        label: dimension.label,
        detail: dimension.detail,
        impact: 0,
        source: dimension.checkedAt ? `Checked ${dimension.checkedAt}` : undefined,
      });
    }
  }

  if (decisionPosture) {
    for (const proven of decisionPosture.proven) {
      const alreadyCovered = positiveContributors.some((p) => p.id === `dim-${proven.dimension}`);
      if (!alreadyCovered) {
        positiveContributors.push({
          id: `proven-${proven.sourceId}`,
          label: `${proven.dimension} — ${proven.sourceId}`,
          detail: proven.reason,
          impact: 0,
          source: proven.checkedAt ?? undefined,
        });
      }
    }
  }

  for (const item of trustPosture.safeToRelyOnNow) {
    const alreadyCovered = positiveContributors.some(
      (p) => p.label.toLowerCase() === item.toLowerCase(),
    );
    if (!alreadyCovered) {
      positiveContributors.push({
        id: `safe-${item}`,
        label: item,
        detail: 'Source-backed and current',
        impact: 0,
      });
    }
  }

  // ── Penalties ──────────────────────────────────────────────────────────
  if (divergence && divergence.totalPenalty > 0) {
    penalties.push({
      id: 'divergence-penalty',
      label: 'Cross-source divergence',
      detail: `${divergence.activeCount} active conflict${divergence.activeCount === 1 ? '' : 's'} detected`,
      impact: -divergence.totalPenalty,
    });
  }

  for (const dimension of trustPosture.dimensions) {
    if (dimension.state === 'stale') {
      penalties.push({
        id: `stale-${dimension.id}`,
        label: `${dimension.label} — stale`,
        detail: 'Evidence is outside the freshness window',
        impact: -5,
      });
    }
  }

  for (const item of trustPosture.missingItems) {
    penalties.push({
      id: `missing-${item}`,
      label: item,
      detail: 'Missing or unresolved',
      impact: -5,
    });
  }

  // ── Trust caps ─────────────────────────────────────────────────────────
  for (const blocker of readiness.blockers) {
    trustCaps.push({
      id: `blocker-${blocker}`,
      label: blocker,
      reason: 'Blocks trust advancement until resolved',
      cappedAt: readiness.level,
    });
  }

  for (const item of trustPosture.gatedItems) {
    const alreadyCapped = trustCaps.some((c) => c.label === item);
    if (!alreadyCapped) {
      trustCaps.push({
        id: `gated-${item}`,
        label: item,
        reason: 'Requires institutional access to advance',
        cappedAt: trustPosture.band,
      });
    }
  }

  return {
    score: readiness.score,
    band: trustPosture.band,
    bandLabel: trustPosture.bandLabel,
    positiveContributors,
    penalties,
    trustCaps,
  };
}
