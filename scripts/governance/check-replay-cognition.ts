#!/usr/bin/env tsx
/**
 * check-replay-cognition.ts — W2-PR73A CI gate.
 *
 * Hermetic check: builds a synthetic replay-survivability report and
 * runs all 4 abstraction levels through validateOperatorReplayDigest.
 * Fails CI on any cognition violation.
 */
import {
  appendEpoch,
  buildOperatorReplayDigest,
  buildReplaySurvivabilityReport,
  emptyLedger,
  REPLAY_ABSTRACTION_LEVELS,
  validateOperatorReplayDigest,
  type GovernanceEpoch,
} from "../../packages/governance-runtime/src/registry.js";

function iso(h: number): string {
  return new Date(Date.parse("2026-05-09T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function epoch(o: Partial<GovernanceEpoch> & { observedAt: string }): GovernanceEpoch {
  return {
    activeOverrideCount: 0,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 0,
    replayCollapsedCount: 0,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
    ...o,
  };
}

function main(): void {
  const json = process.argv.includes("--json");
  let ledger = emptyLedger();
  for (let i = 0; i < 3; i++) ledger = appendEpoch(ledger, epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
  const src = buildReplaySurvivabilityReport(ledger, iso(4));
  const violations: { level: string; v: unknown }[] = [];
  for (const level of REPLAY_ABSTRACTION_LEVELS) {
    const d = buildOperatorReplayDigest(src, level);
    for (const v of validateOperatorReplayDigest(d, src)) {
      violations.push({ level, v });
    }
  }
  if (json) {
    process.stdout.write(JSON.stringify({ violations, hasCiGatingCondition: violations.length > 0 }, null, 2) + "\n");
  } else {
    console.log(`[check-replay-cognition] levels checked: ${REPLAY_ABSTRACTION_LEVELS.length} violations: ${violations.length}`);
    for (const v of violations) console.log(`  ${JSON.stringify(v)}`);
  }
  process.exit(violations.length > 0 ? 1 : 0);
}
main();
