/**
 * cognitiveFrictionAnalytics.ts — Cognitive Friction Measurement
 *
 * Tracks and quantifies friction in institutional trust workflows.
 * "Friction" = any point where an operator must interpret ambiguity,
 * escalate a decision, or pause to gather more information.
 *
 * All friction is MEASURED and SURFACED — never silently absorbed.
 * Fail-closed: when friction cannot be measured, the score is 0 (maximum friction).
 */

import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FrictionEventKind =
  | 'decision_point'      // operator reached a fork in the workflow
  | 'escalation'          // decision routed to a higher-authority queue
  | 'ambiguity_encounter' // operator saw an ambiguous state
  | 'data_gap'            // required evidence was missing
  | 'retry'               // operator repeated an action after failure
  | 'timeout'             // action not completed within expected window;

export interface FrictionEvent {
  eventId: string;
  kind: FrictionEventKind;
  workflowIntent: string;
  entityId: string;
  actorId: string;
  occurredAt: string;
  durationMs: number | null;
  resolved: boolean;
  resolutionMs: number | null;
  /** Description of what caused the friction — never a banned string */
  description: string;
}

export interface FrictionSessionSummary {
  sessionId: string;
  entityId: string;
  actorId: string;
  startedAt: string;
  closedAt: string | null;
  events: FrictionEvent[];
  frictionScore: number;   // 0–100: 0 = maximum friction, 100 = frictionless
  escalationRate: number;  // 0–1
  ambiguityRate: number;   // 0–1
  dataGapRate: number;     // 0–1
  avgResolutionMs: number | null;
}

export interface FrictionBenchmark {
  baselineScore: number;
  currentScore: number;
  deltaScore: number; // positive = improvement (less friction)
  measuredAt: string;
  sessionCount: number;
}

// ── In-memory friction store (production would use the audit ledger) ───────────

const activeSessions = new Map<string, {
  sessionId: string;
  entityId: string;
  actorId: string;
  startedAt: string;
  events: FrictionEvent[];
}>();

// ── Scoring logic ──────────────────────────────────────────────────────────────

const FRICTION_WEIGHTS: Record<FrictionEventKind, number> = {
  decision_point: 1,
  escalation: 4,
  ambiguity_encounter: 3,
  data_gap: 5,
  retry: 6,
  timeout: 8,
};

const MAX_FRICTION_PER_EVENT = 8; // timeout weight

function computeFrictionScore(events: FrictionEvent[]): number {
  if (events.length === 0) return 100; // no events = frictionless

  const totalWeight = events.reduce((sum, e) => sum + FRICTION_WEIGHTS[e.kind], 0);
  const maxPossible = events.length * MAX_FRICTION_PER_EVENT;
  const frictionRatio = totalWeight / maxPossible; // 0 = no friction, 1 = max friction
  return Math.round((1 - frictionRatio) * 100);
}

function computeRate(events: FrictionEvent[], kind: FrictionEventKind): number {
  if (events.length === 0) return 0;
  return events.filter(e => e.kind === kind).length / events.length;
}

function computeAvgResolutionMs(events: FrictionEvent[]): number | null {
  const resolved = events.filter(e => e.resolved && e.resolutionMs !== null);
  if (resolved.length === 0) return null;
  const total = resolved.reduce((sum, e) => sum + (e.resolutionMs ?? 0), 0);
  return Math.round(total / resolved.length);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Open a new friction tracking session for a workflow interaction. */
export function openFrictionSession(
  entityId: string,
  actorId: string,
): string {
  const sessionId = `friction-${entityId}-${Date.now()}`;
  activeSessions.set(sessionId, {
    sessionId,
    entityId,
    actorId,
    startedAt: new Date().toISOString(),
    events: [],
  });
  return sessionId;
}

/** Record a friction event within an open session. */
export function recordFrictionEvent(
  sessionId: string,
  kind: FrictionEventKind,
  opts: {
    workflowIntent: string;
    description: string;
    durationMs?: number;
    resolved?: boolean;
    resolutionMs?: number;
  },
): FrictionEvent | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    log('warn', 'cognitiveFrictionAnalytics: session not found', { sessionId });
    return null;
  }

  const event: FrictionEvent = {
    eventId: `fe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    workflowIntent: opts.workflowIntent,
    entityId: session.entityId,
    actorId: session.actorId,
    occurredAt: new Date().toISOString(),
    durationMs: opts.durationMs ?? null,
    resolved: opts.resolved ?? false,
    resolutionMs: opts.resolutionMs ?? null,
    description: opts.description,
  };

  session.events.push(event);
  return event;
}

/** Close a session and compute its friction summary. */
export function closeFrictionSession(sessionId: string): FrictionSessionSummary | null {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  const summary: FrictionSessionSummary = {
    sessionId: session.sessionId,
    entityId: session.entityId,
    actorId: session.actorId,
    startedAt: session.startedAt,
    closedAt: new Date().toISOString(),
    events: session.events,
    frictionScore: computeFrictionScore(session.events),
    escalationRate: computeRate(session.events, 'escalation'),
    ambiguityRate: computeRate(session.events, 'ambiguity_encounter'),
    dataGapRate: computeRate(session.events, 'data_gap'),
    avgResolutionMs: computeAvgResolutionMs(session.events),
  };

  activeSessions.delete(sessionId);

  log('info', 'cognitiveFrictionAnalytics: session closed', {
    sessionId,
    frictionScore: summary.frictionScore,
    eventCount: summary.events.length,
  });

  return summary;
}

/** Compute a benchmark delta between a historical baseline and recent sessions. */
export function computeFrictionBenchmark(
  baseline: number,
  recentSummaries: FrictionSessionSummary[],
): FrictionBenchmark {
  if (recentSummaries.length === 0) {
    return {
      baselineScore: baseline,
      currentScore: baseline,
      deltaScore: 0,
      measuredAt: new Date().toISOString(),
      sessionCount: 0,
    };
  }

  const avgCurrent =
    recentSummaries.reduce((sum, s) => sum + s.frictionScore, 0) / recentSummaries.length;

  return {
    baselineScore: baseline,
    currentScore: Math.round(avgCurrent),
    deltaScore: Math.round(avgCurrent - baseline),
    measuredAt: new Date().toISOString(),
    sessionCount: recentSummaries.length,
  };
}
