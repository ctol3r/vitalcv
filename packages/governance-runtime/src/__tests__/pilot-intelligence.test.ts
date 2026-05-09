import { describe, expect, it } from "vitest";
import {
  buildPilotIntelligenceReport,
  computeEventId,
  FUNNEL_STEPS,
  validatePilotEvent,
  type PilotEvent,
} from "../pilot-intelligence.js";

function ev(o: Partial<PilotEvent> = {}): PilotEvent {
  const base = {
    subjectId: "subj-1",
    observedAt: "2026-05-09T00:00:00Z",
    step: "LANDING" as const,
    stepCompleted: true,
    abandonmentReason: null,
  };
  return {
    eventId: computeEventId(base),
    ...base,
    ...o,
  };
}

describe("W2-PR51A — taxonomy", () => {
  it("FUNNEL_STEPS has 9 stages including TRUST_TIER_ESTABLISHED", () => {
    expect(FUNNEL_STEPS.length).toBe(9);
    expect(FUNNEL_STEPS).toContain("TRUST_TIER_ESTABLISHED");
    expect(FUNNEL_STEPS).toContain("PASSPORT_ACTIVATED");
  });
});

describe("W2-PR51A — event determinism (replay-safe)", () => {
  it("identical event input ⇒ identical eventId", () => {
    const a = computeEventId({ subjectId: "x", observedAt: "2026-05-09T00:00:00Z", step: "LANDING", stepCompleted: true, abandonmentReason: null });
    const b = computeEventId({ subjectId: "x", observedAt: "2026-05-09T00:00:00Z", step: "LANDING", stepCompleted: true, abandonmentReason: null });
    expect(a).toBe(b);
  });
});

describe("W2-PR51A — validators", () => {
  it("clean event passes", () => expect(validatePilotEvent(ev())).toEqual([]));
  it("abandonment without reason → flagged", () => {
    const e = validatePilotEvent({ ...ev(), stepCompleted: false, abandonmentReason: null });
    expect(e.some((x) => x.tag === "abandonment-without-reason")).toBe(true);
  });
  it("completed with abandonment reason → flagged (contradiction)", () => {
    const e = validatePilotEvent({ ...ev(), stepCompleted: true, abandonmentReason: "OPERATOR_ABORT" });
    expect(e.some((x) => x.tag === "completed-with-abandonment-reason")).toBe(true);
  });
  it("event id tampered → event-id-mismatch", () => {
    const e = validatePilotEvent({ ...ev(), eventId: "deadbeef" });
    expect(e.some((x) => x.tag === "event-id-mismatch")).toBe(true);
  });
});

describe("W2-PR51A — analytics", () => {
  it("computes trust conversion rate", () => {
    const events: PilotEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const base = { subjectId: `s-${i}`, observedAt: "2026-05-09T00:00:00Z", step: "TRUST_TIER_ESTABLISHED" as const, stepCompleted: i < 4, abandonmentReason: i < 4 ? null : "VERIFIER_TIMEOUT" as const };
      events.push({ eventId: computeEventId(base), ...base });
    }
    const r = buildPilotIntelligenceReport(events, "2026-05-09T00:01:00Z");
    expect(r.trustConversionRate).toBeCloseTo(0.4);
  });

  it("replay bottleneck attribution per step", () => {
    const events: PilotEvent[] = [];
    for (let i = 0; i < 5; i++) {
      const base = { subjectId: `s-${i}`, observedAt: "2026-05-09T00:00:00Z", step: "FIRST_VERIFICATION_REQUEST" as const, stepCompleted: false, abandonmentReason: "REPLAY_BOTTLENECK" as const };
      events.push({ eventId: computeEventId(base), ...base });
    }
    const r = buildPilotIntelligenceReport(events, "2026-05-09T00:01:00Z");
    expect(r.replayBottleneckPerStep["FIRST_VERIFICATION_REQUEST"]).toBe(5);
  });

  it("CHAOS: invalid event → CI gating fires", () => {
    const r = buildPilotIntelligenceReport(
      [{ ...ev(), eventId: "wrong" }],
      "2026-05-09T00:01:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: empty event stream → no gating, zero conversion", () => {
    const r = buildPilotIntelligenceReport([], "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
    expect(r.trustConversionRate).toBe(0);
  });
});
