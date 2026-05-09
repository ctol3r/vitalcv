/**
 * Verifier operational workspace primitives (W2-PR45A).
 *
 * Pure data model for verifier review queues, replay lineage inspection
 * tickets, and ambiguity escalation workflows. The web layer renders;
 * this module guarantees data-shape correctness and that no item can
 * elide unresolved ambiguity.
 */

// ---------------------------------------------------------------------------
// Queue item kinds
// ---------------------------------------------------------------------------

export const REVIEW_ITEM_KINDS = [
  "RECEIPT_CANDIDATE",
  "PSV_CANDIDATE",
  "REPLAY_LINEAGE_INSPECTION",
  "AMBIGUITY_ESCALATION",
  "TRUST_TRAJECTORY_REVIEW",
] as const;
export type ReviewItemKind = (typeof REVIEW_ITEM_KINDS)[number];

export const REVIEW_PRIORITY = ["P0", "P1", "P2", "P3", "P4"] as const;
export type ReviewPriority = (typeof REVIEW_PRIORITY)[number];

const PRIORITY_NUMERIC: Readonly<Record<ReviewPriority, number>> = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
});

export const REVIEW_LIFECYCLE = [
  "QUEUED",
  "IN_REVIEW",
  "AMBIGUITY_HOLD",
  "ESCALATED",
  "RESOLVED",
] as const;
export type ReviewLifecycle = (typeof REVIEW_LIFECYCLE)[number];

// ---------------------------------------------------------------------------
// Item record
// ---------------------------------------------------------------------------

export interface ReviewItem {
  readonly itemId: string;
  readonly kind: ReviewItemKind;
  readonly priority: ReviewPriority;
  readonly state: ReviewLifecycle;
  readonly enqueuedAt: string;
  readonly assignedTo?: string | null;
  readonly subjectRef: string; // e.g., issuer mutation id, claim id
  readonly subjectKind: string;
  readonly hasUnresolvedAmbiguity: boolean;
  /** When state ∈ {AMBIGUITY_HOLD, ESCALATED}, this MUST be populated. */
  readonly ambiguityReason?: string | null;
  /** When state == RESOLVED, this MUST be populated. */
  readonly resolutionEvidenceRef?: string | null;
}

export type ReviewValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof ReviewItem }
  | { readonly tag: "unknown-kind"; readonly value: string }
  | { readonly tag: "unknown-priority"; readonly value: string }
  | { readonly tag: "unknown-state"; readonly value: string }
  | { readonly tag: "ambiguity-state-without-reason"; readonly state: ReviewLifecycle }
  | { readonly tag: "resolved-without-evidence" }
  | { readonly tag: "ambiguity-elided"; readonly state: ReviewLifecycle }
  | { readonly tag: "in-review-without-assignee" };

