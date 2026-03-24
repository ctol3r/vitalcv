/**
 * sealEventCapture.ts — SEAL Training Event Capture
 *
 * SAFETY CONTRACT
 * ───────────────
 * These functions are WRITE-ONLY from the product's perspective.
 * They append behavioral outcome signals to the SEAL training tables.
 *
 * What this service MAY touch:
 *   advisory_outcome_events, blocker_resolution_events,
 *   employer_decision_events, start_outcome_events
 *
 * What this service MUST NEVER touch:
 *   claims, artifacts, receipts, readiness_score computation,
 *   trust_state, verification_status on any credential row.
 *
 * All captures are fire-and-forget (non-blocking).
 * A capture failure MUST NOT fail the triggering product flow.
 *
 * Attribution rule: any advisory content trained from these events
 * must be labeled "Based on observed patterns" in all user-facing output.
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { mergeScope, type PilotScope } from './pilotScope';

// ── Types ──────────────────────────────────────────────────────────────────

export type AdvisoryEventType =
  | 'PASSPORT_VIEW'
  | 'SHARE_INITIATED'
  | 'EMPLOYER_REVIEW'
  | 'INTERVIEW_MODE'
  | 'PACKET_EXPORT';

export type EmployerDecision =
  | 'PROCEED'
  | 'HOLD'
  | 'REQUEST_REFRESH'
  | 'ROUTE_TO_REVIEW'
  | 'REJECT';

export type BlockerResolutionMethod =
  | 'SOURCE_UPDATE'
  | 'MANUAL_UPLOAD'
  | 'WAIVED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface SourceCoverageSnapshot {
  live:       string[];
  gated:      string[];
  mock:       string[];
  notChecked: string[];
}

// ── 1. Advisory Outcome Event ─────────────────────────────────────────────

export interface CaptureAdvisoryEventInput {
  entityId:              string;
  organizationContextId?: string | null;
  advisoryVersion:       string;
  eventType:             AdvisoryEventType;
  blockersAtEvent:       string[];
  readinessScoreAtEvent: number | null;
  sourceCoverageAtEvent: SourceCoverageSnapshot | Record<string, unknown>;
  advisoryInputSnapshotRef?:  string | null;
  advisoryOutputSnapshotRef?: string | null;
  metadata?:             Record<string, unknown>;
  /** Pilot scoping — stored in metadata.pilotId / .workflowLane / .geographyTag */
  scope?:                PilotScope | null;
}

export async function captureAdvisoryEvent(input: CaptureAdvisoryEventInput): Promise<void> {
  try {
    await prisma.advisoryOutcomeEvent.create({
      data: {
        id:                        randomUUID(),
        entityId:                  input.entityId,
        organizationContextId:     input.organizationContextId ?? null,
        advisoryVersion:           input.advisoryVersion,
        advisoryInputSnapshotRef:  input.advisoryInputSnapshotRef ?? null,
        advisoryOutputSnapshotRef: input.advisoryOutputSnapshotRef ?? null,
        eventType:                 input.eventType,
        eventTimestamp:            new Date(),
        blockersAtEvent:           JSON.parse(JSON.stringify(input.blockersAtEvent)),
        readinessScoreAtEvent:     input.readinessScoreAtEvent ?? null,
        sourceCoverageAtEvent:     JSON.parse(JSON.stringify(input.sourceCoverageAtEvent)),
        metadata:                  JSON.parse(JSON.stringify(mergeScope(input.metadata ?? {}, input.scope))),
      },
    });
    log('debug', 'seal_advisory_event_captured', { eventType: input.eventType, entityId: input.entityId.slice(0, 8) + '…' });
  } catch (err) {
    // Non-blocking — log and continue
    log('warn', 'seal_advisory_event_capture_failed', {
      eventType: input.eventType,
      error:     err instanceof Error ? err.message : String(err),
    });
  }
}

// ── 2. Blocker Resolution Event ───────────────────────────────────────────

export interface OpenBlockerInput {
  entityId:    string;
  blockerCode: string;
  metadata?:   Record<string, unknown>;
}

