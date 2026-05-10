/**
 * Institutional pilot compression engine (W2-PR86A).
 *
 * Pure scoring layer over PilotEvent + onboarding-step metadata. Tracks
 * time-to-first-value (TTFV) per subject + verifier-activation latency.
 * Replay-safe: identical input ⇒ identical scores.
 */

import type { PilotEvent, FunnelStep } from "./pilot-intelligence.js";

export const ACTIVATION_TIERS = ["INSTANT", "FAST", "STANDARD", "SLOW", "STALLED"] as const;
export type ActivationTier = (typeof ACTIVATION_TIERS)[number];

export interface SubjectActivation {
  readonly subjectId: string;
  /** ms from LANDING to PASSPORT_ACTIVATED, or null if not reached. */
  readonly timeToActivationMs: number | null;
  /** ms from PASSPORT_ACTIVATED to FIRST_VERIFICATION_REQUEST, or null. */
  readonly timeToFirstVerificationMs: number | null;
  readonly tier: ActivationTier;
  readonly stalledAtStep: FunnelStep | null;
}

const TIER_THRESHOLDS_MS: readonly { readonly tier: ActivationTier; readonly maxMs: number }[] = Object.freeze([
  { tier: "INSTANT", maxMs: 60 * 1000 }, // < 1 min
  { tier: "FAST", maxMs: 15 * 60 * 1000 }, // < 15 min
  { tier: "STANDARD", maxMs: 24 * 60 * 60 * 1000 }, // < 24h
  { tier: "SLOW", maxMs: 7 * 24 * 60 * 60 * 1000 }, // < 7d
]);

function tierFromMs(ms: number | null): ActivationTier {
  if (ms === null) return "STALLED";
  for (const { tier, maxMs } of TIER_THRESHOLDS_MS) {
    if (ms <= maxMs) return tier;
  }
  return "STALLED";
}

export function deriveSubjectActivations(
  events: readonly PilotEvent[],
): readonly SubjectActivation[] {
  // Group events by subject
  const bySubject = new Map<string, PilotEvent[]>();
  for (const e of events) {
    const arr = bySubject.get(e.subjectId) ?? [];
    arr.push(e);
    bySubject.set(e.subjectId, arr);
  }
  const out: SubjectActivation[] = [];
  for (const [subjectId, evts] of bySubject) {
    const sorted = [...evts].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const landing = sorted.find((e) => e.step === "LANDING");
    const activated = sorted.find((e) => e.step === "PASSPORT_ACTIVATED" && e.stepCompleted);
    const firstVerif = sorted.find((e) => e.step === "FIRST_VERIFICATION_REQUEST" && e.stepCompleted);
    const ttaMs =
      landing && activated
        ? Date.parse(activated.observedAt) - Date.parse(landing.observedAt)
        : null;
    const ttfvMs =
      activated && firstVerif
        ? Date.parse(firstVerif.observedAt) - Date.parse(activated.observedAt)
        : null;
    // Stalled-at-step: last completed step where the subject did not advance
    let stalledAt: FunnelStep | null = null;
    const abandoned = sorted.find((e) => !e.stepCompleted);
    if (abandoned) stalledAt = abandoned.step;
    out.push(Object.freeze({
      subjectId,
      timeToActivationMs: ttaMs,
      timeToFirstVerificationMs: ttfvMs,
      tier: tierFromMs(ttaMs),
      stalledAtStep: stalledAt,
    }));
  }
  return Object.freeze(out);
}

export interface PilotAccelerationReport {
  readonly executedAt: string;
  readonly subjectsEvaluated: number;
  readonly activations: readonly SubjectActivation[];
  readonly tierDistribution: Readonly<Partial<Record<ActivationTier, number>>>;
  readonly stalledFraction: number;
  readonly hasCiGatingCondition: boolean;
}

export function buildPilotAccelerationReport(
  events: readonly PilotEvent[],
  nowIso: string,
  options: { readonly maxStalledFraction?: number } = {},
): PilotAccelerationReport {
  const maxStalled = options.maxStalledFraction ?? 0.5;
  const activations = deriveSubjectActivations(events);
  const tierDistribution: Partial<Record<ActivationTier, number>> = {};
  let stalled = 0;
  for (const a of activations) {
    tierDistribution[a.tier] = (tierDistribution[a.tier] ?? 0) + 1;
    if (a.tier === "STALLED") stalled += 1;
  }
  const stalledFraction = activations.length === 0 ? 0 : stalled / activations.length;
  return Object.freeze({
    executedAt: nowIso,
    subjectsEvaluated: activations.length,
    activations,
    tierDistribution: Object.freeze(tierDistribution),
    stalledFraction,
    hasCiGatingCondition: stalledFraction > maxStalled,
  });
}
