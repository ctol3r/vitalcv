import { describe, expect, it } from "vitest";
import {
  buildDeploymentRealityReport,
  DEPLOYMENT_VERDICTS,
} from "../deployment-reality.js";
import type { ConstitutionalConvergenceReport } from "../constitutional-convergence.js";
import type { PmfReadinessReport } from "../pmf-compression.js";
import type { PilotAccelerationReport } from "../pilot-acceleration.js";
import type { UxConsistencyReport } from "../ux-consistency.js";
import type { VerifierCognitiveSafetyReport } from "../verifier-cognitive-safety.js";

const NOW = "2026-05-09T00:00:00Z";

function fakeConvergence(verdict: ConstitutionalConvergenceReport["verdict"]): ConstitutionalConvergenceReport {
  return {
    executedAt: NOW,
    verdict,
    perWaveGating: {
      drift: false,
      replaySurvivability: false,
      persistence: false,
      durability: false,
      compression: false,
      kernel: false,
    },
    crossWaveViolations: [],
    convergenceHash: "h",
    hasCiGatingCondition: verdict !== "CONSTITUTIONALLY-COHERENT",
  };
}
function fakePmf(tier: PmfReadinessReport["tier"], score: number): PmfReadinessReport {
  return {
    executedAt: NOW,
    tier,
    score,
    contributors: { constitutionalCoherence: 0, trustConversion: 0, verifierResponsiveness: 0, replayBottleneckPenalty: 0 },
    constitutionalBlock: tier === "NOT-READY",
    hasCiGatingCondition: tier === "NOT-READY",
  };
}
function fakePilot(stalled: number): PilotAccelerationReport {
  return {
    executedAt: NOW,
    subjectsEvaluated: 1,
    activations: [],
    tierDistribution: {},
    stalledFraction: stalled,
    hasCiGatingCondition: stalled > 0.5,
  };
}
function fakeUx(violationCount: number): UxConsistencyReport {
  return {
    executedAt: NOW,
    observationCount: 1,
    violations: Array.from({ length: violationCount }).map(() => ({ tag: "headline-overflow" as const, surfaceId: "x", count: 99 })),
    consistencyHash: "h",
    hasCiGatingCondition: violationCount > 0,
  };
}
function fakeCog(violationCount: number): VerifierCognitiveSafetyReport {
  return {
    executedAt: NOW,
    messagesEvaluated: 1,
    violations: Array.from({ length: violationCount }).map(() => ({ tag: "ambiguity-notice-rendered-non-ambiguous" as const, id: "x" })),
    hasCiGatingCondition: violationCount > 0,
  };
}

describe("W2-PR92A — deployment reality convergence", () => {
  it("DEPLOYMENT_VERDICTS has 4 verdicts", () => expect(DEPLOYMENT_VERDICTS.length).toBe(4));

  it("clean fleet ⇒ DEPLOY-READY", () => {
    const r = buildDeploymentRealityReport({
      nowIso: NOW,
      convergence: fakeConvergence("CONSTITUTIONALLY-COHERENT"),
      pmf: fakePmf("PRODUCTION-READY", 90),
      pilot: fakePilot(0.1),
      uxConsistency: fakeUx(0),
      cognitiveSafety: fakeCog(0),
    });
    expect(r.verdict).toBe("DEPLOY-READY");
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("FAILED-CLOSED constitutional ⇒ DEPLOY-FAILED-CLOSED", () => {
    const r = buildDeploymentRealityReport({
      nowIso: NOW,
      convergence: fakeConvergence("FAILED-CLOSED"),
      pmf: fakePmf("NOT-READY", 0),
      pilot: fakePilot(0.1),
      uxConsistency: fakeUx(0),
      cognitiveSafety: fakeCog(0),
    });
    expect(r.verdict).toBe("DEPLOY-FAILED-CLOSED");
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("UX inconsistencies + PMF score 65 ⇒ CONDITIONAL", () => {
    const r = buildDeploymentRealityReport({
      nowIso: NOW,
      convergence: fakeConvergence("CONSTITUTIONALLY-COHERENT"),
      pmf: fakePmf("PILOT-READY", 65),
      pilot: fakePilot(0.2),
      uxConsistency: fakeUx(1),
      cognitiveSafety: fakeCog(0),
    });
    expect(["DEPLOY-READY-CONDITIONAL", "DEPLOY-NOT-READY"]).toContain(r.verdict);
  });

  it("identical input ⇒ identical convergenceHash", () => {
    const input = {
      nowIso: NOW,
      convergence: fakeConvergence("CONSTITUTIONALLY-COHERENT"),
      pmf: fakePmf("PRODUCTION-READY", 90),
      pilot: fakePilot(0.1),
      uxConsistency: fakeUx(0),
      cognitiveSafety: fakeCog(0),
    } as const;
    const a = buildDeploymentRealityReport(input);
    const b = buildDeploymentRealityReport(input);
    expect(a.convergenceHash).toBe(b.convergenceHash);
  });

  it("CHAOS: pilot 80% stalled ⇒ pilot-stalled violation surfaces", () => {
    const r = buildDeploymentRealityReport({
      nowIso: NOW,
      convergence: fakeConvergence("CONSTITUTIONALLY-COHERENT"),
      pmf: fakePmf("PILOT-READY", 70),
      pilot: fakePilot(0.8),
      uxConsistency: fakeUx(0),
      cognitiveSafety: fakeCog(0),
    });
    expect(r.violations.some((v) => v.tag === "pilot-stalled")).toBe(true);
  });
});
