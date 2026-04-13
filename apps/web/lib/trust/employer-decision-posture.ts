/**
 * Wave 13: Employer Decision Posture — recommendation resolver.
 *
 * Deterministically maps PassportData to a four-level recommendation
 * that tells an employer whether to proceed, review, take action, or stop.
 */

import type { PassportData } from '@/lib/trust/passport-contract';

export type ReviewRecommendation = 'proceed' | 'review' | 'action_required' | 'do_not_proceed';

export interface RecommendationConfig {
  label: string;
  description: string;
  tone: 'emerald' | 'amber' | 'rose';
  cardClass: string;
}

export const RECOMMENDATION_CONFIG: Record<ReviewRecommendation, RecommendationConfig> = {
  proceed: {
    label: 'Safe to proceed',
    description: 'Safe to proceed based on attached source-backed evidence.',
    tone: 'emerald',
    cardClass: 'border-emerald-500/20 bg-emerald-500/6',
  },
  review: {
    label: 'Manual review recommended',
    description: 'Manual review recommended before proceeding.',
    tone: 'amber',
    cardClass: 'border-amber-500/20 bg-amber-500/6',
  },
  action_required: {
    label: 'Action required',
    description: 'Action required before this review is complete.',
    tone: 'amber',
    cardClass: 'border-amber-500/25 bg-amber-500/8',
  },
  do_not_proceed: {
    label: 'Do not proceed',
    description: 'Do not proceed — critical issues attached.',
    tone: 'rose',
    cardClass: 'border-rose-500/20 bg-rose-500/6',
  },
};

export function resolveRecommendation(passport: PassportData): ReviewRecommendation {
  const { readiness, standing, divergence, trustPosture } = passport;

  // ── Do not proceed ─────────────────────────────────────────────────────
  if (readiness.status === 'BLOCKED') return 'do_not_proceed';
  if (standing.exclusionStatus === 'EXCLUDED') return 'do_not_proceed';
  if (standing.exclusionStatus === 'POSSIBLE_MATCH') return 'do_not_proceed';
  if (divergence && divergence.highCount > 0) return 'do_not_proceed';

  // ── Action required ────────────────────────────────────────────────────
  if (trustPosture.gatedItems.length > 0) return 'action_required';
  if (trustPosture.missingItems.length > 2) return 'action_required';

  // ── Review ─────────────────────────────────────────────────────────────
  if (readiness.status === 'PARTIAL') return 'review';
  if (divergence && divergence.mediumCount > 0) return 'review';
  if (trustPosture.staleItems.length > 0) return 'review';

  // ── Proceed ────────────────────────────────────────────────────────────
  return 'proceed';
}
