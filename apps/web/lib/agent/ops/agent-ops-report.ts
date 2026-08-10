/**
 * Agent Ops report builder — Wave L0.
 *
 * The first reader of the Start Agent telemetry. Everything that writes those
 * six tables landed in A0–A2.5; nothing has ever read them back, so this
 * module is the whole observation layer.
 *
 * Two contracts it must keep:
 *
 * 1. PURE READ. No writes, no side effects, no mutation of schedules. An
 *    observability layer that writes is a second, unaudited writer — the same
 *    reason receiptCandidate.ts and policyReview.ts are pure transforms.
 *
 * 2. IDLENESS IS LOUD (doctrine L2). `loopState` is the discriminator the UI
 *    renders on, and it deliberately distinguishes three things that all look
 *    like "HTTP 200" today:
 *      - not_enrolled  — zero subjects; the loop CANNOT run. Idle by design.
 *      - enrolled_idle — subjects exist and are due, but nothing ran. A REAL
 *                        regression, and currently invisible.
 *      - running       — scheduled runs are landing.
 *    Success and vacancy must never share a colour.
 *
 * Privacy: `subjectRef` is a Clerk user id and is itself an identifier, so it
 * never appears in this report — only counts. NPIs likewise. Single-subject
 * drill-down is deliberately out of scope for L0.
 */
import { prisma } from '@/lib/db';

export type AgentLoopState = 'not_enrolled' | 'enrolled_idle' | 'running' | 'unknown';

export interface AgentOpsCohort {
  enrolled: number;
  enabled: number;
  disabled: number;
  /** Enabled subjects whose nextDueAt is in the past — claimable right now. */
  dueNow: number;
  nextDueAt: string | null;
  /** Subjects carrying consecutive tick failures; a backoff input, not truth. */
  failing: number;
}

export interface AgentOpsActivity {
  runs24h: number;
  runs7d: number;
  byTrigger: { interactive: number; scheduled: number; event: number };
  byMode: { live: number; shadow: number };
  lastRunAt: string | null;
  /** Distinct policy versions seen in the window — a silent rollout tell. */
  policyVersions: Array<{ policyVersion: string; runs: number }>;
}

export interface AgentOpsActionRow {
  actionType: string;
  presented: number;
  accepted: number;
  dismissed: number;
  overridden: number;
  completed: number;
  failed: number;
  /** null when nothing was presented — never rendered as 0%. */
  overrideRate: number | null;
}

export interface AgentOpsAgreement {
  presented: number;
  accepted: number;
  dismissed: number;
  overridden: number;
  completed: number;
  failed: number;
  /** THE quality headline. null when nothing has been presented yet. */
  overrideRate: number | null;
  byActionType: AgentOpsActionRow[];
}

export interface AgentOpsRefusals {
  blocked: number;
  /** Actions the policy emitted already-blocked, by status. */
  byStatus: Array<{ status: string; count: number }>;
}

export interface AgentOpsDeltas {
  total: number;
  material: number;
  immaterial: number;
  byKind: Array<{ kind: string; material: boolean; count: number }>;
}

export interface AgentOpsReport {
  generatedAt: string;
  windowDays: number;
  /** The headline. See doctrine L2. */
  loopState: AgentLoopState;
  /** One honest sentence explaining loopState. Rendered verbatim. */
  loopStateDetail: string;
  cohort: AgentOpsCohort;
  activity: AgentOpsActivity;
  agreement: AgentOpsAgreement;
  refusals: AgentOpsRefusals;
  deltas: AgentOpsDeltas;
  /** True when a read failed; the report renders partial rather than 500ing. */
  degraded: boolean;
  notes: string[];
}

const WINDOW_DAYS = 7;

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Counts events of one type in the window, grouped by the action they belong
 * to. Returns a Map so the per-actionType table can be assembled without an
 * N+1 over action types.
 */
