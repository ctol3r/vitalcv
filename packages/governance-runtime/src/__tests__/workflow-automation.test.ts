import { describe, expect, it } from "vitest";
import {
  buildWorkflowAutomationReport,
  computeRunHash,
  computeStepReceiptId,
  validateStepReceipt,
  WORKFLOW_OUTCOMES,
  WORKFLOW_STEP_KINDS,
  type WorkflowStepReceipt,
} from "../workflow-automation.js";

function rcpt(o: Partial<WorkflowStepReceipt> = {}): WorkflowStepReceipt {
  const base = {
    runId: "run-1",
    sequenceIndex: 0,
    stepKind: "ROUTE_CREDENTIAL" as const,
    subjectRef: "cred:abc",
    observedAt: "2026-05-09T00:00:00Z",
    outcome: "ADVANCED" as const,
    outcomeReason: null,
    inputCanonicalHash: "deadbeef",
  };
  return {
    receiptId: computeStepReceiptId({ ...base, outcomeReason: null }),
    ...base,
    ...o,
  };
}

describe("W2-PR56A — taxonomy", () => {
  it("WORKFLOW_STEP_KINDS includes ESCALATE_AMBIGUITY + DEFER_FOR_HUMAN", () => {
    expect(WORKFLOW_STEP_KINDS).toContain("ESCALATE_AMBIGUITY");
    expect(WORKFLOW_STEP_KINDS).toContain("DEFER_FOR_HUMAN");
  });
  it("WORKFLOW_OUTCOMES includes FAILED_CLOSED", () => {
    expect(WORKFLOW_OUTCOMES).toContain("FAILED_CLOSED");
  });
});

describe("W2-PR56A — receipt determinism", () => {
  it("same input ⇒ same receiptId", () => {
    const a = computeStepReceiptId({ runId: "r", sequenceIndex: 0, stepKind: "ROUTE_CREDENTIAL", subjectRef: "x", observedAt: "2026-05-09T00:00:00Z", outcome: "ADVANCED", outcomeReason: null, inputCanonicalHash: "h" });
    const b = computeStepReceiptId({ runId: "r", sequenceIndex: 0, stepKind: "ROUTE_CREDENTIAL", subjectRef: "x", observedAt: "2026-05-09T00:00:00Z", outcome: "ADVANCED", outcomeReason: null, inputCanonicalHash: "h" });
    expect(a).toBe(b);
  });
});

describe("W2-PR56A — validators", () => {
  it("clean receipt passes", () => expect(validateStepReceipt(rcpt())).toEqual([]));
  it("ESCALATED without reason → flagged", () => {
    const r = rcpt({ outcome: "ESCALATED" });
    const e = validateStepReceipt({ ...r, receiptId: computeStepReceiptId({ ...r, outcomeReason: null }) });
    expect(e.some((x) => x.tag === "outcome-requires-reason")).toBe(true);
  });
  it("ADVANCED with reason → contradiction flagged", () => {
    const r = rcpt({ outcome: "ADVANCED", outcomeReason: "should-not-be-here" });
    const e = validateStepReceipt({ ...r, receiptId: computeStepReceiptId({ ...r, outcomeReason: "should-not-be-here" }) });
    expect(e.some((x) => x.tag === "advanced-with-reason")).toBe(true);
  });
  it("ESCALATE_AMBIGUITY step with ADVANCED outcome → auto-resolved-ambiguity", () => {
    const r = rcpt({ stepKind: "ESCALATE_AMBIGUITY", outcome: "ADVANCED" });
    const e = validateStepReceipt({ ...r, receiptId: computeStepReceiptId({ ...r, outcomeReason: null }) });
    expect(e.some((x) => x.tag === "auto-resolved-ambiguity")).toBe(true);
  });
  it("receipt id tampered → flagged", () => {
    const r = rcpt({});
    const e = validateStepReceipt({ ...r, receiptId: "wrong" });
    expect(e.some((x) => x.tag === "receipt-id-mismatch")).toBe(true);
  });
});

describe("W2-PR56A — run hash", () => {
  it("identical receipt sequences ⇒ identical run hash", () => {
    const r1 = rcpt({ sequenceIndex: 0 });
    const r2 = rcpt({ sequenceIndex: 1, stepKind: "EMIT_RECEIPT" });
    const r2WithId = { ...r2, receiptId: computeStepReceiptId({ ...r2, outcomeReason: null }) };
    const hashA = computeRunHash([r1, r2WithId]);
    const hashB = computeRunHash([r2WithId, r1]); // out of order; should normalize
    expect(hashA).toBe(hashB);
  });
});

describe("W2-PR56A — CI gate + chaos", () => {
  it("CHAOS: auto-resolved ambiguity in any receipt → CI gating fires", () => {
    const r = rcpt({ stepKind: "ESCALATE_AMBIGUITY", outcome: "ADVANCED" });
    const fixed = { ...r, receiptId: computeStepReceiptId({ ...r, outcomeReason: null }) };
    const report = buildWorkflowAutomationReport([fixed], "2026-05-09T00:01:00Z");
    expect(report.hasCiGatingCondition).toBe(true);
  });
  it("CHAOS: empty stream → no gating", () => {
    expect(buildWorkflowAutomationReport([], "2026-05-09T00:00:00Z").hasCiGatingCondition).toBe(false);
  });
});
