/**
 * Workflow automation integrity (W2-PR56A).
 *
 * Pure orchestration log + receipt model. Each automation step produces
 * a deterministic receipt; an entire workflow run is identified by the
 * Merkle-style hash of its ordered receipts (audit-traceable; tamper-
 * evident given DB integrity).
 *
 * Ambiguity-preserving: an automated step that observes a CONTESTED
 * subject MUST escalate (not auto-resolve). Replay-safe: identical
 * step input ⇒ identical receipt id.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

export const WORKFLOW_STEP_KINDS = [
  "ROUTE_CREDENTIAL",
  "REQUEST_VERIFICATION",
  "AGGREGATE_EVIDENCE",
  "ESCALATE_AMBIGUITY",
  "EMIT_RECEIPT",
  "DEFER_FOR_HUMAN",
] as const;
export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number];

export const WORKFLOW_OUTCOMES = [
  "ADVANCED",
  "ESCALATED",
  "DEFERRED",
  "FAILED_CLOSED",
] as const;
export type WorkflowOutcome = (typeof WORKFLOW_OUTCOMES)[number];

export interface WorkflowStepReceipt {
  readonly receiptId: string;
  readonly runId: string;
  readonly sequenceIndex: number;
  readonly stepKind: WorkflowStepKind;
  readonly subjectRef: string;
  readonly observedAt: string;
  readonly outcome: WorkflowOutcome;
  /** Required for ESCALATED / DEFERRED / FAILED_CLOSED. */
  readonly outcomeReason?: string | null;
  readonly inputCanonicalHash: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function computeStepReceiptId(input: {
  readonly runId: string;
  readonly sequenceIndex: number;
  readonly stepKind: WorkflowStepKind;
  readonly subjectRef: string;
  readonly observedAt: string;
  readonly outcome: WorkflowOutcome;
  readonly outcomeReason: string | null;
  readonly inputCanonicalHash: string;
}): string {
  return sha256Hex(canonicalize(input));
}

export type WorkflowValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof WorkflowStepReceipt }
  | { readonly tag: "unknown-step-kind"; readonly value: string }
  | { readonly tag: "unknown-outcome"; readonly value: string }
  | { readonly tag: "outcome-requires-reason"; readonly outcome: WorkflowOutcome }
  | { readonly tag: "advanced-with-reason" }
  | { readonly tag: "receipt-id-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "auto-resolved-ambiguity"; readonly receiptId: string };

export function validateStepReceipt(
  r: Partial<WorkflowStepReceipt>,
): readonly WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  for (const f of ["receiptId", "runId", "sequenceIndex", "stepKind", "subjectRef", "observedAt", "outcome", "inputCanonicalHash"] as const) {
    if (r[f] === undefined || r[f] === null || r[f] === "") {
      errors.push({ tag: "missing-field", field: f });
    }
  }
  if (r.stepKind && !(WORKFLOW_STEP_KINDS as readonly string[]).includes(r.stepKind)) {
    errors.push({ tag: "unknown-step-kind", value: String(r.stepKind) });
  }
  if (r.outcome && !(WORKFLOW_OUTCOMES as readonly string[]).includes(r.outcome)) {
    errors.push({ tag: "unknown-outcome", value: String(r.outcome) });
  }
  if (
    (r.outcome === "ESCALATED" || r.outcome === "DEFERRED" || r.outcome === "FAILED_CLOSED") &&
    !r.outcomeReason
  ) {
    errors.push({ tag: "outcome-requires-reason", outcome: r.outcome });
  }
  if (r.outcome === "ADVANCED" && r.outcomeReason) {
    errors.push({ tag: "advanced-with-reason" });
  }
  // Ambiguity preservation: ESCALATE_AMBIGUITY step with outcome ADVANCED
  // is an attempt to silently resolve ambiguity
  if (r.stepKind === "ESCALATE_AMBIGUITY" && r.outcome === "ADVANCED") {
    errors.push({ tag: "auto-resolved-ambiguity", receiptId: String(r.receiptId ?? "") });
  }
  if (
    typeof r.runId === "string" &&
    typeof r.sequenceIndex === "number" &&
    typeof r.stepKind === "string" &&
    typeof r.subjectRef === "string" &&
    typeof r.observedAt === "string" &&
    typeof r.outcome === "string" &&
    typeof r.inputCanonicalHash === "string" &&
    typeof r.receiptId === "string"
  ) {
    const recomputed = computeStepReceiptId({
      runId: r.runId,
      sequenceIndex: r.sequenceIndex,
      stepKind: r.stepKind as WorkflowStepKind,
      subjectRef: r.subjectRef,
      observedAt: r.observedAt,
      outcome: r.outcome as WorkflowOutcome,
      outcomeReason: r.outcomeReason ?? null,
      inputCanonicalHash: r.inputCanonicalHash,
    });
    if (recomputed !== r.receiptId) {
      errors.push({ tag: "receipt-id-mismatch", recorded: r.receiptId, recomputed });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Run-level Merkle hash
// ---------------------------------------------------------------------------

export function computeRunHash(receipts: readonly WorkflowStepReceipt[]): string {
  const ordered = [...receipts].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  return sha256Hex(canonicalize(ordered.map((r) => r.receiptId)));
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface WorkflowAutomationReport {
  readonly executedAt: string;
  readonly receiptsEvaluated: number;
  readonly findings: readonly { readonly tag: "validation-error"; readonly receiptId: string; readonly error: WorkflowValidationError }[];
  readonly hasCiGatingCondition: boolean;
}

export function buildWorkflowAutomationReport(
  receipts: readonly WorkflowStepReceipt[],
  nowIso: string,
): WorkflowAutomationReport {
  const findings: WorkflowAutomationReport["findings"][number][] = [];
  let gating = false;
  for (const r of receipts) {
    for (const e of validateStepReceipt(r)) {
      findings.push({ tag: "validation-error", receiptId: r.receiptId, error: e });
      gating = true;
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    receiptsEvaluated: receipts.length,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
