#!/usr/bin/env tsx
/**
 * check-replay-search.ts — W2-PR76A CI gate.
 *
 * Hermetic check: builds a synthetic sealed ledger, runs index + queries
 * through the verifier. Fails CI on silent ambiguity elision or hash drift.
 */
import {
  appendEpoch,
  buildReplaySearchIndex,
  buildReplaySearchReport,
  emptyLedger,
  emptySealedLedger,
  searchReplay,
  sealEpoch,
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
  let sealed = emptySealedLedger();
  for (let i = 0; i < 4; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: i % 2 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  const idx = buildReplaySearchIndex(sealed, iso(5));
  const r1 = searchReplay(idx, {});
  const r2 = searchReplay(idx, { includeAmbiguous: false });
  const report = buildReplaySearchReport(sealed, idx, [r1, r2], iso(5));
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    console.log(`[check-replay-search] indexed=${report.entriesIndexed} violations=${report.violations.length}`);
    for (const v of report.violations) console.log(`  ${JSON.stringify(v)}`);
  }
  process.exit(report.hasCiGatingCondition ? 1 : 0);
}
main();
