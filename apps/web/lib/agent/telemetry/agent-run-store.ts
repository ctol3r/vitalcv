/**
 * Durable Start Agent telemetry writer.
 *
 * Pattern follows lib/leads/pilotLeadPersistence.ts: app-side uuids, a single
 * prisma.$transaction pairing the telemetry rows with an AuditEvent append
 * (audit-first rule; type `agent.plan_generated`), and a catch that degrades
 * to `{ persisted: false }` so plan generation survives the deploy window
 * before the migration lands. Telemetry failure never fails the plan.
 *
 * Privacy: the persisted plan JSON carries evidence REFS and agent-authored
 * template text only — the StartPlan type cannot hold raw credential values,
 * and nothing outside the plan/context summary enters this writer.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { stableStringify } from '../ids';
import type { StartPlan } from '../types';
import type { AgentEventType, AgentRelatedKind } from './events';

export interface PersistAgentRunInput {
  plan: StartPlan;
  /** Opaque subject key — in the A0 route this is the Clerk user id. */
  subjectRef: string;
  npi?: string;
  inputGaps: string[];
}

export interface PersistAgentRunResult {
  persisted: boolean;
  runId: string | null;
}

export async function persistAgentRun(input: PersistAgentRunInput): Promise<PersistAgentRunResult> {
  const runId = randomUUID();
  const { plan } = input;
  const hash = createHash('sha256')
    .update(stableStringify({ planId: plan.planId, fingerprint: plan.contextFingerprint, subjectRef: input.subjectRef }))
    .digest('hex');
  const selectedActionId = plan.rankedActionIds[0] ?? null;

  try {
    await prisma.$transaction([
      prisma.agentRun.create({
        data: {
          id: runId,
          planId: plan.planId,
          subjectRef: input.subjectRef,
          npi: input.npi ?? null,
          contextClass: plan.contextClass,
          contextFingerprint: plan.contextFingerprint,
          policyVersion: plan.policyVersion,
          toolsetVersion: plan.toolsetVersion,
          modelVersion: plan.modelVersion ?? null,
          blockers: JSON.parse(JSON.stringify(plan.blockers)),
          candidateActions: JSON.parse(JSON.stringify(plan.actions)),
          rankedActionIds: plan.rankedActionIds,
          selectedActionId,
          inputGaps: input.inputGaps,
          generatedAt: new Date(plan.generatedAt),
        },
      }),
      prisma.agentRunAction.createMany({
        data: plan.actions.map((action) => ({
          id: randomUUID(),
          runId,
          actionId: action.id,
          actionType: action.type,
          owner: action.owner,
          permission: action.permission,
          status: action.status,
          priority: action.priority,
          rankTier: action.rankTier,
        })),
      }),
      prisma.agentEvent.create({
        data: {
          id: randomUUID(),
          runId,
          planId: plan.planId,
          subjectRef: input.subjectRef,
          actionId: selectedActionId,
          eventType: 'agent_plan_generated',
          metadata: {
            policyVersion: plan.policyVersion,
            blockerCount: plan.blockers.length,
            actionCount: plan.actions.length,
            inputGaps: input.inputGaps,
          },
        },
      }),
      prisma.auditEvent.create({
        data: {
          id: randomUUID(),
          type: 'agent.plan_generated',
          hash,
          referenceId: plan.planId,
          metadata: {
            runId,
            policyVersion: plan.policyVersion,
            toolsetVersion: plan.toolsetVersion,
            blockerCount: plan.blockers.length,
            actionCount: plan.actions.length,
          },
        },
      }),
    ]);
    return { persisted: true, runId };
  } catch {
    return { persisted: false, runId: null };
  }
}

/**
 * Record that a recommendation was actually SHOWN to the clinician.
 *
 * This is a view-layer fact and the only writer of `agent_action_presented`.
 * It is deliberately separate from execution: an action appearing in a
 * generated plan is not a presentation, and a presentation is not an
 * acceptance. Keeping the three distinct is what lets the funnel measure
 * whether a recommendation was any good — `presented → accepted → completed`
 * only carries signal if each step is recorded when it actually happens.
 *
 * No UI calls this yet (A1 ships no agent surface); it exists so the view
 * layer has one correct way in, rather than reaching for the execution path.
 */
export async function recordActionPresented(input: {
  planId: string;
  subjectRef: string;
  actionId: string;
  owner?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ persisted: boolean }> {
  return recordAgentEvent({
    eventType: 'agent_action_presented',
    planId: input.planId,
    subjectRef: input.subjectRef,
    actionId: input.actionId,
    ...(input.owner ? { owner: input.owner } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
}

export interface AgentActionHistoryRow {
  actionId: string;
  actionType: string;
  outcome: 'completed' | 'failed' | 'dismissed';
  at: string;
  failureCount?: number;
}

const HISTORY_EVENT_OUTCOME: Record<string, AgentActionHistoryRow['outcome']> = {
  agent_action_completed: 'completed',
  agent_action_failed: 'failed',
  agent_action_dismissed: 'dismissed',
};

/**
 * Fold recent outcome events into per-action history: the latest event per
 * actionId governs the outcome; failureCount is the total failed count for
 * that action. Rows without a `metadata.actionType` (written before A1) are
 * skipped — an untyped entry cannot drive suppression honestly.
 */
export async function readAgentActionHistory(
  subjectRef: string,
  limit = 500,
): Promise<AgentActionHistoryRow[]> {
  try {
    const rows = await prisma.agentEvent.findMany({
      where: { subjectRef, eventType: { in: Object.keys(HISTORY_EVENT_OUTCOME) } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    const latest = new Map<string, AgentActionHistoryRow>();
    const failures = new Map<string, number>();
    for (const row of rows) {
      if (!row.actionId) continue;
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const actionType = typeof metadata.actionType === 'string' ? metadata.actionType : null;
      if (!actionType) continue;
      if (row.eventType === 'agent_action_failed') {
        failures.set(row.actionId, (failures.get(row.actionId) ?? 0) + 1);
      }
      if (!latest.has(row.actionId)) {
        latest.set(row.actionId, {
          actionId: row.actionId,
          actionType,
          outcome: HISTORY_EVENT_OUTCOME[row.eventType],
          at: row.createdAt.toISOString(),
        });
      }
    }
    return [...latest.values()]
      .map((entry) => ({
        ...entry,
        ...(failures.has(entry.actionId) ? { failureCount: failures.get(entry.actionId) } : {}),
      }))
      .sort((a, b) => (a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0));
  } catch {
    return [];
  }
}

export interface RecordAgentEventInput {
  eventType: AgentEventType;
  planId: string;
  subjectRef: string;
  runId?: string;
  actionId?: string;
  owner?: string;
  outcome?: string;
  elapsedMs?: number;
  related?: { kind: AgentRelatedKind; ref: string };
  metadata?: Record<string, unknown>;
}

export async function recordAgentEvent(input: RecordAgentEventInput): Promise<{ persisted: boolean }> {
  try {
    await prisma.agentEvent.create({
      data: {
        id: randomUUID(),
        runId: input.runId ?? null,
        planId: input.planId,
        subjectRef: input.subjectRef,
        actionId: input.actionId ?? null,
        eventType: input.eventType,
        owner: input.owner ?? null,
        outcome: input.outcome ?? null,
        elapsedMs: input.elapsedMs ?? null,
        relatedKind: input.related?.kind ?? null,
        relatedRef: input.related?.ref ?? null,
        metadata: JSON.parse(JSON.stringify(input.metadata ?? {})),
      },
    });
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}
