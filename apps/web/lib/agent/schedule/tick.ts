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
import { generateStartPlanV2 } from '../policy/start-policy-v2';
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

  return {
    subjectRef: subject.subjectRef,
    ok: true,
    planId: plan.planId,
    runId: persistence.runId,
    blockerCount: plan.blockers.length,
    rankedActionCount: plan.rankedActionIds.length,
    completeness: plan.completeness,
    inputGaps,
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

  const deps: TickDeps = {
    isKilled: defaultIsKilled,
    claim: claimDueSubjects,
    planSubject: (subject, at) => defaultPlanSubject(subject, at, dryRun),
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
    outcomes,
  });
}
