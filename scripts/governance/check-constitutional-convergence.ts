#!/usr/bin/env tsx
/**
 * check-constitutional-convergence.ts — W2-PR72A CI gate.
 *
 * Hermetic synthesis check: builds a small synthetic ledger + archive +
 * snapshot from a fresh in-memory state, runs synthesizeConstitutional-
 * Integrity, asserts CONSTITUTIONALLY-COHERENT verdict. Fails CI if the
 * synthesis layer itself is non-deterministic or the cross-wave
 * invariants regress.
 */

import {
  appendEpoch,
  ARCHIVAL_SCHEMA_VERSION,
  buildArchivalEnvelope,
  buildEvidenceSummary,
  captureGovernanceSnapshot,
  captureLiveKernel,
  emptyLedger,
  emptySealedLedger,
  sealEpoch,
  synthesizeConstitutionalIntegrity,
  type GovernanceEpoch,
  type ArchivedEpochEnvelope,
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
  const archive: ArchivedEpochEnvelope[] = [];
  for (let i = 0; i < 3; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
    archive.push(
      buildArchivalEnvelope({
        archivedAt: e.observedAt,
        originalPayload: e as unknown as Readonly<Record<string, unknown>>,
        originalSchemaVersion: ARCHIVAL_SCHEMA_VERSION,
        currentPayload: e,
        migrationLineage: [],
      }),
    );
  }
  const nowIso = iso(4);
  const snapshot = captureGovernanceSnapshot(sealed, nowIso);
  const summary = buildEvidenceSummary({
    windowFromIso: iso(0),
    windowToIso: iso(2),
    windowEpochs: 3,
    envelopes: archive,
  });
  const r1 = synthesizeConstitutionalIntegrity({
    nowIso,
    ledger,
    sealed,
    snapshot,
    archive,
    compressedSummary: summary,
    overrides: [],
    incidents: [],
    kernelBaseline: captureLiveKernel(),
  });
  const r2 = synthesizeConstitutionalIntegrity({
    nowIso,
    ledger,
    sealed,
    snapshot,
    archive,
    compressedSummary: summary,
    overrides: [],
    incidents: [],
    kernelBaseline: captureLiveKernel(),
  });

  const determinismOk = r1.convergenceHash === r2.convergenceHash;
  const verdictOk = r1.verdict === "CONSTITUTIONALLY-COHERENT";

  if (json) {
    process.stdout.write(JSON.stringify({
      verdict: r1.verdict,
      convergenceHash: r1.convergenceHash,
      determinismOk,
      verdictOk,
      perWaveGating: r1.perWaveGating,
      crossWaveViolations: r1.crossWaveViolations,
      hasCiGatingCondition: !determinismOk || !verdictOk,
    }, null, 2) + "\n");
  } else {
    console.log(`[check-constitutional-convergence] verdict: ${r1.verdict}`);
    console.log(`[check-constitutional-convergence] convergenceHash: ${r1.convergenceHash}`);
    console.log(`[check-constitutional-convergence] determinism: ${determinismOk}`);
    console.log(`[check-constitutional-convergence] verdictOk: ${verdictOk}`);
    if (!determinismOk || !verdictOk) {
      console.log("=== CONSTITUTIONAL CONVERGENCE GATING ===");
      console.log("Per W2-PR72A: synthesis layer must be deterministic + coherent on hermetic input.");
    } else {
      console.log("[check-constitutional-convergence] coherent.");
    }
  }
  process.exit(!determinismOk || !verdictOk ? 1 : 0);
}

main();
