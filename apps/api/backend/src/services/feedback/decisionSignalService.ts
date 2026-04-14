/**
 * decisionSignalService.ts — Enriches employer decisions with learning signals.
 *
 * For each employer action (accept/reject/request-info), captures structured
 * metadata alongside the existing audit event: time-to-decision, missing fields,
 * verified vs inferred breakdown, readiness score, and match context.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { emitLearningEvent } from './prismaEventStore';

export type EmployerDecisionType = 'accept' | 'reject' | 'request_info';

export interface DecisionSignalInput {
  entityId: string;
  employerId: string;
  decision: EmployerDecisionType;
  trustSnapshot?: {
    readinessStatus?: string;
    readinessScore?: number;
    trustBand?: string;
    trustScore?: number;
    blockerCount?: number;
    topBlockers?: string[];
    exclusionStatus?: string;
    verifiedCredentialCount?: number;
    staleCredentialCount?: number;
    snapshotHash?: string;
  } | null;
  missingCritical?: string[];
  missingNonCritical?: string[];
  bundleId?: string | null;
  opportunityId?: string | null;
}

const EVENT_TYPE_MAP: Record<EmployerDecisionType, string> = {
  accept: 'EMPLOYER_ACCEPTED',
  reject: 'EMPLOYER_REJECTED',
  request_info: 'EMPLOYER_REQUESTED_INFO',
};

export async function captureDecisionSignal(input: DecisionSignalInput): Promise<void> {
  try {
    // Compute time-to-decision: time since most recent EMPLOYER_VIEWED for this entity+employer
    let timeToDecisionMs: number | null = null;
    const viewedEvent = await prisma.learningEvent.findFirst({
      where: {
        eventType: 'EMPLOYER_VIEWED',
        sourceId: input.employerId,
        subjectId: input.entityId,
        loopType: 'USAGE_TRACKING',
      },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });

    if (viewedEvent) {
      timeToDecisionMs = Date.now() - viewedEvent.occurredAt.getTime();
    }

    // Compute verified vs inferred breakdown from snapshot
    const verifiedCount = input.trustSnapshot?.verifiedCredentialCount ?? 0;
    const staleCount = input.trustSnapshot?.staleCredentialCount ?? 0;

    emitLearningEvent({
      type: EVENT_TYPE_MAP[input.decision],
      providerId: input.entityId,
      jobId: input.opportunityId ?? '',
      employerId: input.employerId,
      payload: {},
      metadata: {
        decision: input.decision,
        timeToDecisionMs,
        readinessScore: input.trustSnapshot?.readinessScore ?? null,
        trustBand: input.trustSnapshot?.trustBand ?? null,
        trustScore: input.trustSnapshot?.trustScore ?? null,
        blockerCount: input.trustSnapshot?.blockerCount ?? 0,
        topBlockers: input.trustSnapshot?.topBlockers ?? [],
        exclusionStatus: input.trustSnapshot?.exclusionStatus ?? null,
        verifiedCredentialCount: verifiedCount,
        staleCredentialCount: staleCount,
        missingCriticalCount: input.missingCritical?.length ?? 0,
        missingCritical: input.missingCritical ?? [],
        missingNonCritical: input.missingNonCritical ?? [],
        bundleId: input.bundleId ?? null,
      },
    });

    log('info', 'decision_signal_captured', {
      entityId: input.entityId,
      decision: input.decision,
      timeToDecisionMs,
      readinessScore: input.trustSnapshot?.readinessScore,
    });
  } catch (error) {
    log('warn', 'decision_signal_capture_failed', {
      entityId: input.entityId,
      decision: input.decision,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Attach a terminal outcome to the most recent pending decision signal
 * for the given subject. Best-effort: never throws back to the caller,
 * returns silently when no pending record exists.
 *
 * Outcome values are free-form strings (e.g. 'START_ACTIVATED',
 * 'DRIFT_OCCURRED', 'SUCCESS', 'FAILURE') stored on the LearningEvent
 * metadata. Pending records are those whose metadata.outcome is null,
 * 'PENDING', or absent.
 */
export interface ResolveOutcomeInput {
  /** subjectId on the LearningEvent — typically the clinician NPI or entityId. */
  clinicianNpi: string;
  outcome: string;
}

const DECISION_EVENT_TYPES = [
  'EMPLOYER_ACCEPTED',
  'EMPLOYER_REJECTED',
  'EMPLOYER_REQUESTED_INFO',
];

export async function resolveOutcome(input: ResolveOutcomeInput): Promise<void> {
  if (!input.clinicianNpi || !input.outcome) {
    log('warn', 'decision_signal_resolve_invalid_input', {
      has_npi: Boolean(input.clinicianNpi),
      has_outcome: Boolean(input.outcome),
    });
    return;
  }

  try {
    const pending = await prisma.learningEvent.findFirst({
      where: {
        subjectId: input.clinicianNpi,
        eventType: { in: DECISION_EVENT_TYPES },
        loopType: 'USAGE_TRACKING',
      },
      orderBy: { occurredAt: 'desc' },
      select: { id: true, metadata: true },
    });

    if (!pending) {
      log('info', 'decision_signal_resolve_no_pending', {
        subjectId: input.clinicianNpi,
        outcome: input.outcome,
      });
      return;
    }

    const currentMeta =
      pending.metadata && typeof pending.metadata === 'object' && !Array.isArray(pending.metadata)
        ? (pending.metadata as Record<string, unknown>)
        : {};
    const currentOutcome = currentMeta.outcome;
    if (typeof currentOutcome === 'string' && currentOutcome !== 'PENDING') {
      // Already resolved — do not overwrite a terminal outcome.
      log('info', 'decision_signal_resolve_already_resolved', {
        subjectId: input.clinicianNpi,
        existing: currentOutcome,
        attempted: input.outcome,
      });
      return;
    }

    await prisma.learningEvent.update({
      where: { id: pending.id },
      data: {
        metadata: {
          ...currentMeta,
          outcome: input.outcome,
          resolvedAt: new Date().toISOString(),
        } as never,
      },
    });

    log('info', 'decision_signal_resolved', {
      subjectId: input.clinicianNpi,
      outcome: input.outcome,
    });
  } catch (error) {
    log('warn', 'decision_signal_resolve_failed', {
      subjectId: input.clinicianNpi,
      outcome: input.outcome,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
