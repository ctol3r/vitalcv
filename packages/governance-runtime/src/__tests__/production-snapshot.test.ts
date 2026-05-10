/**
 * W2-PR103A — Production replay snapshotting tests + chaos.
 */

import { describe, expect, it } from "vitest";
import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
} from "../longitudinal-memory.js";
import {
  captureGovernanceSnapshot,
  emptySealedLedger,
  sealEpoch,
  type SealedGovernanceLedger,
} from "../tamper-evident-persistence.js";
import {
  appendProductionSnapshot,
  buildProductionSnapshot,
  buildProductionSnapshotReport,
  computeProductionSnapshotId,
  detectSnapshotDrift,
  emptySnapshotChain,
  findRestorationCheckpoint,
  planRestoration,
  ROOT_PRODUCTION_PARENT,
  type ProductionSnapshot,
  type SnapshotChain,
} from "../production-snapshot.js";

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
  return new Date(Date.parse("2026-05-10T00:00:00Z") + h * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildSealedAt(epochCount: number, ambigPerEpoch: number = 0): SealedGovernanceLedger {
  let ledger = emptyLedger();
  let sealed = emptySealedLedger();
  for (let i = 0; i < epochCount; i++) {
    const e = epoch({ observedAt: iso(i), replayAmbiguousCount: ambigPerEpoch });
    ledger = appendEpoch(ledger, e);
    sealed = sealEpoch(sealed, e);
  }
  return sealed;
}

function makeSnapshotAt(epochCount: number, parentId: string, label: string, capturedAt: string, checkpoint: boolean = false): ProductionSnapshot {
  const sealed = buildSealedAt(epochCount, 1);
  const gov = captureGovernanceSnapshot(sealed, capturedAt);
  return buildProductionSnapshot({
    parentSnapshotId: parentId,
    capturedAt,
    productionLabel: label,
    restorationCheckpoint: checkpoint,
    governanceSnapshot: gov,
    sealed,
  });
}

describe("W2-PR103A — snapshot build + determinism", () => {
  it("identical input ⇒ identical snapshotId", () => {
    const sealed = buildSealedAt(3);
    const gov = captureGovernanceSnapshot(sealed, iso(4));
    const a = buildProductionSnapshot({
      parentSnapshotId: ROOT_PRODUCTION_PARENT,
      capturedAt: iso(4),
      productionLabel: "v1.0.0",
      restorationCheckpoint: true,
      governanceSnapshot: gov,
      sealed,
    });
    const b = buildProductionSnapshot({
      parentSnapshotId: ROOT_PRODUCTION_PARENT,
      capturedAt: iso(4),
      productionLabel: "v1.0.0",
      restorationCheckpoint: true,
      governanceSnapshot: gov,
      sealed,
    });
    expect(a.snapshotId).toBe(b.snapshotId);
  });

  it("computeProductionSnapshotId is order-stable (canonicalization)", () => {
    const a = computeProductionSnapshotId({
      parentSnapshotId: "p",
      capturedAt: iso(0),
      productionLabel: "v1",
      restorationCheckpoint: false,
      ledgerHeadHash: "h",
      ledgerLength: 3,
      governanceSnapshotHash: "g",
      totalReplayAmbiguous: 5,
      totalReplayCollapsed: 0,
    });
    const b = computeProductionSnapshotId({
      totalReplayAmbiguous: 5,
      productionLabel: "v1",
      capturedAt: iso(0),
      ledgerLength: 3,
      restorationCheckpoint: false,
      parentSnapshotId: "p",
      ledgerHeadHash: "h",
      governanceSnapshotHash: "g",
      totalReplayCollapsed: 0,
    });
    expect(a).toBe(b);
  });
});

describe("W2-PR103A — chain append + ordering", () => {
  it("first snapshot must declare ROOT parent", () => {
    const s = makeSnapshotAt(1, "not-root", "v1", iso(1));
    expect(() => appendProductionSnapshot(emptySnapshotChain(), s)).toThrow(/ROOT/);
  });

  it("subsequent snapshot must point to prior snapshotId", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2bad = makeSnapshotAt(2, "wrong-parent", "v2", iso(2));
    expect(() => appendProductionSnapshot(c1, s2bad)).toThrow(/parent mismatch/);
  });

  it("rejects out-of-order timestamps", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(5));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(2, s1.snapshotId, "v2", iso(1));
    expect(() => appendProductionSnapshot(c1, s2)).toThrow(/out-of-order/);
  });

  it("rejects ledger length regression", () => {
    const s1 = makeSnapshotAt(5, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(3, s1.snapshotId, "v2", iso(2));
    expect(() => appendProductionSnapshot(c1, s2)).toThrow(/length regressed/);
  });

  it("clean linear chain appends correctly", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(2, s1.snapshotId, "v2", iso(2));
    const c2 = appendProductionSnapshot(c1, s2);
    expect(c2.snapshots.length).toBe(2);
  });
});

