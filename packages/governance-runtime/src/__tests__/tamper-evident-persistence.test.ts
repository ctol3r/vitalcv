/**
 * W2-PR32A — Tamper-evident governance persistence + adversarial chaos.
 */

import { describe, expect, it } from "vitest";

import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../longitudinal-memory.js";
import {
  GENESIS_HASH,
  buildPersistenceIntegrityReport,
  canonicalize,
  captureGovernanceSnapshot,
  computeEpochHash,
  emptySealedLedger,
  replayVerifyLedger,
  sealEpoch,
  sealLedger,
  unsealLedger,
  verifySealedChain,
  verifySnapshot,
  type SealedGovernanceLedger,
  type SealedGovernanceEpoch,
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
  return new Date(Date.parse("2026-01-01T00:00:00Z") + h * 3600 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function buildLedger(eps: GovernanceEpoch[]): GovernanceLedger {
  return eps.reduce((l, e) => appendEpoch(l, e), emptyLedger());
}

function buildSealedLedger(eps: GovernanceEpoch[]): SealedGovernanceLedger {
  return sealLedger(buildLedger(eps));
}

describe("W2-PR32A — TARGET 1: hash-linked epochs", () => {
  it("canonicalize is deterministic regardless of key order", () => {
    const a = { a: 1, b: 2, c: 3 };
    const b = { c: 3, a: 1, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("canonicalize handles nested arrays/objects deterministically", () => {
    const a = { x: [{ a: 1, b: 2 }, { c: 3 }] };
    const b = { x: [{ b: 2, a: 1 }, { c: 3 }] };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("canonicalize rejects non-finite numbers (no quiet NaN/Infinity)", () => {
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("genesis epoch links to GENESIS_HASH sentinel", () => {
    const sealed = sealEpoch(emptySealedLedger(), epoch({ observedAt: iso(0) }));
    expect(sealed.sealed[0]!.previousEpochHash).toBe(GENESIS_HASH);
    expect(sealed.sealed[0]!.epochHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.sealed[0]!.sequenceIndex).toBe(0);
  });

  it("each subsequent epoch's previousEpochHash equals prior epochHash", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
    ]);
    for (let i = 1; i < sealed.sealed.length; i++) {
      expect(sealed.sealed[i]!.previousEpochHash).toBe(sealed.sealed[i - 1]!.epochHash);
    }
  });

  it("computeEpochHash is deterministic given identical input", () => {
    const e = epoch({ observedAt: iso(0), activeOverrideCount: 3 });
    const h1 = computeEpochHash(e, GENESIS_HASH);
    const h2 = computeEpochHash(e, GENESIS_HASH);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changing any field changes the epoch hash", () => {
    const baseE = epoch({ observedAt: iso(0), activeOverrideCount: 3 });
    const mutE = { ...baseE, activeOverrideCount: 4 };
    expect(computeEpochHash(baseE, GENESIS_HASH)).not.toBe(
      computeEpochHash(mutE, GENESIS_HASH),
    );
  });

  it("sealEpoch rejects out-of-order observation timestamps", () => {
    const sealed = sealEpoch(emptySealedLedger(), epoch({ observedAt: iso(5) }));
    expect(() => sealEpoch(sealed, epoch({ observedAt: iso(1) }))).toThrow(/append-only/);
  });

  it("unsealLedger round-trips back to a valid GovernanceLedger", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
    ]);
    const unsealed = unsealLedger(sealed);
    expect(unsealed.epochs.length).toBe(2);
    expect(unsealed.epochs[0]!.observedAt).toBe(iso(0));
  });
});

describe("W2-PR32A — TARGET 4: tamper validators", () => {
  it("verifySealedChain returns 0 findings on a clean chain", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
    ]);
    expect(verifySealedChain(sealed)).toEqual([]);
  });

  it("detects mutated epoch payload (epoch-hash-mismatch)", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1), activeOverrideCount: 1 }),
    ]);
    // Adversarial: replace epoch payload but keep stored hash
    const tampered: SealedGovernanceLedger = {
      sealed: [
        sealed.sealed[0]!,
        {
          ...sealed.sealed[1]!,
          epoch: { ...sealed.sealed[1]!.epoch, activeOverrideCount: 999 },
        },
      ],
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "epoch-hash-mismatch")).toBe(true);
  });

  it("detects deleted middle epoch (broken-chain)", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
    ]);
    // Drop index 1; reindex sequenceIndex naively to keep 0..N-1
    const tampered: SealedGovernanceLedger = {
      sealed: [
        sealed.sealed[0]!,
        { ...sealed.sealed[2]!, sequenceIndex: 1 },
      ],
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "broken-chain")).toBe(true);
  });

  it("detects reordered epochs (broken-chain + out-of-order timestamps)", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
    ]);
    const tampered: SealedGovernanceLedger = {
      sealed: [sealed.sealed[0]!, sealed.sealed[2]!, sealed.sealed[1]!].map((s, i) => ({
        ...s,
        sequenceIndex: i,
      })),
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "broken-chain" || f.tag === "out-of-order-timestamps")).toBe(true);
  });

  it("detects broken genesis (first epoch's previousEpochHash != GENESIS)", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) })]);
    const tampered: SealedGovernanceLedger = {
      sealed: [{ ...sealed.sealed[0]!, previousEpochHash: "deadbeef" }],
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "broken-genesis")).toBe(true);
  });

  it("detects duplicate sequence index", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
    ]);
    const tampered: SealedGovernanceLedger = {
      sealed: [sealed.sealed[0]!, { ...sealed.sealed[1]!, sequenceIndex: 0 }],
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "duplicate-sequence-index")).toBe(true);
  });
});

