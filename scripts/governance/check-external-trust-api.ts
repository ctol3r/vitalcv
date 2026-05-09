#!/usr/bin/env tsx
/**
 * check-external-trust-api.ts — W2-PR37A CI gate.
 *
 * Runs the external-trust API self-audit against a synthesized
 * (sealed ledger, snapshot, ledger) fixture. Fails CI on any non-
 * determinism, manifest round-trip failure, or receipt non-determinism.
 *
 * No external input file required — the gate is hermetic.
 */

import {
  appendEpoch,
  captureGovernanceSnapshot,
  emptyLedger,
  emptySealedLedger,
  runExternalApiSelfAudit,
  sealEpoch,
  type GovernanceEpoch,
} from "../../packages/governance-runtime/src/registry.js";

function iso(h: number): string {
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function makeEpoch(o: Partial<GovernanceEpoch> & { observedAt: string }): GovernanceEpoch {
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
  let sealed = emptySealedLedger();
  let ledger = emptyLedger();
  for (let i = 0; i < 5; i++) {
    const e = makeEpoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  const nowIso = iso(6);
  const snapshot = captureGovernanceSnapshot(sealed, nowIso);
  const report = runExternalApiSelfAudit(sealed, snapshot, ledger, nowIso);

  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-external-trust-api] determinism: ${report.determinismCheckPassed}`);
    console.log(`[check-external-trust-api] manifest round-trip: ${report.manifestRoundTripPassed}`);
    console.log(`[check-external-trust-api] receipt determinism: ${report.receiptDeterminismPassed}`);
    if (report.findings.length > 0) {
      console.log("Findings:");
      for (const f of report.findings) console.log(`  - ${f}`);
    }
    if (report.hasCiGatingCondition) {
      console.log("=== EXTERNAL TRUST API GATING ===");
      console.log("Per W2-PR37A: APIs must be deterministic + ambiguity-preserving + manifest-verifiable.");
    } else {
      console.log("[check-external-trust-api] No gating conditions.");
    }
  }
  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
