/**
 * W2-PR72A — Constitutional convergence tests.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import {
  buildArchivalEnvelope,
  ARCHIVAL_SCHEMA_VERSION,
  type ArchivedEpochEnvelope,
} from "../evidence-durability.js";
import {
  buildEvidenceSummary,
  type EvidenceSummary,
} from "../evidence-compression.js";
import {
  captureGovernanceSnapshot,
  emptySealedLedger,
  sealEpoch,
  type SealedGovernanceLedger,
} from "../tamper-evident-persistence.js";
import {
  CONSTITUTIONAL_VERDICTS,
  synthesizeConstitutionalIntegrity,
  type ConstitutionalConvergenceInput,
} from "../constitutional-convergence.js";
import { captureLiveKernel } from "../kernel-freeze.js";

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
function iso(h: number): string {
  return new Date(Date.parse("2026-05-09T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildScenario(eps: GovernanceEpoch[]): {
  ledger: GovernanceLedger;
  sealed: SealedGovernanceLedger;
  archive: ArchivedEpochEnvelope[];
  summary: EvidenceSummary;
} {
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  const archive: ArchivedEpochEnvelope[] = [];
  for (const e of eps) {
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
  const summary = buildEvidenceSummary({
    windowFromIso: eps[0]?.observedAt ?? iso(0),
    windowToIso: eps[eps.length - 1]?.observedAt ?? iso(0),
    windowEpochs: eps.length,
    envelopes: archive,
  });
  return { ledger, sealed, archive, summary };
}

function baseInput(eps: GovernanceEpoch[]): ConstitutionalConvergenceInput {
  const { ledger, sealed, archive, summary } = buildScenario(eps);
  const snapshot = captureGovernanceSnapshot(sealed, iso(eps.length));
  return {
    nowIso: iso(eps.length),
    ledger,
    sealed,
    snapshot,
    archive,
    compressedSummary: summary,
    overrides: [],
    incidents: [],
    kernelBaseline: captureLiveKernel(),
  };
}

describe("W2-PR72A — verdict + determinism", () => {
  it("CONSTITUTIONAL_VERDICTS has 4 tiers", () => {
    expect(CONSTITUTIONAL_VERDICTS.length).toBe(4);
    expect(CONSTITUTIONAL_VERDICTS).toContain("FAILED-CLOSED");
  });

  it("clean fleet ⇒ CONSTITUTIONALLY-COHERENT", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const r = synthesizeConstitutionalIntegrity(baseInput(eps));
    expect(r.verdict).toBe("CONSTITUTIONALLY-COHERENT");
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("identical input ⇒ identical convergenceHash (deterministic)", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const a = synthesizeConstitutionalIntegrity(baseInput(eps));
    const b = synthesizeConstitutionalIntegrity(baseInput(eps));
    expect(a.convergenceHash).toBe(b.convergenceHash);
  });
});

describe("W2-PR72A — cross-wave invariants", () => {
  it("missing snapshot for non-empty archive ⇒ violation flagged", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const input = baseInput(eps);
    const noSnap: ConstitutionalConvergenceInput = { ...input, snapshot: null };
    const r = synthesizeConstitutionalIntegrity(noSnap);
    expect(r.crossWaveViolations.some((v) => v.tag === "snapshot-missing-but-archive-non-empty")).toBe(true);
    expect(r.verdict).toBe("FAILED-CLOSED");
  });

  it("kernel drifted ⇒ kernel-drifted violation + FAILED-CLOSED", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 1 }));
    const input = baseInput(eps);
    const live = captureLiveKernel();
    const drifted = { ...live, replayStates: [...live.replayStates, "GHOST" as never] };
    const r = synthesizeConstitutionalIntegrity({ ...input, kernelBaseline: drifted });
    expect(r.crossWaveViolations.some((v) => v.tag === "kernel-drifted")).toBe(true);
    expect(r.verdict).toBe("FAILED-CLOSED");
  });

  it("forged ambiguity-zero summary ⇒ ambiguity-elided-system-wide flagged", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 5 }));
    const input = baseInput(eps);
    const tampered: EvidenceSummary = { ...input.compressedSummary!, totalReplayAmbiguous: 0 };
    const r = synthesizeConstitutionalIntegrity({ ...input, compressedSummary: tampered });
    expect(
      r.crossWaveViolations.some(
        (v) => v.tag === "ambiguity-elided-system-wide" && v.layer === "summary",
      ),
    ).toBe(true);
  });

  it("CHAOS: replay-count disagreement between ledger and summary fires", () => {
    const eps = Array.from({ length: 3 }).map((_, i) => epoch({ observedAt: iso(i), replayAmbiguousCount: 5 }));
    const input = baseInput(eps);
    // Forge a summary that says totalReplayAmbiguous = 3 (real is 15) — this
    // also fires summary-hash-mismatch via compression gate, but the cross-
    // wave layer should flag the disagreement directly.
    const forged: EvidenceSummary = {
      ...input.compressedSummary!,
      totalReplayAmbiguous: 3,
    };
    const r = synthesizeConstitutionalIntegrity({ ...input, compressedSummary: forged });
    expect(
      r.crossWaveViolations.some((v) => v.tag === "replay-counts-disagree"),
    ).toBe(true);
  });
});

describe("W2-PR72A — verdict cascading", () => {
  it("UNRECONSTRUCTABLE replay alone ⇒ DEGRADED-BUT-COHERENT (or stronger)", () => {
    const eps = Array.from({ length: 12 }).map((_, i) => epoch({ observedAt: iso(i) }));
    const r = synthesizeConstitutionalIntegrity(baseInput(eps));
    expect(["DEGRADED-BUT-COHERENT", "INCOHERENT", "FAILED-CLOSED"]).toContain(r.verdict);
    expect(r.hasCiGatingCondition).toBe(true);
  });
});
