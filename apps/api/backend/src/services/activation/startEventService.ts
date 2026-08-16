/**
 * ACT-1.4 — start-state read, start-ready adapter, and cancellation.
 *
 * Every start fact is a durable audit event; the current state is derived
 * (startState.ts). Start-ready and actual-first-day WRITES are owned by the
 * canonical application-bound command (applicationStartCommandService) —
 * markStartReady here is a thin adapter that keeps the existing route
 * vocabulary, and recordStart no longer exists in this module. A start is
 * recorded only from an explicit start-ready decision by an authorized
 * employer actor; it is never inferred.
 */

import { createHash, randomUUID } from 'crypto';

import prisma from '../../graphql/prisma_client';
import type { AuditEventType } from '../../types/auditEventTypes';
import { HttpError } from '../../utils/httpError';
import { markApplicationStartReady } from './applicationStartCommandService';
import type { RequirementView } from './requirementLifecycle';
import {
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
 * Mark the application start-ready.
 *
 * Delegates to the canonical application-bound start command
 * (applicationStartCommandService), which advances StartActivation, writes the
 * START_READY audit, and enqueues the outbound event in one transaction — this
 * wrapper only translates the command's failures into this module's
 * StartActionResult vocabulary for the existing route contract. It no longer
 * writes any start fact itself; a start-ready that only existed as an audit
 * event, with the aggregate left behind, was the pre-#1384 defect.
 *
 * `recordStart` is GONE from this module: actual-first-day confirmation flows
 * only through `confirmApplicationStart` (one authoritative start command).
 */
export async function markStartReady(input: {
  applicationId: string;
  organizationId: string;
  actorId: string;
}): Promise<StartActionResult> {
  try {
    await markApplicationStartReady(input);
    return { ok: true, state: 'start_ready' };
  } catch (error) {
    if (error instanceof HttpError && error.code === 'START_REQUIREMENTS_OPEN') {
      const rows = await prisma.activationRequirement.findMany({
        where: { applicationId: input.applicationId, organizationId: input.organizationId, necessity: 'required' },
        orderBy: { createdAt: 'asc' },
      });
      const blocking: RequirementView[] = rows
        .filter((row) => !['met', 'waived', 'not_applicable'].includes(row.status))
        .map((row) => ({
          id: row.id,
          necessity: row.necessity as RequirementView['necessity'],
          status: row.status as RequirementView['status'],
        }));
      return { ok: false, reason: 'not_start_ready', blocking };
    }
    if (error instanceof HttpError && error.status === 409) {
      return { ok: false, reason: 'invalid_state', state: await getApplicationStartState(input.applicationId) };
    }
    throw error;
  }
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
