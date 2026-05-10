/**
 * Institutional exception governance (W2-PR89A).
 *
 * Distinct from the W2-PR19A `exception-registry.ts` (governance
 * exception type taxonomy) and W2-PR29A `override-discipline.ts` (human
 * override discipline). This module is the institutional WORKFLOW
 * around exception handling: an `ExceptionApplication` proceeds through
 * a lifecycle (PROPOSED → REVIEWED → APPROVED → APPLIED → CLOSED) with
 * deterministic lineage and replay-safe receipts.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

export const EXCEPTION_LIFECYCLE = [
  "PROPOSED",
  "REVIEWED",
  "APPROVED",
  "APPLIED",
  "CLOSED",
  "REJECTED",
] as const;
export type ExceptionLifecycle = (typeof EXCEPTION_LIFECYCLE)[number];

export interface ExceptionApplication {
  readonly applicationId: string;
  readonly proposingActor: string;
  readonly reviewingActor?: string | null;
  readonly approvingActor?: string | null;
  readonly state: ExceptionLifecycle;
  readonly proposedAt: string;
  readonly justification: string;
  readonly impactedReplayState: boolean;
  readonly impactedAmbiguityState: boolean;
  readonly applicationReceiptId: string;
  /** Required for REJECTED / CLOSED. */
  readonly closingReason?: string | null;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function computeExceptionReceiptId(input: {
  readonly proposingActor: string;
  readonly proposedAt: string;
  readonly justification: string;
  readonly impactedReplayState: boolean;
  readonly impactedAmbiguityState: boolean;
}): string {
  return sha256Hex(canonicalize(input));
}

export type ExceptionViolation =
  | { readonly tag: "missing-field"; readonly field: keyof ExceptionApplication }
  | { readonly tag: "unknown-state"; readonly value: string }
  | { readonly tag: "approved-without-reviewer" }
  | { readonly tag: "applied-without-approver" }
  | { readonly tag: "ambiguity-impact-without-explicit-approval" }
  | { readonly tag: "closed-without-reason" }
  | { readonly tag: "receipt-id-mismatch"; readonly recorded: string; readonly recomputed: string };

export function validateExceptionApplication(
  app: Partial<ExceptionApplication>,
): readonly ExceptionViolation[] {
  const violations: ExceptionViolation[] = [];
  for (const f of ["applicationId", "proposingActor", "state", "proposedAt", "justification", "impactedReplayState", "impactedAmbiguityState", "applicationReceiptId"] as const) {
    const v = app[f];
    if (v === undefined || v === null || v === "") {
      violations.push({ tag: "missing-field", field: f });
    }
  }
  if (app.state && !(EXCEPTION_LIFECYCLE as readonly string[]).includes(app.state)) {
    violations.push({ tag: "unknown-state", value: String(app.state) });
  }
  if ((app.state === "APPROVED" || app.state === "APPLIED") && !app.reviewingActor) {
    violations.push({ tag: "approved-without-reviewer" });
  }
  if (app.state === "APPLIED" && !app.approvingActor) {
    violations.push({ tag: "applied-without-approver" });
  }
  if (
    app.impactedAmbiguityState === true &&
    app.state === "APPROVED" &&
    !app.approvingActor
  ) {
    violations.push({ tag: "ambiguity-impact-without-explicit-approval" });
  }
  if ((app.state === "REJECTED" || app.state === "CLOSED") && !app.closingReason) {
    violations.push({ tag: "closed-without-reason" });
  }
  if (
    typeof app.proposingActor === "string" &&
    typeof app.proposedAt === "string" &&
    typeof app.justification === "string" &&
    typeof app.impactedReplayState === "boolean" &&
    typeof app.impactedAmbiguityState === "boolean" &&
    typeof app.applicationReceiptId === "string"
  ) {
    const recomputed = computeExceptionReceiptId({
      proposingActor: app.proposingActor,
      proposedAt: app.proposedAt,
      justification: app.justification,
      impactedReplayState: app.impactedReplayState,
      impactedAmbiguityState: app.impactedAmbiguityState,
    });
    if (recomputed !== app.applicationReceiptId) {
      violations.push({
        tag: "receipt-id-mismatch",
        recorded: app.applicationReceiptId,
        recomputed,
      });
    }
  }
  return violations;
}

export interface ExceptionGovernanceReport {
  readonly executedAt: string;
  readonly applicationsEvaluated: number;
  readonly violations: readonly { readonly applicationId: string; readonly violation: ExceptionViolation }[];
  readonly hasCiGatingCondition: boolean;
}

export function buildExceptionGovernanceReport(
  applications: readonly ExceptionApplication[],
  nowIso: string,
): ExceptionGovernanceReport {
  const violations: ExceptionGovernanceReport["violations"][number][] = [];
  for (const a of applications) {
    for (const v of validateExceptionApplication(a)) {
      violations.push({ applicationId: a.applicationId, violation: v });
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    applicationsEvaluated: applications.length,
    violations: Object.freeze(violations),
    hasCiGatingCondition: violations.length > 0,
  });
}