describe("W2-PR32A — TARGET 2: snapshot integrity", () => {
  it("captureGovernanceSnapshot is deterministic for identical inputs", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) }), epoch({ observedAt: iso(1) })]);
    const s1 = captureGovernanceSnapshot(sealed, iso(2));
    const s2 = captureGovernanceSnapshot(sealed, iso(2));
    expect(s1.snapshotHash).toBe(s2.snapshotHash);
  });

  it("verifySnapshot returns clean for matching ledger", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) }), epoch({ observedAt: iso(1) })]);
    const snap = captureGovernanceSnapshot(sealed, iso(2));
    expect(verifySnapshot(snap, sealed)).toEqual([]);
  });

  it("detects ledger-length divergence", () => {
    const sealed1 = buildSealedLedger([epoch({ observedAt: iso(0) })]);
    const sealed2 = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
    ]);
    const snap = captureGovernanceSnapshot(sealed1, iso(2));
    const findings = verifySnapshot(snap, sealed2);
    expect(findings.some((f) => f.tag === "snapshot-divergence" && f.field === "ledgerLength")).toBe(true);
  });

  it("detects ledgerHeadHash divergence (silent rewrite of head)", () => {
    const sealedA = buildSealedLedger([epoch({ observedAt: iso(0) }), epoch({ observedAt: iso(1) })]);
    const snap = captureGovernanceSnapshot(sealedA, iso(2));
    const sealedB = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1), activeOverrideCount: 99 }),
    ]);
    const findings = verifySnapshot(snap, sealedB);
    expect(findings.some((f) => f.field === "ledgerHeadHash" || f.field === "ledgerCanonicalHash")).toBe(true);
  });

  it("detects direct snapshot tampering (snapshotHash mismatch)", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) })]);
    const snap = captureGovernanceSnapshot(sealed, iso(1));
    const tampered = { ...snap, ledgerLength: snap.ledgerLength + 5 };
    const findings = verifySnapshot(tampered, sealed);
    expect(findings.some((f) => f.field === "snapshotHash")).toBe(true);
  });
});

describe("W2-PR32A — TARGET 3: replay verification", () => {
  it("replayVerifyLedger is deterministic on a clean chain", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1), replayCollapsedCount: 1 }),
    ]);
    const snap = captureGovernanceSnapshot(sealed, iso(2));
    const result = replayVerifyLedger(sealed, snap);
    expect(result.replayDeterministic).toBe(true);
    expect(result.hasTamperEvidence).toBe(false);
  });

  it("detects non-deterministic replay when ledger was rewritten", () => {
    const original = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 5 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 5 }),
    ]);
    const snap = captureGovernanceSnapshot(original, iso(2));

    const rewritten = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 0 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 0 }),
    ]);
    const result = replayVerifyLedger(rewritten, snap);
    expect(result.replayDeterministic).toBe(false);
    expect(result.hasTamperEvidence).toBe(true);
  });
});

describe("W2-PR32A — TARGET 7: persistence-integrity CI report", () => {
  it("clean ledger + matching snapshot → no gating", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) })]);
    const snap = captureGovernanceSnapshot(sealed, iso(1));
    const report = buildPersistenceIntegrityReport(sealed, snap, iso(1));
    expect(report.hasCiGatingCondition).toBe(false);
  });

  it("non-empty ledger with NO snapshot → CI gating (rule #7)", () => {
    const sealed = buildSealedLedger([epoch({ observedAt: iso(0) })]);
    const report = buildPersistenceIntegrityReport(sealed, null, iso(1));
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("empty ledger with no snapshot is acceptable (idempotent adoption)", () => {
    const report = buildPersistenceIntegrityReport(emptySealedLedger(), null, iso(0));
    expect(report.hasCiGatingCondition).toBe(false);
  });
});