export async function openBlockerEvent(input: OpenBlockerInput): Promise<string | null> {
  try {
    const event = await prisma.blockerResolutionEvent.create({
      data: {
        id:          randomUUID(),
        entityId:    input.entityId,
        blockerCode: input.blockerCode,
        openedAt:    new Date(),
        status:      'OPEN',
        metadata:    JSON.parse(JSON.stringify(input.metadata ?? {})),
      },
    });
    return event.id;
  } catch (err) {
    log('warn', 'seal_blocker_open_failed', {
      blockerCode: input.blockerCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface ResolveBlockerInput {
  blockerEventId:    string;
  resolutionMethod:  BlockerResolutionMethod;
  metadata?:         Record<string, unknown>;
}

export async function resolveBlockerEvent(input: ResolveBlockerInput): Promise<void> {
  try {
    const existing = await prisma.blockerResolutionEvent.findUnique({
      where:  { id: input.blockerEventId },
      select: { openedAt: true },
    });
    if (!existing) return;

    const resolvedAt    = new Date();
    const resolutionMs  = resolvedAt.getTime() - existing.openedAt.getTime();
    const resolutionDays = Math.ceil(resolutionMs / 86_400_000);

    await prisma.blockerResolutionEvent.update({
      where: { id: input.blockerEventId },
      data: {
        resolvedAt,
        resolutionDays,
        resolutionMethod: input.resolutionMethod,
        status:           'RESOLVED',
        metadata:         JSON.parse(JSON.stringify(input.metadata ?? {})),
      },
    });
    log('debug', 'seal_blocker_resolved', { blockerEventId: input.blockerEventId, resolutionDays });
  } catch (err) {
    log('warn', 'seal_blocker_resolve_failed', {
      blockerEventId: input.blockerEventId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * syncBlockerEvents — idempotent blocker lifecycle sync.
 *
 * Called after every readiness recompute (in passportService.buildPassport).
 * Compares the current blocker list against the open events in the DB:
 *
 *   NEW blocker (not in DB as OPEN):
 *     → openBlockerEvent() — creates OPEN row with openedAt=now
 *
 *   GONE blocker (in DB as OPEN, not in current list):
 *     → resolveBlockerEvent() — stamps resolvedAt, computes resolutionDays
 *
 *   RE-OPENED blocker (in DB as RESOLVED, back in current list):
 *     → openBlockerEvent() — creates a new OPEN row (new episode, new timing)
 *
 *   UNCHANGED blocker (OPEN in DB, still in current list):
 *     → no-op (idempotent — does not create duplicate events)
 *
 * Always fire-and-forget. A sync failure must never block passport delivery.
 */
export async function syncBlockerEvents(
  entityId:     string,
  blockerCodes: string[],
  scope?:       PilotScope | null,
): Promise<{ opened: number; resolved: number; noOp: number }> {
  const result = { opened: 0, resolved: 0, noOp: 0 };

  try {
    // Fetch only OPEN rows — RESOLVED rows are historical and immutable
    const openRows = await prisma.blockerResolutionEvent.findMany({
      where:  { entityId, status: 'OPEN' },
      select: { id: true, blockerCode: true, openedAt: true },
    });

    const openByCode = new Map(openRows.map(r => [r.blockerCode, r]));
    const currentSet = new Set(blockerCodes);

    // ── NEW blockers: in current list but no OPEN row ──────────────────
    const toOpen = blockerCodes.filter(code => !openByCode.has(code));
    if (toOpen.length > 0) {
      await prisma.blockerResolutionEvent.createMany({
        data: toOpen.map(blockerCode => ({
          id:          randomUUID(),
          entityId,
          blockerCode,
          openedAt:    new Date(),
          status:      'OPEN',
          metadata:    JSON.parse(JSON.stringify(mergeScope({ source: 'readiness_recompute' }, scope))),
        })),
        skipDuplicates: true, // extra guard against race conditions
      });
      result.opened += toOpen.length;
      log('debug', 'seal_blockers_opened', {
        entityId: entityId.slice(0, 8) + '…',
        codes: toOpen,
      });
    }

    // ── RESOLVED blockers: OPEN in DB but no longer in current list ────
    const toResolve = openRows.filter(r => !currentSet.has(r.blockerCode));
    for (const br of toResolve) {
      await resolveBlockerEvent({
        blockerEventId:   br.id,
        resolutionMethod: 'SOURCE_UPDATE',
        metadata:         { source: 'readiness_recompute' },
      });
      result.resolved++;
    }
    if (toResolve.length > 0) {
      log('debug', 'seal_blockers_resolved', {
        entityId: entityId.slice(0, 8) + '…',
        codes: toResolve.map(r => r.blockerCode),
      });
    }

    // ── NO-OP: blockers unchanged ──────────────────────────────────────
    result.noOp = blockerCodes.filter(code => openByCode.has(code)).length;

    // ── RE-OPENED: was previously RESOLVED, now back in current list ───
    // Handled implicitly: toOpen includes any code that has no current OPEN row,
    // which covers re-opened blockers (prior RESOLVED rows exist but status≠OPEN).

  } catch (err) {
    log('warn', 'seal_blocker_sync_failed', {
      entityId: entityId.slice(0, 8) + '…',
      error:    err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

// ── 3. Employer Decision Event ────────────────────────────────────────────

export interface CaptureEmployerDecisionInput {
  entityId:                string;
  organizationContextId?:  string | null;
  decision:                EmployerDecision;
  reviewerRole?:           string;
  auditEventId?:           string | null;
  trustSnapshotAtDecision: Record<string, unknown>;
  blockersAtDecision:      string[];
  readinessScoreAtDecision?: number | null;
  metadata?:               Record<string, unknown>;
  scope?:                  PilotScope | null;
}

export async function captureEmployerDecision(input: CaptureEmployerDecisionInput): Promise<void> {
  try {
    await prisma.employerDecisionEvent.create({
      data: {
        id:                       randomUUID(),
        entityId:                 input.entityId,
        organizationContextId:    input.organizationContextId ?? null,
        decision:                 input.decision,
        decidedAt:                new Date(),
        reviewerRole:             input.reviewerRole ?? 'EMPLOYER',
        auditEventId:             input.auditEventId ?? null,
        trustSnapshotAtDecision:  JSON.parse(JSON.stringify(input.trustSnapshotAtDecision)),
        blockersAtDecision:       JSON.parse(JSON.stringify(input.blockersAtDecision)),
        readinessScoreAtDecision: input.readinessScoreAtDecision ?? null,
        metadata:                 JSON.parse(JSON.stringify(mergeScope(input.metadata ?? {}, input.scope))),
      },
    });
    log('debug', 'seal_employer_decision_captured', { decision: input.decision, entityId: input.entityId.slice(0, 8) + '…' });
  } catch (err) {
    log('warn', 'seal_employer_decision_capture_failed', {
      decision: input.decision,
      error:    err instanceof Error ? err.message : String(err),
    });
  }
}

// ── 4. Start Outcome Event ────────────────────────────────────────────────

export interface CaptureStartOutcomeInput {
  entityId:              string;
  organizationContextId?: string | null;
  startedAt:             Date;
  readinessScoreAtStart?: number | null;
  blockersAtStart:       string[];
  sourceCoverageAtStart: SourceCoverageSnapshot | Record<string, unknown>;
  metadata?:             Record<string, unknown>;
  scope?:                PilotScope | null;
}

export async function captureStartOutcome(input: CaptureStartOutcomeInput): Promise<void> {
  try {
    // Compute deltas from prior events for this entity
    const [firstReview, firstShare, firstReady] = await Promise.all([
      prisma.employerDecisionEvent.findFirst({
        where:   { entityId: input.entityId },
        orderBy: { decidedAt: 'asc' },
        select:  { decidedAt: true },
      }),
      prisma.advisoryOutcomeEvent.findFirst({
        where:   { entityId: input.entityId, eventType: 'SHARE_INITIATED' },
        orderBy: { eventTimestamp: 'asc' },
        select:  { eventTimestamp: true },
      }),
      // "Ready" = first advisory event where readiness score was L2+ (score >= 60)
      prisma.advisoryOutcomeEvent.findFirst({
        where: {
          entityId:              input.entityId,
          readinessScoreAtEvent: { gte: 60 },
        },
        orderBy: { eventTimestamp: 'asc' },
        select:  { eventTimestamp: true },
      }),
    ]);

    function daysBetween(earlier: Date | null | undefined, later: Date): number | null {
      if (!earlier) return null;
      const ms = later.getTime() - earlier.getTime();
      return Math.max(0, Math.ceil(ms / 86_400_000));
    }

    await prisma.startOutcomeEvent.create({
      data: {
        id:                    randomUUID(),
        entityId:              input.entityId,
        organizationContextId: input.organizationContextId ?? null,
        startedAt:             input.startedAt,
        daysFromFirstReview:   daysBetween(firstReview?.decidedAt, input.startedAt),
        daysFromShare:         daysBetween(firstShare?.eventTimestamp, input.startedAt),
        daysFromReady:         daysBetween(firstReady?.eventTimestamp, input.startedAt),
        readinessScoreAtStart: input.readinessScoreAtStart ?? null,
        blockersAtStart:       JSON.parse(JSON.stringify(input.blockersAtStart)),
        sourceCoverageAtStart: JSON.parse(JSON.stringify(input.sourceCoverageAtStart)),
        metadata:              JSON.parse(JSON.stringify(mergeScope(input.metadata ?? {}, input.scope))),
      },
    });
    log('info', 'seal_start_outcome_captured', { entityId: input.entityId.slice(0, 8) + '…', startedAt: input.startedAt.toISOString() });
  } catch (err) {
    log('warn', 'seal_start_outcome_capture_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
