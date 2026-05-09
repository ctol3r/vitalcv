import { describe, expect, it } from "vitest";
import {
  buildVerifierWorkspaceReport,
  REVIEW_ITEM_KINDS,
  REVIEW_LIFECYCLE,
  REVIEW_PRIORITY,
  summarizeQueue,
  validateReviewItem,
  type ReviewItem,
} from "../verifier-workspace.js";

function item(o: Partial<ReviewItem> = {}): ReviewItem {
  return {
    itemId: "rv-001",
    kind: "RECEIPT_CANDIDATE",
    priority: "P2",
    state: "QUEUED",
    enqueuedAt: "2026-05-09T00:00:00Z",
    assignedTo: null,
    subjectRef: "issuer:abc",
    subjectKind: "issuer.receipt-candidate",
    hasUnresolvedAmbiguity: false,
    ambiguityReason: null,
    resolutionEvidenceRef: null,
    ...o,
  };
}

describe("W2-PR45A — taxonomy", () => {
  it("REVIEW_ITEM_KINDS has 5 kinds including REPLAY_LINEAGE_INSPECTION", () => {
    expect(REVIEW_ITEM_KINDS).toContain("REPLAY_LINEAGE_INSPECTION");
    expect(REVIEW_ITEM_KINDS).toContain("AMBIGUITY_ESCALATION");
    expect(REVIEW_ITEM_KINDS.length).toBe(5);
  });
  it("priorities ordered P0..P4", () => {
    expect(REVIEW_PRIORITY[0]).toBe("P0");
    expect(REVIEW_PRIORITY[4]).toBe("P4");
  });
  it("AMBIGUITY_HOLD is in lifecycle", () => {
    expect(REVIEW_LIFECYCLE).toContain("AMBIGUITY_HOLD");
  });
});

describe("W2-PR45A — validators", () => {
  it("clean QUEUED item passes", () => expect(validateReviewItem(item())).toEqual([]));
  it("AMBIGUITY_HOLD without reason → flagged", () => {
    const e = validateReviewItem(item({ state: "AMBIGUITY_HOLD" }));
    expect(e.some((x) => x.tag === "ambiguity-state-without-reason")).toBe(true);
  });
  it("RESOLVED without evidence → flagged", () => {
    const e = validateReviewItem(item({ state: "RESOLVED" }));
    expect(e.some((x) => x.tag === "resolved-without-evidence")).toBe(true);
  });
  it("RESOLVED with hasUnresolvedAmbiguity=true → ambiguity-elided", () => {
    const e = validateReviewItem(
      item({ state: "RESOLVED", hasUnresolvedAmbiguity: true, resolutionEvidenceRef: "audit#x" }),
    );
    expect(e.some((x) => x.tag === "ambiguity-elided")).toBe(true);
  });
  it("IN_REVIEW without assignee → flagged", () => {
    const e = validateReviewItem(item({ state: "IN_REVIEW" }));
    expect(e.some((x) => x.tag === "in-review-without-assignee")).toBe(true);
  });
});

describe("W2-PR45A — summary + CI gate", () => {
  it("summarizeQueue counts per-kind/priority/state", () => {
    const s = summarizeQueue([
      item({ itemId: "a", kind: "AMBIGUITY_ESCALATION", priority: "P0" }),
      item({ itemId: "b", state: "AMBIGUITY_HOLD", ambiguityReason: "contradictory evidence" }),
      item({ itemId: "c", state: "RESOLVED", resolutionEvidenceRef: "audit#1" }),
    ]);
    expect(s.total).toBe(3);
    expect(s.p0WaitingCount).toBe(1);
    expect(s.ambiguityHoldCount).toBe(1);
  });

  it("CHAOS: aged P0 → CI gating fires", () => {
    const old = item({
      itemId: "p0-old",
      priority: "P0",
      enqueuedAt: "2026-05-08T00:00:00Z",
    });
    const r = buildVerifierWorkspaceReport([old], "2026-05-09T00:00:00Z");
    expect(r.findings.some((f) => f.tag === "p0-aging")).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: empty queue → no gating", () => {
    const r = buildVerifierWorkspaceReport([], "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
  });
});
