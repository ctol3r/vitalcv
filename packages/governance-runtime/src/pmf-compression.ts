/**
 * Institutional PMF compression convergence (W2-PR82A).
 *
 * Pure scoring layer that takes a constitutional convergence verdict +
 * pilot intelligence + verifier workspace stats and projects them into
 * one PMF-readiness score. This is a measurement, not a marketing claim.
 *
 * Lexicon-aligned: PMF-readiness reads as "operationally ready for
 * pilot under audit-traceable conditions."
 */

import type { ConstitutionalConvergenceReport } from "./constitutional-convergence.js";
import type { PilotIntelligenceReport } from "./pilot-intelligence.js";
import type { VerifierWorkspaceReport } from "./verifier-workspace.js";

export const PMF_TIERS = ["NOT-READY", "PILOT-READY-CONDITIONAL", "PILOT-READY", "PRODUCTION-READY"] as const;
export type PmfTier = (typeof PMF_TIERS)[number];

export interface PmfReadinessReport {
  readonly executedAt: string;
  readonly tier: PmfTier;
  readonly score: number; // 0..100
  readonly contributors: {
    readonly constitutionalCoherence: number;
    readonly trustConversion: number;
    readonly verifierResponsiveness: number;
    readonly replayBottleneckPenalty: number;
  };
  /** True when constitutional verdict is FAILED-CLOSED. */
  readonly constitutionalBlock: boolean;
  readonly hasCiGatingCondition: boolean;
}

export function buildPmfReadinessReport(
  convergence: ConstitutionalConvergenceReport,
  pilot: PilotIntelligenceReport,
  workspace: VerifierWorkspaceReport,
  nowIso: string,
): PmfReadinessReport {
  // Constitutional coherence weight
  const coherence = (() => {
    switch (convergence.verdict) {
      case "CONSTITUTIONALLY-COHERENT": return 40;
      case "DEGRADED-BUT-COHERENT": return 25;
      case "INCOHERENT": return 5;
      case "FAILED-CLOSED": return 0;
    }
  })();

  // Trust conversion weight (max 25)
  const trustConversion = Math.round(pilot.trustConversionRate * 25);

  // Verifier responsiveness: penalty for P0 aging
  const p0Aging = workspace.findings.filter((f) => f.tag === "p0-aging").length;
  const verifierResp = Math.max(0, 20 - p0Aging * 5);

  // Replay bottleneck penalty
  const totalBottleneck = Object.values(pilot.replayBottleneckPerStep).reduce((a, b) => a + (b ?? 0), 0);
  const bottleneckPenalty = Math.min(15, totalBottleneck * 2);

  let score = coherence + trustConversion + verifierResp - bottleneckPenalty;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let tier: PmfTier;
  if (convergence.verdict === "FAILED-CLOSED") tier = "NOT-READY";
  else if (score >= 80 && convergence.verdict === "CONSTITUTIONALLY-COHERENT") tier = "PRODUCTION-READY";
  else if (score >= 60) tier = "PILOT-READY";
  else if (score >= 40) tier = "PILOT-READY-CONDITIONAL";
  else tier = "NOT-READY";

  return Object.freeze({
    executedAt: nowIso,
    tier,
    score,
    contributors: Object.freeze({
      constitutionalCoherence: coherence,
      trustConversion,
      verifierResponsiveness: verifierResp,
      replayBottleneckPenalty: bottleneckPenalty,
    }),
    constitutionalBlock: convergence.verdict === "FAILED-CLOSED",
    hasCiGatingCondition: tier === "NOT-READY",
  });
}
