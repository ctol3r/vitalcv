/**
 * A2.1 — one scheduler tick.
 *
 * Claims a bounded batch of due subjects, plans each as `system_scheduler`,
 * records the run, and **acts on nothing**. Shadow is not a config default
 * that could drift: A2.1 has no execution path at all, and the mode is
 * recorded on every run row so a later analysis can never mistake an
 * observation run for one that was permitted to do something.
 *
 * Shape copied from `strategyAgentScheduler` — the closest precedent in the
 * codebase — rather than invented: bounded batch, per-subject isolation, and
 * an explicit `trigger` discriminator.
 *
 * Fan-out safety, all present before the first real tick:
 *  - cohort gating by explicit enrollment (a row IS the allowlist);
 *  - a kill switch through the same `getPilotSurfaceControl` that already
 *    gates the apply flow;
 *  - a bounded batch, so a tick's blast radius and runtime are predictable;
 *  - per-subject isolation — one subject's failure cannot end the tick;
 *  - dry-run by default outside production.
 */
import 'server-only';
import { assembleStartAgentContext, ContextAssemblyError } from '../context-assembler';
import {
  attachRunProjection,
  persistPlanDeltas,
  readPriorRun,
} from '../delta/delta-store';
import { diffProjections } from '../delta/diff';
import { buildDecisionProjection, decisionFingerprint } from '../delta/projection';
import { generateStartPlanV2 } from '../policy/start-policy-v2';
import { createRefreshBudget, type RefreshBudget } from '../refresh/budget';
import { planScheduledRefreshes, type RefreshPlan } from '../refresh/planner';
import { buildProductionReaders } from '../server-readers';
import { persistAgentRun } from '../telemetry/agent-run-store';
import { buildStartAgentTools } from '../tools/canonical-tools';
import { createToolRegistry } from '../tools/registry';
import {
  claimDueSubjects,
  recordSubjectFailure,
  recordSubjectSuccess,
  scheduleSummary,
  type ScheduledSubject,
} from './subject-schedule';

/** The surface id the operator kill switch uses. */
export const AGENT_TICK_SURFACE_ID = 'agent_tick';

/** Hard ceiling regardless of what a caller asks for. */
export const MAX_SUBJECTS_PER_TICK = 50;
const DEFAULT_SUBJECTS_PER_TICK = 25;

export type TickSkipReason = 'killed' | 'nothing_due';

export interface SubjectRunOutcome {
  subjectRef: string;
  ok: boolean;
  /** Present when the run produced a plan. */
  planId?: string;
  runId?: string | null;
  blockerCount?: number;
  rankedActionCount?: number;
  completeness?: 'full' | 'reduced';
  inputGaps?: string[];
  /** A2.2 — what changed since this subject's last comparable run. */
  deltaCount?: number;
  materialDeltaCount?: number;
  /**
   * A2.4 — the refreshes this subject WOULD have triggered. Planned, never
   * executed: background Level-2 execution is A2.5.
   */
  refreshesPlanned?: number;
  refreshesSkipped?: Partial<Record<string, number>>;
  /**
   * Why no comparison happened, when none did. A first run and a
   * completeness mismatch are both "we did not compare", and neither is
   * "nothing changed".
   */
  notComparable?: 'completeness_mismatch' | 'no_prior_run' | 'projection_version_mismatch';
  error?: string;
}

export interface TickResult {
  mode: 'shadow';
  dryRun: boolean;
  startedAt: string;
  elapsedMs: number;
  claimed: number;
  succeeded: number;
  failed: number;
  /** A2.2 — the number the shadow gate is actually watching. */
  materialDeltas: number;
  /**
   * A2.4 — what a live tick would have spent per source this window. The
   * "no budget breach in shadow" gate reads this.
   */
  refreshBudget: Record<string, { used: number; remaining: number; nearLimit: boolean }>;
  refreshesPlanned: number;
  skipped?: TickSkipReason;
  /** Operator-safe: subject refs are the caller's own opaque keys, no PII. */
  outcomes: SubjectRunOutcome[];
  summary: { enrolled: number; enabled: number; due: number };
}

export interface RunTickOptions {
  limit?: number;
  /**
   * Compute and report without persisting runs or advancing schedules.
   * Defaults to TRUE outside production so a stray call in a dev or preview
   * environment cannot consume real schedule slots.
   */
  dryRun?: boolean;
  now?: Date;
  /** Injected for tests. */
  deps?: Partial<TickDeps>;
}

export interface TickDeps {
  isKilled(): Promise<boolean>;
  claim(input: { limit: number; now: Date }): Promise<ScheduledSubject[]>;
  planSubject(subject: ScheduledSubject, now: Date): Promise<SubjectRunOutcome>;
  onSuccess(input: { id: string; runId: string | null; now: Date }): Promise<void>;
  onFailure(input: { id: string; error: string; now: Date }): Promise<void>;
  summary(now: Date): Promise<{ enrolled: number; enabled: number; due: number }>;
}

async function defaultIsKilled(): Promise<boolean> {
  try {
    const { getPilotSurfaceControl } = await import('@/lib/server/pilot-ops');
    const control = await getPilotSurfaceControl(AGENT_TICK_SURFACE_ID);
    return control?.mode === 'disabled' || control?.mode === 'hidden';
  } catch {
    // An unreadable control is NOT a kill: the switch exists to stop the
    // loop deliberately, and treating an ops outage as a stop would make the
    // agent silently inert in exactly the situation nobody is watching.
    // The bounded batch and shadow mode are the safety here.
    return false;
  }
}

