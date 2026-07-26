/**
 * ACT-1.4 — the start-ready / started / cancellation service.
 *
 * Every start fact is a durable audit event; the current state is derived
 * (startState.ts). markStartReady is gated by the ACT-1.3 readiness predicate —
 * it refuses when a required requirement is still open and names the exact
 * blockers, so "not ready" always points at an actionable requirement rather
 * than blaming the clinician. A start is recorded only from an explicit
 * start-ready decision by an authorized employer actor; it is never inferred.
 */

import { createHash, randomUUID } from 'crypto';

import prisma from '../../graphql/prisma_client';
import type { AuditEventType } from '../../types/auditEventTypes';
import { getApplicationActivation } from './activationRequirementService';
import type { RequirementView } from './requirementLifecycle';
import {
  canMarkStartReady,
  canRecordStart,
  deriveStartState,
  type StartEvent,
  type StartEventType,
  type StartState,
} from './startState';

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function writeStartEvent(
  type: StartEventType,
  applicationId: string,
  organizationId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      id: randomUUID(),
      type: type as AuditEventType,
      referenceId: applicationId,
      organizationId,
      hash: hashPayload({ type, applicationId, organizationId, metadata }),
      metadata: metadata as object,
    },
  });
}

async function loadStartEvents(applicationId: string): Promise<StartEvent[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { referenceId: applicationId, type: { in: ['START_READY', 'START_RECORDED', 'START_CANCELLED'] } },
    orderBy: { createdAt: 'asc' },
    select: { type: true, createdAt: true },
  });
  return rows.map((r) => ({ type: r.type as StartEventType, at: r.createdAt.toISOString() }));
}

export async function getApplicationStartState(applicationId: string): Promise<StartState> {
  return deriveStartState(await loadStartEvents(applicationId));
}

export type StartActionResult =
  | { ok: true; state: StartState }
  | { ok: false; reason: 'not_start_ready'; blocking: readonly RequirementView[] }
  | { ok: false; reason: 'invalid_state'; state: StartState };

/**
 * Mark the application start-ready. Refuses unless every REQUIRED activation
 * requirement is resolved (naming the blockers) and the current state permits it.
 */
export async function markStartReady(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
}): Promise<StartActionResult> {
  const state = await getApplicationStartState(input.applicationId);
  if (!canMarkStartReady(state)) return { ok: false, reason: 'invalid_state', state };

  const { readiness } = await getApplicationActivation(input.applicationId);
  if (!readiness.startReady) {
    return { ok: false, reason: 'not_start_ready', blocking: readiness.blocking };
  }

  await writeStartEvent('START_READY', input.applicationId, input.organizationId, {
    actorId: input.actorId,
    resolvedRequirementCount: readiness.blocking.length === 0 ? 'all_required_resolved' : undefined,
  });
  return { ok: true, state: 'start_ready' };
}

/** Record that the clinician actually started. Only from an explicit start-ready decision. */
export async function recordStart(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
  startedAt: string;
}): Promise<StartActionResult> {
  const state = await getApplicationStartState(input.applicationId);
  if (!canRecordStart(state)) return { ok: false, reason: 'invalid_state', state };

  await writeStartEvent('START_RECORDED', input.applicationId, input.organizationId, {
    actorId: input.actorId,
    startedAt: input.startedAt,
  });
  return { ok: true, state: 'started' };
}

/** Cancel/withdraw. Allowed from any active state; records the reason, never deletes history. */
export async function cancelStart(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
  reasonCode: string;
}): Promise<StartActionResult> {
  const state = await getApplicationStartState(input.applicationId);
  if (state === 'cancelled') return { ok: false, reason: 'invalid_state', state };

  await writeStartEvent('START_CANCELLED', input.applicationId, input.organizationId, {
    actorId: input.actorId,
    reasonCode: input.reasonCode,
    priorState: state,
  });
  return { ok: true, state: 'cancelled' };
}
