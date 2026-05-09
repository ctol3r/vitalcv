/**
 * Customer telemetry + pilot intelligence (W2-PR51A).
 *
 * Pure data model + analytics over funnel events. Each event carries a
 * deterministic eventId (hash of canonical payload) so re-emission is
 * idempotent (replay-safe). Ambiguity is preserved: an unknown step or
 * unmappable outcome surfaces as `UNKNOWN`, never silently dropped.
 *
 * Lexicon-aligned: telemetry is "audit-traceable observation", not a
 * marketing-grade conversion claim.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

// ---------------------------------------------------------------------------
// Funnel taxonomy
// ---------------------------------------------------------------------------

export const FUNNEL_STEPS = [
  "LANDING",
  "SIGNUP_INITIATED",
  "SIGNUP_COMPLETED",
  "IDENTITY_CLAIM_INITIATED",
  "IDENTITY_VERIFIED",
  "PASSPORT_ACTIVATED",
  "FIRST_VERIFICATION_REQUEST",
  "FIRST_VERIFIER_REVIEW",
  "TRUST_TIER_ESTABLISHED",
] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const ABANDONMENT_REASONS = [
  "SESSION_TIMEOUT",
  "OPERATOR_ABORT",
  "VERIFIER_TIMEOUT",
  "REPLAY_BOTTLENECK",
  "AMBIGUITY_HOLD",
  "UNKNOWN",
] as const;
export type AbandonmentReason = (typeof ABANDONMENT_REASONS)[number];

// ---------------------------------------------------------------------------
// Event record
// ---------------------------------------------------------------------------

export interface PilotEvent {
  readonly eventId: string;
  readonly subjectId: string; // anonymous session/account id
  readonly observedAt: string;
  readonly step: FunnelStep;
  /** True if the user successfully advanced past this step. */
  readonly stepCompleted: boolean;
  /** Set when stepCompleted=false. */
  readonly abandonmentReason?: AbandonmentReason | null;
  /** Optional cross-link to a replay survivability finding. */
  readonly replayConfidenceTag?: "FULL" | "HIGH" | "PARTIAL" | "LOW" | "UNRECONSTRUCTABLE" | null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Compute the deterministic event id from canonical payload.
 * Re-emission of the same logical event ⇒ identical eventId (idempotent).
 */
export function computeEventId(input: {
  readonly subjectId: string;
  readonly observedAt: string;
  readonly step: FunnelStep;
  readonly stepCompleted: boolean;
  readonly abandonmentReason: AbandonmentReason | null;
}): string {
  return sha256Hex(canonicalize(input));
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export type EventValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof PilotEvent }
  | { readonly tag: "unknown-step"; readonly value: string }
  | { readonly tag: "unknown-abandonment-reason"; readonly value: string }
  | { readonly tag: "abandonment-without-reason" }
  | { readonly tag: "completed-with-abandonment-reason" }
  | { readonly tag: "event-id-mismatch"; readonly recorded: string; readonly recomputed: string };

