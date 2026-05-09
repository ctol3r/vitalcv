/**
 * W2-PR37A — External trust API tests + chaos.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import {
  EXTERNAL_TRUST_API_VERSION,
  buildAuditReceipt,
  buildExternalLineageManifest,
  exportGovernanceState,
  exportReplayVerification,
  runExternalApiSelfAudit,
  validateExternalEnvelope,
  verifyExternalLineageManifest,
  wrapResponse,
} from "../external-trust-api.js";
import {
  captureGovernanceSnapshot,
  emptySealedLedger,
  sealEpoch,
  type SealedGovernanceLedger,
} from "../tamper-evident-persistence.js";

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
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function makeFleet(): { sealed: SealedGovernanceLedger; ledger: GovernanceLedger } {
  let sealed = emptySealedLedger();
  let ledger = emptyLedger();
  for (let i = 0; i < 5; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: 1 });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  return { sealed, ledger };
}

describe("W2-PR37A — envelope + version", () => {
  it("EXTERNAL_TRUST_API_VERSION is v1", () => {
    expect(EXTERNAL_TRUST_API_VERSION).toBe("v1");
  });
  it("wrapResponse produces deterministic bodyCanonicalHash", () => {
    const e1 = wrapResponse({ a: 1, b: 2 }, "req-1", iso(0));
    const e2 = wrapResponse({ b: 2, a: 1 }, "req-1", iso(0));
    expect(e1.bodyCanonicalHash).toBe(e2.bodyCanonicalHash);
  });
  it("validateExternalEnvelope detects body-vs-hash divergence", () => {
    const env = wrapResponse({ a: 1 }, "r-1", iso(0));
    const tampered = { ...env, body: { a: 2 } };
    const errs = validateExternalEnvelope(tampered);
    expect(errs.some((e) => e.tag === "envelope-hash-mismatch")).toBe(true);
  });
  it("validateExternalEnvelope rejects wrong api version", () => {
    const env = { apiVersion: "v0", requestId: "x", emittedAt: iso(0), bodyCanonicalHash: "x", body: {} };
    // @ts-expect-error — adversarial
    const errs = validateExternalEnvelope(env);
    expect(errs.some((e) => e.tag === "wrong-api-version")).toBe(true);
  });
});

describe("W2-PR37A — audit receipt determinism (replay-safety)", () => {
  it("identical input → identical receiptId", () => {
    const r1 = buildAuditReceipt({ subjectId: "s1", subjectKind: "k1", observedAt: iso(0), metadata: { x: 1 } });
    const r2 = buildAuditReceipt({ subjectId: "s1", subjectKind: "k1", observedAt: iso(0), metadata: { x: 1 } });
    expect(r1.receiptId).toBe(r2.receiptId);
  });
  it("metadata key-order does not change receiptId (canonicalization)", () => {
    const r1 = buildAuditReceipt({ subjectId: "s1", subjectKind: "k1", observedAt: iso(0), metadata: { a: 1, b: 2 } });
    const r2 = buildAuditReceipt({ subjectId: "s1", subjectKind: "k1", observedAt: iso(0), metadata: { b: 2, a: 1 } });
    expect(r1.receiptId).toBe(r2.receiptId);
  });
  it("changing metadata changes receiptId", () => {
    const r1 = buildAuditReceipt({ subjectId: "s", subjectKind: "k", observedAt: iso(0), metadata: { x: 1 } });
    const r2 = buildAuditReceipt({ subjectId: "s", subjectKind: "k", observedAt: iso(0), metadata: { x: 2 } });
    expect(r1.receiptId).not.toBe(r2.receiptId);
  });
});

describe("W2-PR37A — external lineage manifest round-trip", () => {
  it("clean round-trip yields no mismatches", () => {
    const { sealed } = makeFleet();
    const snap = captureGovernanceSnapshot(sealed, iso(6));
    const mf = buildExternalLineageManifest(sealed, snap);
    expect(verifyExternalLineageManifest(mf, sealed)).toEqual([]);
  });
  it("ledger truncation surfaces", () => {
    const { sealed } = makeFleet();
    const snap = captureGovernanceSnapshot(sealed, iso(6));
    const mf = buildExternalLineageManifest(sealed, snap);
    const truncated: SealedGovernanceLedger = { sealed: sealed.sealed.slice(0, 3) };
    const mismatches = verifyExternalLineageManifest(mf, truncated);
    expect(mismatches.length).toBeGreaterThan(0);
  });
  it("manifest direct mutation surfaces (manifestHash recomputed)", () => {
    const { sealed } = makeFleet();
    const snap = captureGovernanceSnapshot(sealed, iso(6));
    const mf = buildExternalLineageManifest(sealed, snap);
    const tampered = { ...mf, ledgerLength: mf.ledgerLength + 99 };
    expect(verifyExternalLineageManifest(tampered, sealed).some((m) => m.includes("manifestHash"))).toBe(true);
  });
});

describe("W2-PR37A — replay verification export", () => {
  it("exports survivability fields aligned with internal report", () => {
    const { ledger } = makeFleet();
    const r = exportReplayVerification(ledger, iso(6));
    expect(r.windowEpochs).toBe(5);
    expect(r.evidenceBearingEpochs).toBe(5);
    expect(r.confidence).toBe("FULL");
    expect(r.ambiguityPreserved).toBe(true);
  });
});

describe("W2-PR37A — TARGET 6: external trust chaos", () => {
  it("CHAOS: snapshot rolled back vs manifest is detected", () => {
    const { sealed } = makeFleet();
    const snap1 = captureGovernanceSnapshot(sealed, iso(6));
    const mf = buildExternalLineageManifest(sealed, snap1);
    // Create a divergent sealed ledger (rebuilt with one mutated epoch)
    let rebuilt = emptySealedLedger();
    for (let i = 0; i < 5; i++) {
      rebuilt = sealEpoch(
        rebuilt,
        epoch({ observedAt: iso(i), replayAmbiguousCount: i === 2 ? 99 : 1 }),
      );
    }
    expect(verifyExternalLineageManifest(mf, rebuilt).length).toBeGreaterThan(0);
  });
  it("CHAOS: same requestId twice yields identical bodyCanonicalHash (replay-safety)", () => {
    const e1 = wrapResponse({ x: 1 }, "req-99", iso(0));
    const e2 = wrapResponse({ x: 1 }, "req-99", iso(0));
    expect(e1.bodyCanonicalHash).toBe(e2.bodyCanonicalHash);
  });
  it("CHAOS: API self-audit detects deterministic builds", () => {
    const { sealed, ledger } = makeFleet();
    const snap = captureGovernanceSnapshot(sealed, iso(6));
    const audit = runExternalApiSelfAudit(sealed, snap, ledger, iso(6));
    expect(audit.determinismCheckPassed).toBe(true);
    expect(audit.manifestRoundTripPassed).toBe(true);
    expect(audit.receiptDeterminismPassed).toBe(true);
    expect(audit.hasCiGatingCondition).toBe(false);
  });
  it("exportGovernanceState carries audit-traceable trustLabel (lexicon-safe)", () => {
    const { sealed } = makeFleet();
    const snap = captureGovernanceSnapshot(sealed, iso(6));
    const exp = exportGovernanceState(snap);
    expect(exp.trustLabel).toMatch(/audit-traceable/);
  });
});