export function validateReviewItem(item: Partial<ReviewItem>): readonly ReviewValidationError[] {
  const errors: ReviewValidationError[] = [];
  const required: readonly (keyof ReviewItem)[] = [
    "itemId",
    "kind",
    "priority",
    "state",
    "enqueuedAt",
    "subjectRef",
    "subjectKind",
    "hasUnresolvedAmbiguity",
  ];
  for (const f of required) {
    const v = item[f];
    if (v === undefined || v === null || v === "") {
      errors.push({ tag: "missing-field", field: f });
    }
  }
  if (item.kind && !(REVIEW_ITEM_KINDS as readonly string[]).includes(item.kind)) {
    errors.push({ tag: "unknown-kind", value: String(item.kind) });
  }
  if (item.priority && !(REVIEW_PRIORITY as readonly string[]).includes(item.priority)) {
    errors.push({ tag: "unknown-priority", value: String(item.priority) });
  }
  if (item.state && !(REVIEW_LIFECYCLE as readonly string[]).includes(item.state)) {
    errors.push({ tag: "unknown-state", value: String(item.state) });
  }
  if (
    (item.state === "AMBIGUITY_HOLD" || item.state === "ESCALATED") &&
    !item.ambiguityReason
  ) {
    errors.push({ tag: "ambiguity-state-without-reason", state: item.state });
  }
  if (item.state === "RESOLVED" && !item.resolutionEvidenceRef) {
    errors.push({ tag: "resolved-without-evidence" });
  }
  // Ambiguity preservation: if state == RESOLVED but hasUnresolvedAmbiguity == true,
  // that's an elision attempt
  if (item.state === "RESOLVED" && item.hasUnresolvedAmbiguity === true) {
    errors.push({ tag: "ambiguity-elided", state: item.state });
  }
  if (item.state === "IN_REVIEW" && !item.assignedTo) {
    errors.push({ tag: "in-review-without-assignee" });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Queue derivations
// ---------------------------------------------------------------------------

export interface QueueSummary {
  readonly total: number;
  readonly perKind: Readonly<Partial<Record<ReviewItemKind, number>>>;
  readonly perPriority: Readonly<Partial<Record<ReviewPriority, number>>>;
  readonly perState: Readonly<Partial<Record<ReviewLifecycle, number>>>;
  readonly oldestQueuedItemAt: string | null;
  readonly p0WaitingCount: number;
  readonly ambiguityHoldCount: number;
}

export function summarizeQueue(items: readonly ReviewItem[]): QueueSummary {
  const perKind: Partial<Record<ReviewItemKind, number>> = {};
  const perPriority: Partial<Record<ReviewPriority, number>> = {};
  const perState: Partial<Record<ReviewLifecycle, number>> = {};
  let oldest: string | null = null;
  let p0Waiting = 0;
  let ambigHold = 0;
  for (const it of items) {
    perKind[it.kind] = (perKind[it.kind] ?? 0) + 1;
    perPriority[it.priority] = (perPriority[it.priority] ?? 0) + 1;
    perState[it.state] = (perState[it.state] ?? 0) + 1;
    if (it.state === "QUEUED") {
      if (oldest === null || Date.parse(it.enqueuedAt) < Date.parse(oldest)) {
        oldest = it.enqueuedAt;
      }
      if (it.priority === "P0") p0Waiting++;
    }
    if (it.state === "AMBIGUITY_HOLD") ambigHold++;
  }
  return Object.freeze({
    total: items.length,
    perKind: Object.freeze(perKind),
    perPriority: Object.freeze(perPriority),
    perState: Object.freeze(perState),
    oldestQueuedItemAt: oldest,
    p0WaitingCount: p0Waiting,
    ambiguityHoldCount: ambigHold,
  });
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface VerifierWorkspaceReport {
  readonly executedAt: string;
  readonly summary: QueueSummary;
  readonly findings: readonly (
    | { readonly tag: "validation-error"; readonly itemId: string; readonly error: ReviewValidationError }
    | { readonly tag: "p0-aging"; readonly itemId: string; readonly enqueuedAt: string }
  )[];
  readonly hasCiGatingCondition: boolean;
}

const P0_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export function buildVerifierWorkspaceReport(
  items: readonly ReviewItem[],
  nowIso: string,
): VerifierWorkspaceReport {
  const summary = summarizeQueue(items);
  const findings: VerifierWorkspaceReport["findings"][number][] = [];
  let gating = false;
  const now = Date.parse(nowIso);
  for (const it of items) {
    for (const e of validateReviewItem(it)) {
      findings.push({ tag: "validation-error", itemId: it.itemId, error: e });
      gating = true;
    }
    if (
      it.priority === "P0" &&
      it.state === "QUEUED" &&
      Number.isFinite(now) &&
      now - Date.parse(it.enqueuedAt) > P0_MAX_AGE_MS
    ) {
      findings.push({ tag: "p0-aging", itemId: it.itemId, enqueuedAt: it.enqueuedAt });
      gating = true;
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    summary,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}

export { PRIORITY_NUMERIC };