export function validatePilotEvent(e: Partial<PilotEvent>): readonly EventValidationError[] {
  const errors: EventValidationError[] = [];
  for (const f of ["eventId", "subjectId", "observedAt", "step", "stepCompleted"] as const) {
    if (e[f] === undefined || e[f] === null || e[f] === "") {
      errors.push({ tag: "missing-field", field: f });
    }
  }
  if (e.step && !(FUNNEL_STEPS as readonly string[]).includes(e.step)) {
    errors.push({ tag: "unknown-step", value: String(e.step) });
  }
  if (e.abandonmentReason && !(ABANDONMENT_REASONS as readonly string[]).includes(e.abandonmentReason)) {
    errors.push({ tag: "unknown-abandonment-reason", value: String(e.abandonmentReason) });
  }
  if (e.stepCompleted === false && !e.abandonmentReason) {
    errors.push({ tag: "abandonment-without-reason" });
  }
  if (e.stepCompleted === true && e.abandonmentReason) {
    errors.push({ tag: "completed-with-abandonment-reason" });
  }
  if (
    typeof e.subjectId === "string" &&
    typeof e.observedAt === "string" &&
    typeof e.step === "string" &&
    typeof e.stepCompleted === "boolean" &&
    typeof e.eventId === "string"
  ) {
    const recomputed = computeEventId({
      subjectId: e.subjectId,
      observedAt: e.observedAt,
      step: e.step as FunnelStep,
      stepCompleted: e.stepCompleted,
      abandonmentReason: (e.abandonmentReason ?? null) as AbandonmentReason | null,
    });
    if (recomputed !== e.eventId) {
      errors.push({ tag: "event-id-mismatch", recorded: e.eventId, recomputed });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface FunnelStepStats {
  readonly step: FunnelStep;
  readonly entered: number;
  readonly completed: number;
  readonly abandoned: number;
  readonly conversionRate: number; // 0..1
  readonly abandonmentBreakdown: Readonly<Partial<Record<AbandonmentReason, number>>>;
}

export interface PilotIntelligenceReport {
  readonly executedAt: string;
  readonly eventsEvaluated: number;
  readonly perStep: readonly FunnelStepStats[];
  /** Top-line conversion: subjects who reached TRUST_TIER_ESTABLISHED / total distinct subjects. */
  readonly trustConversionRate: number;
  /** Step → number of subjects whose abandonment was tagged REPLAY_BOTTLENECK. */
  readonly replayBottleneckPerStep: Readonly<Partial<Record<FunnelStep, number>>>;
  readonly findings: readonly {
    readonly tag: "validation-error";
    readonly eventId: string;
    readonly error: EventValidationError;
  }[];
  readonly hasCiGatingCondition: boolean;
}

export function buildPilotIntelligenceReport(
  events: readonly PilotEvent[],
  nowIso: string,
): PilotIntelligenceReport {
  const findings: PilotIntelligenceReport["findings"][number][] = [];
  let gating = false;
  for (const e of events) {
    for (const err of validatePilotEvent(e)) {
      findings.push({ tag: "validation-error", eventId: e.eventId, error: err });
      gating = true;
    }
  }

  interface MutableStepStats {
    step: FunnelStep;
    entered: number;
    completed: number;
    abandoned: number;
    conversionRate: number;
    abandonmentBreakdown: Partial<Record<AbandonmentReason, number>>;
  }
  const perStepMap = new Map<FunnelStep, MutableStepStats>();
  for (const step of FUNNEL_STEPS) {
    perStepMap.set(step, {
      step,
      entered: 0,
      completed: 0,
      abandoned: 0,
      conversionRate: 0,
      abandonmentBreakdown: {},
    });
  }

  const replayBottleneck: Partial<Record<FunnelStep, number>> = {};
  const reachedTrustTier = new Set<string>();
  const allSubjects = new Set<string>();

  for (const e of events) {
    if (!(FUNNEL_STEPS as readonly string[]).includes(e.step)) continue;
    allSubjects.add(e.subjectId);
    const stats = perStepMap.get(e.step)!;
    stats.entered += 1;
    if (e.stepCompleted) stats.completed += 1;
    else {
      stats.abandoned += 1;
      const reason = (e.abandonmentReason ?? "UNKNOWN") as AbandonmentReason;
      stats.abandonmentBreakdown[reason] = (stats.abandonmentBreakdown[reason] ?? 0) + 1;
      if (reason === "REPLAY_BOTTLENECK") {
        replayBottleneck[e.step] = (replayBottleneck[e.step] ?? 0) + 1;
      }
    }
    if (e.step === "TRUST_TIER_ESTABLISHED" && e.stepCompleted) {
      reachedTrustTier.add(e.subjectId);
    }
  }

  const perStep = [...perStepMap.values()].map((s) =>
    Object.freeze({
      ...s,
      conversionRate: s.entered === 0 ? 0 : s.completed / s.entered,
      abandonmentBreakdown: Object.freeze(s.abandonmentBreakdown),
    }),
  );

  const trustConversionRate =
    allSubjects.size === 0 ? 0 : reachedTrustTier.size / allSubjects.size;

  return Object.freeze({
    executedAt: nowIso,
    eventsEvaluated: events.length,
    perStep: Object.freeze(perStep),
    trustConversionRate,
    replayBottleneckPerStep: Object.freeze(replayBottleneck),
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
