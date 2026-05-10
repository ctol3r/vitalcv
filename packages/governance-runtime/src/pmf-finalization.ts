/**
 * Institutional PMF finalization convergence (W2-PR122A).
 *
 * Highest-level synthesis: composes productionization (W2-PR112A),
 * reputation (W2-PR121A), and burnout (W2-PR119A) into a final
 * PMF-finalization verdict for institutional adoption.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { ProductionizationReport } from "./productionization-convergence.js";
import type { TrustReputationReport } from "./trust-reputation.js";
import type { BurnoutProtectionReport } from "./operator-burnout.js";

export const PMF_FINALIZATION_VERDICTS = [
  "PMF-FINALIZED",
  "PMF-FINALIZED-CONDITIONAL",
  "PMF-NOT-FINALIZED",
  "PMF-FAILED-CLOSED",
] as const;
export type PmfFinalizationVerdict = (typeof PMF_FINALIZATION_VERDICTS)[number];

export type PmfFinalizationViolation =
  | { readonly tag: "production-failed-closed" }
  | { readonly tag: "operator-burnout-detected"; readonly burntOutCount: number }
  | { readonly tag: "reputation-degraded"; readonly subjects: readonly string[] }
  | { readonly tag: "ambiguity-elided-in-reputation"; readonly subjects: readonly string[] };

export interface PmfFinalizationReport {
  readonly executedAt: string;
  readonly verdict: PmfFinalizationVerdict;
  readonly score: number;
  readonly violations: readonly PmfFinalizationViolation[];
  readonly convergenceHash: string;
  readonly hasCiGatingCondition: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function buildPmfFinalizationReport(input: {
  readonly nowIso: string;
  readonly productionization: ProductionizationReport;
  readonly reputation: TrustReputationReport;
  readonly burnout: BurnoutProtectionReport;
}): PmfFinalizationReport {
  const violations: PmfFinalizationViolation[] = [];

  if (input.productionization.verdict === "PRODUCTION-FAILED-CLOSED") {
    violations.push({ tag: "production-failed-closed" });
  }
  if (input.burnout.burntOutCount > 0) {
    violations.push({ tag: "operator-burnout-detected", burntOutCount: input.burnout.burntOutCount });
  }
  const degradedSubjects = input.reputation.reputations.filter((r) => r.tier === "DEGRADED").map((r) => r.subjectId);
  if (degradedSubjects.length > 0) {
    violations.push({ tag: "reputation-degraded", subjects: degradedSubjects });
  }
  const ambigElided = input.reputation.reputations.filter((r) => !r.ambiguityPreserved).map((r) => r.subjectId);
  if (ambigElided.length > 0) {
    violations.push({ tag: "ambiguity-elided-in-reputation", subjects: ambigElided });
  }

  // Score: productionization score baseline, with reputation + burnout penalties
  let score = input.productionization.score;
  if (degradedSubjects.length > 0) score -= 15 * degradedSubjects.length;
  if (input.burnout.burntOutCount > 0) score -= 10 * input.burnout.burntOutCount;
  if (ambigElided.length > 0) score -= 20;
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  let verdict: PmfFinalizationVerdict;
  if (input.productionization.verdict === "PRODUCTION-FAILED-CLOSED") {
    verdict = "PMF-FAILED-CLOSED";
  } else if (
    violations.length === 0 &&
    score >= 80 &&
    input.productionization.verdict === "PRODUCTION-READY"
  ) {
    verdict = "PMF-FINALIZED";
  } else if (violations.length <= 1 && score >= 50) {
    verdict = "PMF-FINALIZED-CONDITIONAL";
  } else {
    verdict = "PMF-NOT-FINALIZED";
  }

  const convergenceHash = sha256Hex(canonicalize({
    productionizationVerdict: input.productionization.verdict,
    productionizationHash: input.productionization.convergenceHash,
    reputationGating: input.reputation.hasCiGatingCondition,
    burntOutCount: input.burnout.burntOutCount,
    verdict,
    score,
  }));

  return Object.freeze({
    executedAt: input.nowIso,
    verdict,
    score,
    violations: Object.freeze(violations),
    convergenceHash,
    hasCiGatingCondition: verdict === "PMF-FAILED-CLOSED" || verdict === "PMF-NOT-FINALIZED",
  });
}
