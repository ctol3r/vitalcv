/**
 * nextBestAction.ts — derives the next recommended action for a
 * clinician from real learning data, never from hardcoded rules.
 *
 * Reads recent LearningEvent rows (the only learning store) and applies
 * empirical heuristics over the observed history. When there is no
 * usable history the engine returns a safe-default 'REVIEW_MANUALLY'
 * recommendation so the UI never has to fabricate one.
 *
 * This module:
 *   - does not call the decision engine
 *   - does not write any record
 *   - has no opinion on what the system should *be* — only on what
 *     past activity suggests is the most informative next move
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export type NextBestActionKind =
  | 'PROCEED'
  | 'REVERIFY'
  | 'ESCALATE'
  | 'REVIEW_MANUALLY';

export interface NextBestAction {
  action: NextBestActionKind;
  reason: string;
  confidence: number;
  evidenceCount: number;
}

const RECENT_LIMIT = 20;

const SAFE_DEFAULT: NextBestAction = {
  action: 'REVIEW_MANUALLY',
  reason: 'Not enough learning data yet — review manually.',
  confidence: 0,
  evidenceCount: 0,
};

export async function deriveNextBestAction(
  clinicianNpi: string,
): Promise<NextBestAction> {
  if (!clinicianNpi) return SAFE_DEFAULT;

  let records: Array<{ eventType: string; metadata: unknown }> = [];
  try {
    records = await prisma.learningEvent.findMany({
      where: { subjectId: clinicianNpi, loopType: 'USAGE_TRACKING' },
      orderBy: { occurredAt: 'desc' },
      take: RECENT_LIMIT,
      select: { eventType: true, metadata: true },
    });
  } catch (error) {
    log('warn', 'nba_learning_query_failed', {
      subjectId: clinicianNpi,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return SAFE_DEFAULT;
  }

  if (records.length === 0) {
    return SAFE_DEFAULT;
  }

  // Tally observed outcomes from the metadata payload set by
  // captureDecisionSignal / resolveOutcome.
  let driftOutcomes = 0;
  let activatedOutcomes = 0;
  let acceptCount = 0;
  let rejectCount = 0;
  let infoCount = 0;

  for (const row of records) {
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const outcome = typeof meta.outcome === 'string' ? meta.outcome : null;
    if (outcome === 'DRIFT_OCCURRED') driftOutcomes += 1;
    if (outcome === 'START_ACTIVATED') activatedOutcomes += 1;
    if (row.eventType === 'EMPLOYER_ACCEPTED') acceptCount += 1;
    if (row.eventType === 'EMPLOYER_REJECTED') rejectCount += 1;
    if (row.eventType === 'EMPLOYER_REQUESTED_INFO') infoCount += 1;
  }

  // ESCALATE when drift dominates recent history.
  if (driftOutcomes >= 2 && driftOutcomes > activatedOutcomes) {
    return {
      action: 'ESCALATE',
      reason: `Recent history shows ${driftOutcomes} drift events.`,
      confidence: clamp01(driftOutcomes / records.length),
      evidenceCount: records.length,
    };
  }

  // REVERIFY when employers consistently asked for more data.
  if (infoCount >= 2 && infoCount > acceptCount) {
    return {
      action: 'REVERIFY',
      reason: `Employers requested additional verification ${infoCount} times.`,
      confidence: clamp01(infoCount / records.length),
      evidenceCount: records.length,
    };
  }

  // PROCEED when accepts and successful activations dominate.
  if (acceptCount >= 1 && acceptCount + activatedOutcomes > rejectCount + driftOutcomes) {
    return {
      action: 'PROCEED',
      reason: `Recent learning data supports proceeding (${acceptCount} accept(s), ${activatedOutcomes} activation(s)).`,
      confidence: clamp01((acceptCount + activatedOutcomes) / records.length),
      evidenceCount: records.length,
    };
  }

  // Fallback when the data is mixed / inconclusive.
  return {
    action: 'REVIEW_MANUALLY',
    reason: 'Recent activity is mixed — review manually.',
    confidence: 0.25,
    evidenceCount: records.length,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