describe("W2-PR32A — TARGET 6: adversarial tamper chaos scenarios", () => {
  it("CHAOS: deleted epoch — chain breaks, replay non-deterministic", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 2 }),
      epoch({ observedAt: iso(2), replayAmbiguousCount: 3 }),
    ]);
    const snap = captureGovernanceSnapshot(sealed, iso(3));
    const tampered: SealedGovernanceLedger = {
      sealed: [sealed.sealed[0]!, { ...sealed.sealed[2]!, sequenceIndex: 1 }],
    };
    const result = replayVerifyLedger(tampered, snap);
    expect(result.hasTamperEvidence).toBe(true);
    expect(result.chainFindings.length).toBeGreaterThan(0);
  });

  it("CHAOS: silent replay-history rewrite (R-AMBIGUOUS counts zeroed) is detected", () => {
    const original = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 7 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 9 }),
    ]);
    const snap = captureGovernanceSnapshot(original, iso(2));
    const fakeLedger = buildSealedLedger([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 0 }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 0 }),
    ]);
    const result = replayVerifyLedger(fakeLedger, snap);
    expect(result.replayDeterministic).toBe(false);
  });

  it("CHAOS: reordered recovery history — out-of-order + chain break", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0), recoveryAttemptCount: 1 }),
      epoch({ observedAt: iso(1), recoveryAttemptCount: 2 }),
      epoch({ observedAt: iso(2), recoveryAttemptCount: 3 }),
    ]);
    const reordered: SealedGovernanceLedger = {
      sealed: [sealed.sealed[0]!, sealed.sealed[2]!, sealed.sealed[1]!].map((s, i) => ({
        ...s,
        sequenceIndex: i,
      })),
    };
    const findings = verifySealedChain(reordered);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("CHAOS: snapshot corruption (drift report mutated) is replay-detected", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0), replayCollapsedCount: 1 }),
      epoch({ observedAt: iso(1), replayCollapsedCount: 1 }),
    ]);
    const snap = captureGovernanceSnapshot(sealed, iso(2));
    const corrupted = {
      ...snap,
      driftReport: { ...snap.driftReport, hasCiFailure: !snap.driftReport.hasCiFailure },
    };
    const result = replayVerifyLedger(sealed, corrupted);
    expect(result.hasTamperEvidence).toBe(true);
  });

  it("CHAOS: continuity gap (missing sequence index) flagged", () => {
    const sealed = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1) }),
      epoch({ observedAt: iso(2) }),
    ]);
    // Forge a ledger that drops index 1 but keeps original sequenceIndex labels
    const tampered: SealedGovernanceLedger = {
      sealed: [sealed.sealed[0]!, sealed.sealed[2]!],
    };
    const findings = verifySealedChain(tampered);
    expect(findings.some((f) => f.tag === "missing-sequence-index" || f.tag === "broken-chain")).toBe(true);
  });

  it("CHAOS: hash-collision attempt — same prefix, different tail rewrites are detected", () => {
    // Construct an honest 2-epoch ledger
    const honest = buildSealedLedger([
      epoch({ observedAt: iso(0) }),
      epoch({ observedAt: iso(1), replayAmbiguousCount: 4 }),
    ]);
    const snap = captureGovernanceSnapshot(honest, iso(2));

    // Adversary builds a same-prefix, swapped-tail ledger and copies the
    // recorded epochHash. Hash recomputation will catch the swap.
    const adversary: SealedGovernanceLedger = {
      sealed: [
        honest.sealed[0]!,
        {
          ...honest.sealed[1]!,
          epoch: { ...honest.sealed[1]!.epoch, replayAmbiguousCount: 0 },
        },
      ],
    };
    const findings = verifySealedChain(adversary);
    expect(findings.some((f) => f.tag === "epoch-hash-mismatch")).toBe(true);
    const result = replayVerifyLedger(adversary, snap);
    expect(result.hasTamperEvidence).toBe(true);
  });

  it("CHAOS: 50-epoch chain remains tamper-evident under single-byte mutation", () => {
    const eps: GovernanceEpoch[] = [];
    for (let i = 0; i < 50; i++) {
      eps.push(epoch({ observedAt: iso(i), activeOverrideCount: i % 5 }));
    }
    const sealed = buildSealedLedger(eps);
    const snap = captureGovernanceSnapshot(sealed, iso(50));
    expect(verifySealedChain(sealed)).toEqual([]);
    expect(replayVerifyLedger(sealed, snap).replayDeterministic).toBe(true);

    // Mutate a single field deep in the middle
    const tampered: SealedGovernanceLedger = {
      sealed: sealed.sealed.map((s, i) =>
        i === 25
          ? { ...s, epoch: { ...s.epoch, activeOverrideCount: 999 } }
          : s,
      ),
    };
    const result = replayVerifyLedger(tampered, snap);
    expect(result.hasTamperEvidence).toBe(true);
  });
});
