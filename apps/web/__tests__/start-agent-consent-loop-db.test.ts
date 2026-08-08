/**
 * A1 — the whole consented-execution loop against a REAL consent ledger.
 *
 * Everything canonical is faked (no network), but the ledger, the scope
 * derivation, the plan regeneration, and the execution gates are the real
 * code paths:
 *
 *   plan → action shown → clinician approves the ACTION → server derives the
 *   scope → ledger grant → plan regenerated → ledger re-read → execute →
 *   completion
 *
 * and the counter-case that matters most:
 *
 *   grant → revoke → execution attempt → blocked, nothing sent.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { assembleStartAgentContext } from '@/lib/agent/context-assembler';
import { authorizeConsentForAction } from '@/lib/agent/consent/authorize';
import { executeAgentAction } from '@/lib/agent/execution/execute-action';
import { generateStartPlanV2 } from '@/lib/agent/policy/start-policy-v2';
import { buildStartAgentTools, type CanonicalReaders } from '@/lib/agent/tools/canonical-tools';
import { createToolRegistry } from '@/lib/agent/tools/registry';
import type { StartPlan } from '@/lib/agent/types';

const DB_URL = process.env.DATABASE_URL;
const SKIP = !DB_URL;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('../lib/generated/prisma');
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } }),
  };
});

const SUBJECT = `loop-subject-${randomUUID().slice(0, 8)}`;
const NPI = '1234567893';
const OPPORTUNITY = 'opp-42';
const EXPECTED_SCOPE = `share_packet:opportunity:${OPPORTUNITY}`;
const NOW = '2026-08-07T00:00:00.000Z';

const shareExecutor = vi.fn();

describe.skipIf(SKIP)('consented execution loop (real ledger)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/agent/consent/consent-store');

  /** Rebuild context + plan the way the routes do, over the REAL ledger. */
  async function currentPlan(): Promise<{ plan: StartPlan; context: Awaited<ReturnType<typeof assembleStartAgentContext>>['context']; registry: ReturnType<typeof createToolRegistry> }> {
    const readers: CanonicalReaders = {
      readNppesIdentity: async () => ({ found: true, retrievedAt: NOW }),
      readOwnershipState: async () => ({ state: 'verified' }),
      readProfileCompleteness: async () => ({ score: 100, missingFields: [] }),
      readSourceCoverage: async () => [],
      readOpportunities: async () => ({ opportunityRefs: [OPPORTUNITY] }),
      readAgentConsents: async (subjectRef) => store.readAgentConsentStates(subjectRef),
      readActionHistory: async () => [],
      triggerSourceRefresh: async () => ({ requested: true }),
      executeApplyShare: shareExecutor as CanonicalReaders['executeApplyShare'],
    };
    const registry = createToolRegistry(buildStartAgentTools(readers));
    const { context } = await assembleStartAgentContext({
      subject: { profileRef: SUBJECT, npi: NPI },
      contextClass: 'consent_loop',
      now: NOW,
      registry,
    });
    return { plan: generateStartPlanV2(context, { now: NOW }), context, registry };
  }

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/agent/consent/consent-store');
  });

  beforeEach(() => {
    shareExecutor.mockReset();
    shareExecutor.mockResolvedValue({
      shareId: 'share-77',
      recipientName: 'Mercy Health',
      status: 'delivered',
      sharedAt: NOW,
    });
  });

  afterAll(async () => {
    if (SKIP) return;
    const events = await prisma.agentConsentEvent.findMany({ where: { subjectRef: SUBJECT } });
    await prisma.auditEvent.deleteMany({ where: { referenceId: { in: events.map((e) => e.id) } } });
    await prisma.agentConsentEvent.deleteMany({ where: { subjectRef: SUBJECT } });
    await prisma.agentEvent.deleteMany({ where: { subjectRef: SUBJECT } });
    await prisma.$disconnect();
  });

  it('runs the full loop: approve an action, derive the scope, execute', async () => {
    // 1. Plan. The matched opportunity makes a share worth asking about, and
    //    the ungranted ledger leaves it waiting on the clinician.
    const first = await currentPlan();
    const shown = first.plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    expect(shown.permission).toBe('execute_with_consent');
    expect(shown.status).toBe('awaiting_consent');
    expect(shown.consentScope).toBe(EXPECTED_SCOPE);

    // 2. Execution before approval is refused, and nothing is sent.
    const premature = await executeAgentAction(
      { plan: first.plan, context: first.context, actionId: shown.id, subjectRef: SUBJECT },
      { registry: first.registry, nowIso: () => NOW, recordEvent: async () => ({ persisted: true }) },
    );
    expect(premature.executed).toBe(false);
    expect(premature.refusal?.code).toBe('consent_not_granted');
    expect(shareExecutor).not.toHaveBeenCalled();

    // 3. The clinician approves THE ACTION. The server derives the scope.
    const authorization = authorizeConsentForAction(first.plan, shown.id);
    expect(authorization.ok).toBe(true);
    const derivedScope = authorization.ok ? authorization.scope : null;
    expect(derivedScope).toBe(EXPECTED_SCOPE);

    const grant = await store.grantAgentConsent({
      subjectRef: SUBJECT,
      scope: derivedScope!,
      actionId: shown.id,
      planId: first.plan.planId,
    });
    expect(grant).toMatchObject({ persisted: true, changed: true, seq: 1 });

    // 4. Plan regenerated from canonical state + the ledger: the approved
    //    work is now executable, and the action id is unchanged, which is
    //    what lets the approval refer to it.
    const second = await currentPlan();
    const approved = second.plan.actions.find((a) => a.id === shown.id)!;
    expect(approved.status).toBe('ready');
    expect(second.plan.rankedActionIds).toContain(shown.id);

    // 5. Execute. The proof is minted by re-reading the ledger here.
    const events: string[] = [];
    const executed = await executeAgentAction(
      { plan: second.plan, context: second.context, actionId: shown.id, subjectRef: SUBJECT },
      {
        registry: second.registry,
        nowIso: () => NOW,
        recordEvent: async (event) => {
          events.push(event.eventType);
          return { persisted: true };
        },
      },
    );
    expect(executed.executed).toBe(true);
    expect(executed.consentId).toBe(grant.eventId);
    expect(shareExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ npi: NPI, opportunityRef: OPPORTUNITY }),
    );
    // Acceptance, then completion. Presentation is the view layer's to record.
    expect(events).toEqual(['agent_action_accepted', 'agent_action_completed']);
  });

  it('grant → revoke → execution attempt → blocked, nothing sent', async () => {
    const before = await currentPlan();
    const share = before.plan.actions.find((a) => a.type === 'prepare_share_packet')!;
    // Consent from the previous test is still on the ledger.
    expect(share.status).toBe('ready');

    const revoke = await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: EXPECTED_SCOPE });
    expect(revoke).toMatchObject({ persisted: true, changed: true, seq: 2 });

    // The plan the clinician is holding still shows it as executable — the
    // ledger read at execution time is what stops it.
    const events: string[] = [];
    const attempt = await executeAgentAction(
      { plan: before.plan, context: before.context, actionId: share.id, subjectRef: SUBJECT },
      {
        registry: before.registry,
        nowIso: () => NOW,
        recordEvent: async (event) => {
          events.push(event.eventType);
          return { persisted: true };
        },
      },
    );
    expect(attempt.executed).toBe(false);
    expect(attempt.refusal?.code).toBe('consent_not_granted');
    expect(shareExecutor).not.toHaveBeenCalled();
    expect(events).toEqual(['agent_action_accepted', 'agent_action_blocked']);

    // And a freshly regenerated plan reflects the withdrawal.
    const after = await currentPlan();
    const waiting = after.plan.actions.find((a) => a.id === share.id)!;
    expect(waiting.status).toBe('awaiting_consent');
  });
});