describe("W2-PR103A — restoration checkpoint discovery", () => {
  it("finds most recent checkpoint", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1), true);
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(2, s1.snapshotId, "v2", iso(2), false);
    const c2 = appendProductionSnapshot(c1, s2);
    const s3 = makeSnapshotAt(3, s2.snapshotId, "v3", iso(3), true);
    const c3 = appendProductionSnapshot(c2, s3);
    const checkpoint = findRestorationCheckpoint(c3);
    expect(checkpoint?.snapshotId).toBe(s3.snapshotId);
  });

  it("returns null when no checkpoint exists", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1), false);
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    expect(findRestorationCheckpoint(c1)).toBeNull();
  });
});

describe("W2-PR103A — drift detection", () => {
  it("detects ledger length + replay deltas", () => {
    const s1 = makeSnapshotAt(2, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(5, s1.snapshotId, "v2", iso(2));
    appendProductionSnapshot(c1, s2);
    const drift = detectSnapshotDrift(s1, s2);
    expect(drift.ledgerLengthDelta).toBe(3);
    expect(drift.replayAmbiguousDelta).toBeGreaterThanOrEqual(0);
    expect(drift.headHashChanged).toBe(true);
  });
});

describe("W2-PR103A — restoration plan", () => {
  it("rollback to earlier snapshot exposes ambiguity-erasure risk", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1), true);
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const s2 = makeSnapshotAt(5, s1.snapshotId, "v2", iso(2));
    const c2 = appendProductionSnapshot(c1, s2);
    const plan = planRestoration(c2, s1.snapshotId);
    expect(plan.epochsRolledBack).toBe(4);
    expect(plan.ambiguityErasureRisk).toBe(true);
    expect(plan.replayAmbiguousLost).toBeGreaterThan(0);
  });

  it("rollback to head is no-op (epochsRolledBack = 0)", () => {
    const s1 = makeSnapshotAt(2, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1 = appendProductionSnapshot(emptySnapshotChain(), s1);
    const plan = planRestoration(c1, s1.snapshotId);
    expect(plan.epochsRolledBack).toBe(0);
    expect(plan.ambiguityErasureRisk).toBe(false);
  });
});

describe("W2-PR103A — TARGET 6: snapshot chaos", () => {
  it("CHAOS: tampered snapshotId is detected by report", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const c1: SnapshotChain = { snapshots: [{ ...s1, snapshotId: "0".repeat(64) }] };
    const r = buildProductionSnapshotReport(c1, iso(2));
    expect(r.violations.some((v) => v.tag === "snapshot-id-mismatch")).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: broken parent chain detected", () => {
    const s1 = makeSnapshotAt(1, ROOT_PRODUCTION_PARENT, "v1", iso(1));
    const s2 = makeSnapshotAt(2, "wrong-parent", "v2", iso(2));
    const chain: SnapshotChain = { snapshots: [s1, s2] };
    const r = buildProductionSnapshotReport(chain, iso(3));
    expect(r.violations.some((v) => v.tag === "broken-parent-chain")).toBe(true);
  });

  it("CHAOS: requireCheckpointEvery=3 fires when chain has no checkpoint", () => {
    let chain = emptySnapshotChain();
    let parent = ROOT_PRODUCTION_PARENT;
    for (let i = 1; i <= 5; i++) {
      const s = makeSnapshotAt(i, parent, `v${i}`, iso(i), false);
      chain = appendProductionSnapshot(chain, s);
      parent = s.snapshotId;
    }
    const r = buildProductionSnapshotReport(chain, iso(6), { requireCheckpointEvery: 3 });
    expect(r.violations.some((v) => v.tag === "no-restoration-checkpoint")).toBe(true);
  });

  it("CHAOS: empty chain → no violations, no gating", () => {
    const r = buildProductionSnapshotReport(emptySnapshotChain(), iso(0));
    expect(r.hasCiGatingCondition).toBe(false);
    expect(r.violations).toEqual([]);
  });
});
