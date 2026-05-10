/**
 * W2-PR57A — Reviewer confidence + override capture.
 *
 * The existing review action types (employerReviewActions, policy review)
 * record what the human did but not how confident they were or whether they
 * disagreed with an AI suggestion. This module is the additive schema
 * VitalCV surfaces use to capture that signal without modifying the
 * existing action shapes.
 *
 * Truth contract:
 *   - confidence is a fixed enum, never a free-form number. Numeric scores
 *     invite false precision and discourage dissent.
 *   - "high_with_caveat" exists as a distinct value; collapsing it into
 *     "high" hides hesitation that we want preserved.
 *   - Override records are tenant-bound to match the recommendation's
 *     tenant; cross-tenant overrides are refused.
 *   - Override reason is required and cannot be empty.
 *
 * Pure transform module — no I/O.
 */

import type { AiRecommendation, ReviewerActor } from './recommendationLineage';

export type ReviewerConfidence = 'low' | 'medium' | 'high' | 'high_with_caveat';

export type OverrideKind =
  | 'accepted_with_dissent'
  | 'override_with_alternate'
  | 'rejected_with_reason'
  | 'deferred_for_human_only_review';

export interface ReviewerOverrideRecord {
  readonly recommendationId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly reviewerActor: ReviewerActor;
  readonly overrideKind: OverrideKind;
  readonly confidence: ReviewerConfidence;
  readonly reason: string;
  readonly ambiguityNote?: string;
  readonly recordedAt: string;
}

export interface BuildReviewerOverrideInput {
  recommendation: AiRecommendation;
  reviewerActor: ReviewerActor;
  overrideKind: OverrideKind;
  confidence: ReviewerConfidence;
  reason: string;
  ambiguityNote?: string;
  recordedAt: string;
}

export function buildReviewerOverride(
  input: BuildReviewerOverrideInput,
): ReviewerOverrideRecord {
  if (input.reviewerActor.tenantId !== input.recommendation.tenantId) {
    throw new Error(
      `buildReviewerOverride refused: reviewer tenant ${input.reviewerActor.tenantId} does not match recommendation tenant ${input.recommendation.tenantId}.`,
    );
  }
  const trimmedReason = input.reason.trim();
  if (!trimmedReason) {
    throw new Error(
      'buildReviewerOverride refused: reason is required and cannot be empty.',
    );
  }
  if (
    input.overrideKind === 'accepted_with_dissent' &&
    input.confidence === 'high'
  ) {
    throw new Error(
      'buildReviewerOverride refused: accepted_with_dissent with confidence=high is contradictory; use high_with_caveat to preserve the hesitation.',
    );
  }

  return {
    recommendationId: input.recommendation.recommendationId,
    tenantId: input.recommendation.tenantId,
    subjectId: input.recommendation.subjectId,
    reviewerActor: input.reviewerActor,
    overrideKind: input.overrideKind,
    confidence: input.confidence,
    reason: trimmedReason,
    ambiguityNote: input.ambiguityNote?.trim() || undefined,
    recordedAt: input.recordedAt,
  };
}

export interface ReviewerConfidenceSummary {
  readonly windowSize: number;
  readonly distribution: Readonly<Record<ReviewerConfidence, number>>;
  readonly dissentRate: number;
  readonly ambiguityNoteRate: number;
}

export function summarizeReviewerConfidence(
  records: readonly ReviewerOverrideRecord[],
): ReviewerConfidenceSummary {
  const distribution: Record<ReviewerConfidence, number> = {
    low: 0,
    medium: 0,
    high: 0,
    high_with_caveat: 0,
  };
  let dissentCount = 0;
  let ambiguityNotes = 0;

  for (const record of records) {
    distribution[record.confidence] += 1;
    if (
      record.overrideKind === 'accepted_with_dissent' ||
      record.overrideKind === 'override_with_alternate' ||
      record.overrideKind === 'rejected_with_reason'
    ) {
      dissentCount += 1;
    }
    if (record.ambiguityNote) {
      ambiguityNotes += 1;
    }
  }

  const windowSize = records.length;
  return {
    windowSize,
    distribution,
    dissentRate: windowSize === 0 ? 0 : dissentCount / windowSize,
    ambiguityNoteRate: windowSize === 0 ? 0 : ambiguityNotes / windowSize,
  };
}