/**
 * Plan one subject as the scheduler. Everything identity-bound is already
 * unreachable for this actor (A2.0), so the resulting plan is `reduced` and
 * is never shown to anyone — it exists to be recorded.
 */
async function defaultPlanSubject(
  subject: ScheduledSubject,
  now: Date,
  dryRun: boolean,
  budget: RefreshBudget,
): Promise<SubjectRunOutcome> {
  const readers = buildProductionReaders(subject.subjectRef, { actor: 'system_scheduler' });
  const registry = createToolRegistry(buildStartAgentTools(readers), {
    actor: 'system_scheduler',
  });

  const { context, inputGaps } = await assembleStartAgentContext({
    subject: {
      profileRef: subject.subjectRef,
      ...(subject.npi ? { npi: subject.npi } : {}),
    },
    contextClass: 'scheduled_shadow',
    now: now.toISOString(),
    registry,
  });

  const plan = generateStartPlanV2(context, { now: context.collectedAt });
  const projection = buildDecisionProjection(plan, context);

  // A2.4 — decide what a refresh would touch, against a budget SHARED across
  // every subject in this tick. A per-subject budget would let a large batch
  // hammer one source while each subject stayed politely under its own cap.
  const refresh: RefreshPlan = planScheduledRefreshes({
    context,
    now: context.collectedAt,
    budget,
  });

  // Diff against this subject's last comparable run. Computed even in a dry
  // run, because the delta rate is exactly what shadow mode exists to learn.
  const prior = await readPriorRun(subject.subjectRef);
  const outcome = diffProjections(prior?.projection ?? null, projection);

  const persistence = dryRun
    ? { persisted: false, runId: null }
    : await persistAgentRun({
        plan,
        subjectRef: subject.subjectRef,
        ...(subject.npi ? { npi: subject.npi } : {}),
        inputGaps,
        trigger: 'scheduled',
        mode: 'shadow',
      });

  if (!dryRun && persistence.runId) {
    await attachRunProjection({
      runId: persistence.runId,
      projection,
      fingerprint: decisionFingerprint(projection),
      deltaFromRunId: outcome.comparable ? (prior?.runId ?? null) : null,
    });
    if (outcome.comparable && outcome.deltas.length > 0) {
      await persistPlanDeltas({
        runId: persistence.runId,
        priorRunId: prior?.runId ?? null,
        subjectRef: subject.subjectRef,
        planId: plan.planId,
        deltas: outcome.deltas,
      });
    }
  }

  return {
    subjectRef: subject.subjectRef,
    ok: true,
    planId: plan.planId,
    runId: persistence.runId,
    blockerCount: plan.blockers.length,
    rankedActionCount: plan.rankedActionIds.length,
    completeness: plan.completeness,
    inputGaps,
    deltaCount: outcome.deltas.length,
    materialDeltaCount: outcome.materialCount,
    refreshesPlanned: refresh.planned.length,
    refreshesSkipped: refresh.skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {}),
    ...(outcome.comparable ? {} : { notComparable: outcome.reason }),
  };
}

export async function runAgentTick(options: RunTickOptions = {}): Promise<TickResult> {
  const now = options.now ?? new Date();
  const startedAt = now.toISOString();
  const startedMs = Date.now();
  const dryRun = options.dryRun ?? process.env.NODE_ENV !== 'production';
  const limit = Math.min(
    MAX_SUBJECTS_PER_TICK,
    Math.max(1, options.limit ?? DEFAULT_SUBJECTS_PER_TICK),
  );

  // One budget for the whole tick: sources are shared, so the cap must be too.
  const refreshBudget = createRefreshBudget();

  const deps: TickDeps = {
    isKilled: defaultIsKilled,
    claim: claimDueSubjects,
    planSubject: (subject, at) => defaultPlanSubject(subject, at, dryRun, refreshBudget),
    onSuccess: recordSubjectSuccess,
    onFailure: recordSubjectFailure,
    summary: scheduleSummary,
    ...options.deps,
  };

  const base = async (extra: Partial<TickResult>): Promise<TickResult> => ({
    mode: 'shadow',
    dryRun,
    startedAt,
    elapsedMs: Date.now() - startedMs,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    materialDeltas: 0,
    refreshBudget: refreshBudget.spend(),
    refreshesPlanned: 0,
    outcomes: [],
    summary: await deps.summary(now).catch(() => ({ enrolled: 0, enabled: 0, due: 0 })),
    ...extra,
  });

  if (await deps.isKilled()) {
    return base({ skipped: 'killed' });
  }

  const claimed = await deps.claim({ limit, now });
  if (claimed.length === 0) {
    return base({ skipped: 'nothing_due' });
  }

  const outcomes: SubjectRunOutcome[] = [];
  for (const subject of claimed) {
    // Per-subject isolation: one bad subject must not end the tick, because
    // a scheduled failure has nobody watching to retry it.
    try {
      const outcome = await deps.planSubject(subject, now);
      outcomes.push(outcome);
      if (!dryRun) await deps.onSuccess({ id: subject.id, runId: outcome.runId ?? null, now });
    } catch (error) {
      const detail =
        error instanceof ContextAssemblyError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      outcomes.push({ subjectRef: subject.subjectRef, ok: false, error: detail });
      if (!dryRun) await deps.onFailure({ id: subject.id, error: detail, now });
    }
  }

  return base({
    claimed: claimed.length,
    succeeded: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok).length,
    materialDeltas: outcomes.reduce((sum, o) => sum + (o.materialDeltaCount ?? 0), 0),
    refreshBudget: refreshBudget.spend(),
    refreshesPlanned: outcomes.reduce((sum, o) => sum + (o.refreshesPlanned ?? 0), 0),
    outcomes,
  });
}
