import { describe, expect, it } from "vitest";
import {
  appendEpoch,
  emptyLedger,
  type GovernanceEpoch,
} from "../longitudinal-memory.js";
import {
  emptySealedLedger,
  sealEpoch,
  type SealedGovernanceLedger,
} from "../tamper-evident-persistence.js";
import {
  buildReplaySearchIndex,
  buildReplaySearchReport,
  searchReplay,
  verifyReplaySearchIndex,
  verifySearchResult,
  type ReplaySearchResult,
} from "../replay-search.js";

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
function buildSealed(eps: GovernanceEpoch[]): SealedGovernanceLedger {
  let s = emptySealedLedger();
  let l = emptyLedger();
  for (const e of eps) {
    l = appendEpoch(l, e);
    s = sealEpoch(s, e);
  }
  return s;
}

describe("W2-PR76A — index build + determinism", () => {
  it("indexes every sealed epoch", () => {
    const sealed = buildSealed([
      epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
      epoch({ observedAt: iso(1), replayCollapsedCount: 1 }),
    ]);
    const idx = buildReplaySearchIndex(sealed, iso(2));
    expect(idx.entries.length).toBe(2);
    expect(idx.entries[0]!.hasReplayAmbiguous).toBe(true);
    expect(idx.entries[1]!.hasReplayCollapsed).toBe(true);
  });

  it("identical input ⇒ identical indexHash", () => {
    const sealed = buildSealed([epoch({ observedAt: iso(0) })]);
    const a = buildReplaySearchIndex(sealed, iso(1));
    const b = buildReplaySearchIndex(sealed, iso(1));
    expect(a.indexHash).toBe(b.indexHash);
  });
});

describe("W2-PR76A — query semantics", () => {
  const sealed = buildSealed([
    epoch({ observedAt: iso(0), replayAmbiguousCount: 1 }),
    epoch({ observedAt: iso(1), replayAmbiguousCount: 1 }),
    epoch({ observedAt: iso(2), replayCollapsedCount: 2 }),
  ]);
  const idx = buildReplaySearchIndex(sealed, iso(3));

  it("default include ambiguity = true", () => {
    const r = searchReplay(idx, {});
    expect(r.matchedEntries.length).toBe(3);
    expect(r.ambiguousElidedCount).toBe(0);
  });

  it("includeAmbiguous=false elides AND surfaces elidedAmbiguityVisible=true", () => {
    const r = searchReplay(idx, { includeAmbiguous: false });
    expect(r.matchedEntries.length).toBe(1); // only collapsed-only row
    expect(r.ambiguousElidedCount).toBe(2);
    expect(r.elidedAmbiguityVisible).toBe(true);
  });

  it("time-window filter narrows results", () => {
    const r = searchReplay(idx, { fromIso: iso(1), toIso: iso(2) });
    expect(r.matchedEntries.length).toBe(2);
  });

  it("aggregate confidence filter narrows results", () => {
    const r = searchReplay(idx, { aggregateConfidenceIn: ["VERIFIED"] });
    expect(r.matchedEntries.length).toBe(3);
  });
});

describe("W2-PR76A — verifiers", () => {
  const sealed = buildSealed([epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })]);
  const idx = buildReplaySearchIndex(sealed, iso(1));

  it("clean index passes verification", () => {
    expect(verifyReplaySearchIndex(sealed, idx)).toEqual([]);
  });

  it("forged elidedAmbiguityVisible=false on non-zero elision is detected", () => {
    const r = searchReplay(idx, { includeAmbiguous: false });
    const tampered: ReplaySearchResult = { ...r, elidedAmbiguityVisible: false };
    const v = verifySearchResult(idx, tampered);
    expect(v.some((x) => x.tag === "silent-ambiguity-elision")).toBe(true);
  });

  it("forged result hash is detected", () => {
    const r = searchReplay(idx, {});
    const tampered: ReplaySearchResult = { ...r, resultHash: "0".repeat(64) };
    const v = verifySearchResult(idx, tampered);
    expect(v.some((x) => x.tag === "result-hash-mismatch")).toBe(true);
  });
});

describe("W2-PR76A — CI gate + chaos", () => {
  it("CHAOS: silent ambiguity elision fires CI gate", () => {
    const sealed = buildSealed([epoch({ observedAt: iso(0), replayAmbiguousCount: 1 })]);
    const idx = buildReplaySearchIndex(sealed, iso(1));
    const r = searchReplay(idx, { includeAmbiguous: false });
    const tampered: ReplaySearchResult = { ...r, elidedAmbiguityVisible: false };
    // Recompute hash after tamper to bypass result-hash-mismatch
    const report = buildReplaySearchReport(sealed, idx, [tampered], iso(2));
    expect(report.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: empty ledger ⇒ index built, no violations", () => {
    const sealed = buildSealed([]);
    const idx = buildReplaySearchIndex(sealed, iso(0));
    expect(verifyReplaySearchIndex(sealed, idx)).toEqual([]);
    expect(buildReplaySearchReport(sealed, idx, [], iso(0)).hasCiGatingCondition).toBe(false);
  });
});
