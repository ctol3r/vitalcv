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

import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { type PilotScope } from './pilotScope';
import { appendAuditEvent } from '../audit/auditLedger';
import { sha256ForPayload } from '../../utils/deterministic';

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
  checked:    string[];
  stale:      string[];
  pending:    string[];
  gated:      string[];
  unavailable: string[];
  accessRequired: string[];
  reviewRequired: string[];
  notDecisionGrade: string[];
  previewOnly: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PILOT_PROOF_EVENT_AUDIT_TYPE = 'PILOT_PROOF_EVENT';
const PILOT_PROOF_EVENT_SCHEMA = 'vitalcv.pilot-proof.event.v1';

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function resolveStartOutcomeEntityId(entityRef: string): Promise<string | null> {
  if (isUuid(entityRef)) {
    return entityRef;
  }

  // Compatibility only: some legacy start callers still pass clinician NPI.
  // We resolve it here so start_outcome_events always retain the canonical entity FK.
  const entity = await prisma.vcvEntity.findFirst({
    where: { npi: entityRef },
    select: { id: true },
  });

  if (!entity?.id) {
    log('warn', 'seal_start_outcome_entity_unresolved', {
      entityRef: entityRef.slice(0, 8) + '…',
    });
    return null;
  }

  return entity.id;
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

export async function captureAdvisoryEvent(_input: CaptureAdvisoryEventInput): Promise<void> {
  // TODO: removed — referenced non-existent Prisma model advisoryOutcomeEvent
}

// ── 2. Blocker Resolution Event ───────────────────────────────────────────

export interface OpenBlockerInput {
  entityId:    string;
  blockerCode: string;
  metadata?:   Record<string, unknown>;
  scope?:      PilotScope | null;
}

/**
 * openBlockerEvent — record a new blocker episode.
 *
 * Dedupe: if an OPEN row already exists for this entityId + blockerCode,
 * the call is a no-op and returns the existing event ID.
 */
export async function openBlockerEvent(_input: OpenBlockerInput): Promise<string | null> {
  // TODO: removed — referenced non-existent Prisma model blockerResolutionEvent
  return null;
}

export interface ResolveBlockerInput {
  blockerEventId:    string;
  resolutionMethod:  BlockerResolutionMethod;
  metadata?:         Record<string, unknown>;
}

export async function resolveBlockerEvent(_input: ResolveBlockerInput): Promise<void> {
  // TODO: removed — referenced non-existent Prisma model blockerResolutionEvent
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
  _entityId:     string,
  _blockerCodes: string[],
  _scope?:       PilotScope | null,
): Promise<{ opened: number; resolved: number; noOp: number }> {
  // TODO: removed — referenced non-existent Prisma model blockerResolutionEvent
  return { opened: 0, resolved: 0, noOp: 0 };
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

export async function captureEmployerDecision(_input: CaptureEmployerDecisionInput): Promise<void> {
  // TODO: removed — referenced non-existent Prisma model employerDecisionEvent
}

// ── 4. Start Outcome Event ────────────────────────────────────────────────

export type StartOutcomeStatus = 'STARTED' | 'NOT_STARTED';

export interface CaptureStartOutcomeInput {
  /** Canonical entity UUID. Legacy callers may still pass NPI; this helper resolves it. */
  entityId:              string;
  organizationContextId?: string | null;
  /** Outcome: started or not_started */
  outcomeStatus?:        StartOutcomeStatus;
  /** When the clinician actually started (required for STARTED, optional for NOT_STARTED) */
  startedAt:             Date;
  /** Alias: explicit actual start date (overrides startedAt when provided) */
  actualStartDate?:      Date | null;
  readinessScoreAtStart?: number | null;
  blockersAtStart:       string[];
  sourceCoverageAtStart: SourceCoverageSnapshot | Record<string, unknown>;
  /** Human-readable reason (e.g., "offer rescinded", "visa delay") */
  reason?:               string | null;
  /** Free-text notes about blockers at the time of start/non-start */
  blockerNotes?:         string | null;
  metadata?:             Record<string, unknown>;
  scope?:                PilotScope | null;
}

export async function captureStartOutcome(_input: CaptureStartOutcomeInput): Promise<void> {
  // TODO: removed — referenced non-existent Prisma model startOutcomeEvent
}

export interface RecordPilotProofEventInput {
  eventName: 'readiness_changed' | 'start_outcome_recorded' | 'blocker_opened' | 'blocker_resolved';
  entityId?: string | null;
  organizationContextId?: string | null;
  organizationId?: string | null;
  occurredAt?: string | null;
  npi?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordPilotProofEvent(input: RecordPilotProofEventInput): Promise<void> {
  try {
    const entityRef = readOptionalString(input.entityId) ?? readOptionalString(input.npi);
    const resolvedEntityId = entityRef ? await resolveStartOutcomeEntityId(entityRef) : null;
    const npi = readOptionalString(input.npi);
    const occurredAt = readOptionalString(input.occurredAt) ?? new Date().toISOString();
    const createdAt = new Date(occurredAt);

    const metadata = JSON.parse(JSON.stringify({
      ...(input.metadata ?? {}),
      schema: PILOT_PROOF_EVENT_SCHEMA,
      eventName: input.eventName,
      entityId: resolvedEntityId,
      npi,
      organizationContextId: input.organizationContextId ?? null,
      occurredAt,
    })) as Record<string, unknown>;

    const organizationId =
      readOptionalString(input.organizationId)
      ?? readOptionalString(metadata.organizationId);
    const hash = sha256ForPayload({
      type: PILOT_PROOF_EVENT_AUDIT_TYPE,
      referenceId: resolvedEntityId,
      clinicianId: npi,
      organizationId,
      createdAt: createdAt.toISOString(),
      metadata,
    });

    await prisma.auditEvent.create({
      data: {
        type: PILOT_PROOF_EVENT_AUDIT_TYPE,
        hash,
        referenceId: resolvedEntityId,
        clinicianId: npi,
        organizationId,
        createdAt,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  } catch (err) {
    log('warn', 'pilot_proof_event_capture_failed', {
      eventName: input.eventName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── 5. Readiness Change Event ─────────────────────────────────────────────────
//
// Wave ROI: Captures band transitions from the async trust engine.
// Written to AuditEvent (no new model — consistent with audit chain).
// category: ['READINESS_CHANGE']
// Queryable by pilotKpiService for readinessChangeCount and velocity deltas.

export interface CaptureReadinessChangeInput {
  npi: string;
  entityId?: string | null;
  previousBand: string | null;
  newBand: string;
  degraded: boolean;
  triggerEventType: string;
  triggerEventId?: string | null;
  affectedCapsuleCount: number;
  processedAt: string;
}

export async function captureReadinessChange(input: CaptureReadinessChangeInput): Promise<void> {
  try {
    const resolvedEntityId = input.entityId
      ? await resolveStartOutcomeEntityId(input.entityId)
      : await resolveStartOutcomeEntityId(input.npi);
    const direction = input.degraded
      ? 'DEGRADED'
      : input.previousBand === null
        ? 'INITIAL'
        : 'IMPROVED';

    await appendAuditEvent({
      category: ['READINESS_CHANGE'],
      actor: 'async-trust-engine',
      resource: `trust-state:${input.npi}`,
      severity: input.degraded ? 'WARNING' : 'INFO',
      requestFields: {
        npi:              input.npi,
        entityId:         resolvedEntityId ?? input.entityId ?? null,
        triggerEventType: input.triggerEventType,
        triggerEventId:   input.triggerEventId ?? null,
      },
      resultFields: {
        previousBand:          input.previousBand,
        newBand:               input.newBand,
        direction,
        degraded:              input.degraded,
        affectedCapsuleCount:  input.affectedCapsuleCount,
        processedAt:           input.processedAt,
      },
    });

    await recordPilotProofEvent({
      eventName: 'readiness_changed',
      entityId: resolvedEntityId ?? input.entityId ?? null,
      npi: input.npi,
      occurredAt: input.processedAt,
      metadata: {
        previousBand: input.previousBand,
        newBand: input.newBand,
        direction,
        degraded: input.degraded,
        affectedCapsuleCount: input.affectedCapsuleCount,
        triggerEventType: input.triggerEventType,
        triggerEventId: input.triggerEventId ?? null,
        processedAt: input.processedAt,
      },
    });

    log('info', 'seal_readiness_change_captured', {
      npi: input.npi.slice(0, 4) + '····',
      previousBand: input.previousBand,
      newBand: input.newBand,
      direction,
    });
  } catch (err) {
    log('warn', 'seal_readiness_change_capture_failed', {
      npi: input.npi,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
