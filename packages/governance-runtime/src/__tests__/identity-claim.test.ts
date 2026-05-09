import { describe, expect, it } from "vitest";
import {
  buildIdentityClaimReport,
  computeClaimReceiptId,
  hasReclaimCycle,
  IDENTITY_LIFECYCLE,
  isAllowedIdentityTransition,
  validateIdentityClaim,
  type IdentityClaim,
} from "../identity-claim.js";

function claim(o: Partial<IdentityClaim> = {}): IdentityClaim {
  const base = {
    subjectNpi: "1234567890",
    subjectKind: "INDIVIDUAL" as const,
    claimantActor: "operator:onboarding",
    observedAt: "2026-05-09T00:00:00Z",
  };
  return {
    claimId: "cl-001",
    state: "CLAIM_INITIATED",
    claimReceiptId: computeClaimReceiptId(base),
    lineage: [],
    verificationEvidenceRefs: [],
    ...base,
    ...o,
  };
}

describe("W2-PR43A — identity model", () => {
  it("IDENTITY_LIFECYCLE has 7 states including CONTESTED for ambiguity", () => {
    expect(IDENTITY_LIFECYCLE).toContain("CONTESTED");
    expect(IDENTITY_LIFECYCLE.length).toBe(7);
  });
  it("transitions: UNCLAIMED → CLAIM_INITIATED allowed; UNCLAIMED → ACTIVATED forbidden", () => {
    expect(isAllowedIdentityTransition("UNCLAIMED", "CLAIM_INITIATED")).not.toBeNull();
    expect(isAllowedIdentityTransition("UNCLAIMED", "ACTIVATED")).toBeNull();
  });
  it("CONTESTED ↔ CLAIM_VERIFIED is allowed (ambiguity resolution path)", () => {
    expect(isAllowedIdentityTransition("CLAIM_VERIFIED", "CONTESTED")).not.toBeNull();
    expect(isAllowedIdentityTransition("CONTESTED", "CLAIM_VERIFIED")).not.toBeNull();
  });
});

describe("W2-PR43A — receipt determinism (replay-safe)", () => {
  it("identical claim input produces identical receiptId", () => {
    const r1 = computeClaimReceiptId({ subjectNpi: "1234567890", subjectKind: "INDIVIDUAL", claimantActor: "x", observedAt: "2026-05-09T00:00:00Z" });
    const r2 = computeClaimReceiptId({ subjectNpi: "1234567890", subjectKind: "INDIVIDUAL", claimantActor: "x", observedAt: "2026-05-09T00:00:00Z" });
    expect(r1).toBe(r2);
  });
});

describe("W2-PR43A — validators", () => {
  it("clean record passes", () => expect(validateIdentityClaim(claim())).toEqual([]));
  it("invalid NPI rejected", () => {
    const e = validateIdentityClaim(claim({ subjectNpi: "abc", claimReceiptId: computeClaimReceiptId({ subjectNpi: "abc", subjectKind: "INDIVIDUAL", claimantActor: "operator:onboarding", observedAt: "2026-05-09T00:00:00Z" }) }));
    expect(e.some((x) => x.tag === "invalid-npi")).toBe(true);
  });
  it("CONTESTED without reason → state-requires-reason", () => {
    const e = validateIdentityClaim(claim({ state: "CONTESTED" }));
    expect(e.some((x) => x.tag === "state-requires-reason")).toBe(true);
  });
  it("ACTIVATED with empty evidence refs is rejected", () => {
    const e = validateIdentityClaim(claim({ state: "ACTIVATED", verificationEvidenceRefs: [] }));
    expect(e.some((x) => x.tag === "verified-without-evidence")).toBe(true);
  });
  it("receipt id tampered → receipt-id-mismatch", () => {
    const c = claim();
    const tampered = { ...c, claimReceiptId: "deadbeef" };
    expect(validateIdentityClaim(tampered).some((e) => e.tag === "receipt-id-mismatch")).toBe(true);
  });
  it("lineage self-reference is rejected", () => {
    const e = validateIdentityClaim(claim({ lineage: ["cl-001"] }));
    expect(e.some((x) => x.tag === "lineage-self-reference")).toBe(true);
  });
});

describe("W2-PR43A — reclaim chain detection", () => {
  it("acyclic chain (a → b → c) is clean", () => {
    const a = claim({ claimId: "a" });
    const b = claim({ claimId: "b", lineage: ["a"] });
    const c = claim({ claimId: "c", lineage: ["b"] });
    expect(hasReclaimCycle([a, b, c])).toBe(false);
  });
  it("cyclic chain (a → b → a) is detected", () => {
    const a = claim({ claimId: "a", lineage: ["b"] });
    const b = claim({ claimId: "b", lineage: ["a"] });
    expect(hasReclaimCycle([a, b])).toBe(true);
  });
});

describe("W2-PR43A — CI gate + chaos", () => {
  it("CHAOS: invalid claim + reclaim cycle both surface", () => {
    const a = claim({ claimId: "a", lineage: ["b"] });
    const b = claim({ claimId: "b", lineage: ["a"], state: "CONTESTED" });
    const r = buildIdentityClaimReport([a, b], "2026-05-09T00:01:00Z");
    expect(r.findings.some((f) => f.tag === "reclaim-cycle")).toBe(true);
    expect(r.findings.some((f) => f.tag === "validation-error")).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });
});
