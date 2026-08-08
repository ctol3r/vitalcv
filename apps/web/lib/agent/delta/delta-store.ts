/**
 * A2.2 — delta persistence and prior-run lookup.
 *
 * Deltas are rows rather than derived-on-read because the learning loop has
 * to ask, months later, "what did we notice, and did anything come of it?"
 * That question cannot be answered by recomputing against today's state.
 *
 * Lifecycle reuses the existing `AgentEvent` vocabulary
 * (`agent_plan_superseded`) rather than growing a parallel event system.
 */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/db';
import { recordAgentEvent } from '../telemetry/agent-run-store';
import type { PlanDelta } from './diff';
import type { DecisionProjection } from './projection';

export interface PriorRun {
  runId: string;
  projection: DecisionProjection;
}

/**
 * The most recent run for a subject that carries a projection.
 *
 * Runs written before A2.2 have none; they are skipped rather than treated
 * as an empty projection, because "we have no record of the previous state"
 * and "the previous state was empty" are different claims and only one of
 * them is true.
 */
export async function readPriorRun(subjectRef: string): Promise<PriorRun | null> {
  try {
    const row = await prisma.agentRun.findFirst({
      // Prisma models a JSON column's "is set" filter via DbNull; runs
      // written before A2.2 have none and are skipped rather than treated as
      // an empty projection — "no record of the previous state" and "the
      // previous state was empty" are different claims.
      where: { subjectRef, NOT: { decisionProjection: { equals: Prisma.DbNull } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, decisionProjection: true },
    });
    if (!row?.decisionProjection) return null;
    return { runId: row.id, projection: row.decisionProjection as unknown as DecisionProjection };
  } catch {
    return null;
  }
}

export interface PersistDeltasInput {
  runId: string;
  priorRunId: string | null;
  subjectRef: string;
  planId: string;
  deltas: PlanDelta[];
}

/**
 * Write the deltas for one run and, when any of them are material, record
 * that the prior plan has been superseded.
 *
 * Best-effort like the rest of telemetry: a delta we failed to store is a
 * lost observation, not a correctness problem, and it must never fail the
 * tick that produced it.
 */
export async function persistPlanDeltas(
  input: PersistDeltasInput,
): Promise<{ persisted: boolean; count: number }> {
  if (input.deltas.length === 0) return { persisted: true, count: 0 };
  try {
    await prisma.agentPlanDelta.createMany({
      data: input.deltas.map((delta) => ({
        id: randomUUID(),
        runId: input.runId,
        priorRunId: input.priorRunId,
        subjectRef: input.subjectRef,
        planId: input.planId,
        kind: delta.kind,
        material: delta.material,
        owner: delta.owner ?? null,
        ref: delta.ref,
        detail: delta.detail,
      })),
    });

    const materialCount = input.deltas.filter((d) => d.material).length;
    if (materialCount > 0) {
      await recordAgentEvent({
        eventType: 'agent_plan_superseded',
        planId: input.planId,
        subjectRef: input.subjectRef,
        runId: input.runId,
        outcome: 'material_change',
        metadata: {
          materialCount,
          totalDeltas: input.deltas.length,
          kinds: [...new Set(input.deltas.filter((d) => d.material).map((d) => d.kind))].sort(),
          ...(input.priorRunId ? { priorRunId: input.priorRunId } : {}),
        },
      });
    }
    return { persisted: true, count: input.deltas.length };
  } catch {
    return { persisted: false, count: 0 };
  }
}

/**
 * Attach the projection and the prior-run link to a run row after the fact.
 *
 * Separate from `persistAgentRun` on purpose: the diff needs the run to
 * exist (so deltas can reference it) before it can record what that run was
 * compared against.
 */
export async function attachRunProjection(input: {
  runId: string;
  projection: DecisionProjection;
  fingerprint: string;
  deltaFromRunId: string | null;
}): Promise<{ persisted: boolean }> {
  try {
    await prisma.agentRun.update({
      where: { id: input.runId },
      data: {
        decisionProjection: JSON.parse(JSON.stringify(input.projection)),
        decisionFingerprint: input.fingerprint,
        deltaFromRunId: input.deltaFromRunId,
      },
    });
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}

/** Operator/learning view: delta counts by kind over a window. */
export async function deltaRateSummary(input: {
  since: Date;
}): Promise<{ total: number; material: number; byKind: Record<string, number> }> {
  try {
    const rows = await prisma.agentPlanDelta.findMany({
      where: { createdAt: { gte: input.since } },
      select: { kind: true, material: true },
    });
    const byKind: Record<string, number> = {};
    for (const row of rows) byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    return {
      total: rows.length,
      material: rows.filter((r) => r.material).length,
      byKind,
    };
  } catch {
    return { total: 0, material: 0, byKind: {} };
  }
}