async function countEventsByAction(
  eventType: string,
  since: Date,
): Promise<{ total: number; byActionId: Map<string, number> }> {
  const rows = await prisma.agentEvent.groupBy({
    by: ['actionId'],
    where: { eventType, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const byActionId = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    total += row._count._all;
    if (row.actionId) byActionId.set(row.actionId, row._count._all);
  }
  return { total, byActionId };
}

export async function buildAgentOpsReport(
  options: { now?: Date; windowDays?: number } = {},
): Promise<AgentOpsReport> {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const notes: string[] = [];

  const empty = (): AgentOpsReport => ({
    generatedAt: now.toISOString(),
    windowDays,
    loopState: 'unknown',
    loopStateDetail: 'Agent telemetry could not be read.',
    cohort: { enrolled: 0, enabled: 0, disabled: 0, dueNow: 0, nextDueAt: null, failing: 0 },
    activity: {
      runs24h: 0,
      runs7d: 0,
      byTrigger: { interactive: 0, scheduled: 0, event: 0 },
      byMode: { live: 0, shadow: 0 },
      lastRunAt: null,
      policyVersions: [],
    },
    agreement: {
      presented: 0,
      accepted: 0,
      dismissed: 0,
      overridden: 0,
      completed: 0,
      failed: 0,
      overrideRate: null,
      byActionType: [],
    },
    refusals: { blocked: 0, byStatus: [] },
    deltas: { total: 0, material: 0, immaterial: 0, byKind: [] },
    degraded: true,
    notes,
  });

  try {
    const [
      enrolled,
      enabled,
      dueNow,
      failing,
      nextDue,
      runs24h,
      runs7d,
      triggerRows,
      modeRows,
      lastRun,
      policyRows,
      actionRows,
      presentedEv,
      acceptedEv,
      dismissedEv,
      overriddenEv,
      completedEv,
      failedEv,
      blockedEv,
      deltaRows,
    ] = await Promise.all([
      prisma.agentSubjectSchedule.count(),
      prisma.agentSubjectSchedule.count({ where: { enabled: true } }),
      prisma.agentSubjectSchedule.count({ where: { enabled: true, nextDueAt: { lte: now } } }),
      prisma.agentSubjectSchedule.count({ where: { consecutiveFailures: { gt: 0 } } }),
      prisma.agentSubjectSchedule.findFirst({
        where: { enabled: true },
        orderBy: { nextDueAt: 'asc' },
        select: { nextDueAt: true },
      }),
      prisma.agentRun.count({ where: { createdAt: { gte: since24h } } }),
      prisma.agentRun.count({ where: { createdAt: { gte: since } } }),
      prisma.agentRun.groupBy({
        by: ['trigger'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentRun.groupBy({
        by: ['mode'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentRun.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.agentRun.groupBy({
        by: ['policyVersion'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.agentRunAction.groupBy({
        by: ['actionType', 'status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      countEventsByAction('agent_action_presented', since),
      countEventsByAction('agent_action_accepted', since),
      countEventsByAction('agent_action_dismissed', since),
      countEventsByAction('agent_human_override', since),
      countEventsByAction('agent_action_completed', since),
      countEventsByAction('agent_action_failed', since),
      prisma.agentEvent.count({ where: { eventType: 'agent_action_blocked', createdAt: { gte: since } } }),
      prisma.agentPlanDelta.groupBy({
        by: ['kind', 'material'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    // Action ids are unique per run, so mapping an id back to its type needs
    // the action rows themselves. One query, then an in-memory join.
    const actionIdRows = await prisma.agentRunAction.findMany({
      where: { createdAt: { gte: since } },
      select: { actionId: true, actionType: true },
    });
    const typeByActionId = new Map<string, string>();
    for (const row of actionIdRows) typeByActionId.set(row.actionId, row.actionType);

    const tally = (byActionId: Map<string, number>): Map<string, number> => {
      const out = new Map<string, number>();
      for (const [actionId, count] of byActionId) {
        const type = typeByActionId.get(actionId);
        if (!type) continue;
        out.set(type, (out.get(type) ?? 0) + count);
      }
      return out;
    };

    const presentedByType = tally(presentedEv.byActionId);
    const acceptedByType = tally(acceptedEv.byActionId);
    const dismissedByType = tally(dismissedEv.byActionId);
    const overriddenByType = tally(overriddenEv.byActionId);
    const completedByType = tally(completedEv.byActionId);
    const failedByType = tally(failedEv.byActionId);

    const actionTypes = new Set<string>([
      ...presentedByType.keys(),
      ...acceptedByType.keys(),
      ...dismissedByType.keys(),
      ...overriddenByType.keys(),
    ]);

    const byActionType: AgentOpsActionRow[] = Array.from(actionTypes)
      .map((actionType) => {
        const presented = presentedByType.get(actionType) ?? 0;
        const overridden = overriddenByType.get(actionType) ?? 0;
        return {
          actionType,
          presented,
          accepted: acceptedByType.get(actionType) ?? 0,
          dismissed: dismissedByType.get(actionType) ?? 0,
          overridden,
          completed: completedByType.get(actionType) ?? 0,
          failed: failedByType.get(actionType) ?? 0,
          overrideRate: rate(overridden, presented),
        };
      })
      .sort((a, b) => b.presented - a.presented || a.actionType.localeCompare(b.actionType));

    const byTrigger = { interactive: 0, scheduled: 0, event: 0 };
    for (const row of triggerRows) {
      if (row.trigger === 'interactive' || row.trigger === 'scheduled' || row.trigger === 'event') {
        byTrigger[row.trigger] = row._count._all;
      }
    }

    const byMode = { live: 0, shadow: 0 };
    for (const row of modeRows) {
      if (row.mode === 'live' || row.mode === 'shadow') byMode[row.mode] = row._count._all;
    }

    const refusalStatuses = new Map<string, number>();
    for (const row of actionRows) {
      if (row.status === 'ready' || row.status === 'completed') continue;
      refusalStatuses.set(row.status, (refusalStatuses.get(row.status) ?? 0) + row._count._all);
    }

    let materialDeltas = 0;
    let immaterialDeltas = 0;
    for (const row of deltaRows) {
      if (row.material) materialDeltas += row._count._all;
      else immaterialDeltas += row._count._all;
    }

    // Doctrine L2 — the discriminator. Three states that all look like a
    // green cron today.
    let loopState: AgentLoopState;
    let loopStateDetail: string;
    if (enrolled === 0) {
      loopState = 'not_enrolled';
      loopStateDetail =
        'No subjects are enrolled, so the background loop cannot run. The hourly tick is claiming nothing and succeeding. Enrolment is a deliberate action — row existence in agent_subject_schedules is the cohort allowlist.';
    } else if (byTrigger.scheduled === 0 && dueNow > 0) {
      loopState = 'enrolled_idle';
      loopStateDetail = `${enrolled} subject(s) enrolled and ${dueNow} due now, but no scheduled run in the last ${windowDays} days. The tick is not reaching them.`;
      notes.push('enrolled_idle: subjects are due but no scheduled runs landed. Check agent-tick workflow and CRON_SECRET/PROBE_URL.');
    } else if (byTrigger.scheduled === 0) {
      loopState = 'enrolled_idle';
      loopStateDetail = `${enrolled} subject(s) enrolled but no scheduled run in the last ${windowDays} days, and none are currently due.`;
    } else {
      loopState = 'running';
      loopStateDetail = `${byTrigger.scheduled} scheduled run(s) across ${enrolled} enrolled subject(s) in the last ${windowDays} days.`;
    }

    if (byMode.live === 0 && byMode.shadow > 0) {
      notes.push('All runs in the window were shadow runs — the agent recorded everything and acted on nothing.');
    }
    if (presentedEv.total === 0 && runs7d > 0) {
      notes.push('Runs are landing but no action has been presented to a human. Override rate is unmeasurable until it is.');
    }
    if (failing > 0) {
      notes.push(`${failing} subject(s) carry consecutive tick failures.`);
    }

    return {
      generatedAt: now.toISOString(),
      windowDays,
      loopState,
      loopStateDetail,
      cohort: {
        enrolled,
        enabled,
        disabled: enrolled - enabled,
        dueNow,
        nextDueAt: isoOrNull(nextDue?.nextDueAt ?? null),
        failing,
      },
      activity: {
        runs24h,
        runs7d,
        byTrigger,
        byMode,
        lastRunAt: isoOrNull(lastRun?.createdAt ?? null),
        policyVersions: policyRows
          .map((row) => ({ policyVersion: row.policyVersion, runs: row._count._all }))
          .sort((a, b) => b.runs - a.runs),
      },
      agreement: {
        presented: presentedEv.total,
        accepted: acceptedEv.total,
        dismissed: dismissedEv.total,
        overridden: overriddenEv.total,
        completed: completedEv.total,
        failed: failedEv.total,
        overrideRate: rate(overriddenEv.total, presentedEv.total),
        byActionType,
      },
      refusals: {
        blocked: blockedEv,
        byStatus: Array.from(refusalStatuses.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
      },
      deltas: {
        total: materialDeltas + immaterialDeltas,
        material: materialDeltas,
        immaterial: immaterialDeltas,
        byKind: deltaRows
          .map((row) => ({ kind: row.kind, material: row.material, count: row._count._all }))
          .sort((a, b) => b.count - a.count),
      },
      degraded: false,
      notes,
    };
  } catch (error) {
    // Degrade rather than 500, matching agent-run-store's posture: the
    // observation layer must survive a schema/deploy window without taking
    // the admin surface down with it.
    notes.push(
      `Agent telemetry read failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return empty();
  }
}
