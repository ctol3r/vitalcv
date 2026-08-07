/**
 * Start Agent A0 — telemetry persistence against a REAL Postgres.
 *
 * Pattern follows __tests__/verifier-worklist-db.test.ts: gated on
 * DATABASE_URL (skips cleanly without one), a dedicated PrismaClient bound
 * to that URL injected as '@/lib/db', scoped cleanup in afterAll. CI runs
 * this in the web-quality DB step (see .github/workflows/ci.yml).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { stableStringify } from '@/lib/agent/ids';
import { generateStartPlan } from '@/lib/agent/policy/start-policy-v1';
import type { StartAgentContext } from '@/lib/agent/types';

const DB_URL = process.env.DATABASE_URL;
const SKIP = !DB_URL;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('../lib/generated/prisma');
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } }),
  };
});

const SUBJECT = `bench-subject-${randomUUID().slice(0, 8)}`;
const NOW = '2026-08-07T00:00:00.000Z';
const CREATED_PLAN_IDS: string[] = [];

function context(): StartAgentContext {
  return {
    subject: { profileRef: SUBJECT, npi: '1234567893' },
    identity: {
      status: 'resolved',
      evidenceRefs: [{ kind: 'source_observation', ref: 'nppes:r', provenance: 'public_source' }],
    },
    profile: { status: 'saved', missingRequiredFields: [], corrections: [], evidenceRefs: [] },
    ownership: { status: 'none', evidenceRefs: [] },
    observations: [],
    readiness: { status: 'unknown', determinedBy: 'unavailable', evidenceRefs: [] },
    opportunities: { status: 'unknown', matches: [] },
    consents: [],
    actionHistory: [],
    collectedAt: NOW,
    contextClass: 'db_test',
  };
}

describe.skipIf(SKIP)('agent telemetry persistence (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
  });

  afterAll(async () => {
    if (SKIP) return;
    // Scoped cleanup — unscoped deleteMany would race other suites.
    await prisma.agentEvent.deleteMany({ where: { subjectRef: SUBJECT } });
    await prisma.agentRun.deleteMany({ where: { subjectRef: SUBJECT } });
    if (CREATED_PLAN_IDS.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { type: 'agent.plan_generated', referenceId: { in: CREATED_PLAN_IDS } },
      });
    }
    await prisma.$disconnect();
  });

  it('persists run, per-action rows, plan event, and the paired audit row in one transaction', async () => {
    const { persistAgentRun } = await import('@/lib/agent/telemetry/agent-run-store');
    const plan = generateStartPlan(context(), { now: NOW });
    CREATED_PLAN_IDS.push(plan.planId);

    const result = await persistAgentRun({ plan, subjectRef: SUBJECT, npi: '1234567893', inputGaps: ['opportunity_retrieval'] });
    expect(result.persisted).toBe(true);
    expect(result.runId).toBeTruthy();

    const run = await prisma.agentRun.findFirst({ where: { subjectRef: SUBJECT } });
    expect(run).not.toBeNull();
    expect(run!.planId).toBe(plan.planId);
    expect(run!.policyVersion).toBe('start-policy-v1');
    expect(run!.toolsetVersion).toBe('start-toolset-v1');
    expect(run!.selectedActionId).toBe(plan.rankedActionIds[0]);
    expect(run!.inputGaps).toEqual(['opportunity_retrieval']);

    const actionRows = await prisma.agentRunAction.findMany({ where: { runId: run!.id } });
    expect(actionRows).toHaveLength(plan.actions.length);
    expect(new Set(actionRows.map((r) => r.owner)).size).toBeGreaterThan(0);

    const planEvent = await prisma.agentEvent.findFirst({
      where: { subjectRef: SUBJECT, eventType: 'agent_plan_generated' },
    });
    expect(planEvent).not.toBeNull();
    expect(planEvent!.planId).toBe(plan.planId);

    const audit = await prisma.auditEvent.findFirst({
      where: { type: 'agent.plan_generated', referenceId: plan.planId },
    });
    expect(audit).not.toBeNull();
    expect(audit!.hash).toMatch(/^[0-9a-f]{64}$/);

    // Sensitive-data minimization: stored plan JSON is the structured plan —
    // evidence refs and template text, nothing else. (stableStringify:
    // Postgres JSONB does not preserve key order.)
    expect(stableStringify(run!.blockers)).toBe(stableStringify(plan.blockers));
  });

  it('records outcome events with the forward foreign-reference pattern', async () => {
    const { recordAgentEvent } = await import('@/lib/agent/telemetry/agent-run-store');
    const plan = generateStartPlan(context(), { now: NOW });

    const result = await recordAgentEvent({
      eventType: 'agent_action_accepted',
      planId: plan.planId,
      subjectRef: SUBJECT,
      actionId: plan.rankedActionIds[0],
      owner: 'clinician',
      outcome: 'accepted',
      elapsedMs: 1234,
      related: { kind: 'application', ref: randomUUID() },
    });
    expect(result.persisted).toBe(true);

    const row = await prisma.agentEvent.findFirst({
      where: { subjectRef: SUBJECT, eventType: 'agent_action_accepted' },
    });
    expect(row).not.toBeNull();
    expect(row!.relatedKind).toBe('application');
    expect(row!.elapsedMs).toBe(1234);
    expect(row!.owner).toBe('clinician');
  });
});
