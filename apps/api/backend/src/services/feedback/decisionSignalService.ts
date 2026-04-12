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
