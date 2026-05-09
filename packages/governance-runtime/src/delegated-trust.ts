/**
 * Delegated trust administration (W2-PR53A).
 *
 * Pure data model + decision functions for scoped, time-bounded
 * delegation of governance authority.
 *
 * A delegation grant authorizes a delegate to perform a SUBSET of the
 * delegator's actions, optionally narrowed to specific subjects, for a
 * bounded time window. Grants are hash-identified and immutable.
 *
 * Non-negotiable:
 *   - replay-safe: identical grant input ⇒ identical grantId
 *   - ambiguity preserved: an UNRESOLVED escalation cannot be silently
 *     resolved by a delegate
 *   - authority lineage auditable: every grant chains to its parent
 *   - escalation chains reconstructable
 *   - fail-closed: unknown actions / expired grants → deny
 *   - bounded authority: delegate may not grant beyond its own subset
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import { ADMIN_ACTIONS, type AdminAction } from "./enterprise-admin.js";

// ---------------------------------------------------------------------------
// Grant + lifecycle
// ---------------------------------------------------------------------------

export const DELEGATION_LIFECYCLE = [
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "ESCALATED",
] as const;
export type DelegationLifecycle = (typeof DELEGATION_LIFECYCLE)[number];

export interface DelegationGrant {
  readonly grantId: string;
  readonly delegatorId: string;
  readonly delegateId: string;
  /** Subset of AdminAction the delegate may perform. */
  readonly grantedActions: readonly AdminAction[];
  /** If non-empty, restricts grant to these subject ids. Empty = unrestricted within action set. */
  readonly subjectScope: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly state: DelegationLifecycle;
  /** Parent grant id if this grant was issued via re-delegation. */
  readonly parentGrantId?: string | null;
  /** Required when state ∈ {REVOKED, ESCALATED}. */
  readonly stateReason?: string | null;
}

export const MAX_DELEGATION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const MAX_DELEGATION_DEPTH = 3 as const;

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Deterministic grantId hash. */
export function computeGrantId(input: {
  readonly delegatorId: string;
  readonly delegateId: string;
  readonly grantedActions: readonly AdminAction[];
  readonly subjectScope: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly parentGrantId: string | null;
}): string {
  return sha256Hex(canonicalize({
    ...input,
    grantedActions: [...input.grantedActions].sort(),
    subjectScope: [...input.subjectScope].sort(),
  }));
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export type DelegationValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof DelegationGrant }
  | { readonly tag: "unknown-action"; readonly value: string }
  | { readonly tag: "unknown-state"; readonly value: string }
  | { readonly tag: "duration-exceeds-max"; readonly maxMs: number; readonly actualMs: number }
  | { readonly tag: "expires-before-issued" }
  | { readonly tag: "state-requires-reason"; readonly state: DelegationLifecycle }
  | { readonly tag: "grant-id-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "self-delegation-forbidden" };

export function validateDelegationGrant(g: Partial<DelegationGrant>): readonly DelegationValidationError[] {
  const errors: DelegationValidationError[] = [];
  for (const f of ["grantId", "delegatorId", "delegateId", "grantedActions", "subjectScope", "issuedAt", "expiresAt", "state"] as const) {
    const v = g[f];
    if (v === undefined || v === null || v === "") errors.push({ tag: "missing-field", field: f });
  }
  if (Array.isArray(g.grantedActions)) {
    for (const a of g.grantedActions) {
      if (!(ADMIN_ACTIONS as readonly string[]).includes(a as string)) {
        errors.push({ tag: "unknown-action", value: String(a) });
      }
    }
  }
  if (g.state && !(DELEGATION_LIFECYCLE as readonly string[]).includes(g.state)) {
    errors.push({ tag: "unknown-state", value: String(g.state) });
  }
  if (typeof g.issuedAt === "string" && typeof g.expiresAt === "string") {
    const i = Date.parse(g.issuedAt);
    const e = Date.parse(g.expiresAt);
    if (Number.isFinite(i) && Number.isFinite(e)) {
      if (e < i) errors.push({ tag: "expires-before-issued" });
      const dur = e - i;
      if (dur > MAX_DELEGATION_DURATION_MS) {
        errors.push({ tag: "duration-exceeds-max", maxMs: MAX_DELEGATION_DURATION_MS, actualMs: dur });
      }
    }
  }
  if ((g.state === "REVOKED" || g.state === "ESCALATED") && !g.stateReason) {
    errors.push({ tag: "state-requires-reason", state: g.state });
  }
  if (g.delegatorId && g.delegateId && g.delegatorId === g.delegateId) {
    errors.push({ tag: "self-delegation-forbidden" });
  }
  if (
    typeof g.delegatorId === "string" &&
    typeof g.delegateId === "string" &&
    Array.isArray(g.grantedActions) &&
    Array.isArray(g.subjectScope) &&
    typeof g.issuedAt === "string" &&
    typeof g.expiresAt === "string" &&
    typeof g.grantId === "string"
  ) {
    const recomputed = computeGrantId({
      delegatorId: g.delegatorId,
      delegateId: g.delegateId,
      grantedActions: g.grantedActions as readonly AdminAction[],
      subjectScope: g.subjectScope as readonly string[],
      issuedAt: g.issuedAt,
      expiresAt: g.expiresAt,
      parentGrantId: g.parentGrantId ?? null,
    });
    if (recomputed !== g.grantId) {
      errors.push({ tag: "grant-id-mismatch", recorded: g.grantId, recomputed });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Bounded re-delegation (sub-grants must be ≤ parent)
// ---------------------------------------------------------------------------

export type SubGrantViolation =
  | { readonly tag: "action-not-in-parent"; readonly action: AdminAction }
  | { readonly tag: "subject-not-in-parent-scope"; readonly subject: string }
  | { readonly tag: "expiration-extends-past-parent" }
  | { readonly tag: "depth-exceeded"; readonly depth: number };

export function validateSubGrant(
  parent: DelegationGrant,
  child: DelegationGrant,
  ancestryDepth: number,
): readonly SubGrantViolation[] {
  const violations: SubGrantViolation[] = [];
  const parentActions = new Set<string>(parent.grantedActions);
  for (const a of child.grantedActions) {
    if (!parentActions.has(a)) violations.push({ tag: "action-not-in-parent", action: a });
  }
  if (parent.subjectScope.length > 0) {
    const parentSubjects = new Set<string>(parent.subjectScope);
    for (const s of child.subjectScope) {
      if (!parentSubjects.has(s)) violations.push({ tag: "subject-not-in-parent-scope", subject: s });
    }
  }
  if (Date.parse(child.expiresAt) > Date.parse(parent.expiresAt)) {
    violations.push({ tag: "expiration-extends-past-parent" });
  }
  if (ancestryDepth + 1 > MAX_DELEGATION_DEPTH) {
    violations.push({ tag: "depth-exceeded", depth: ancestryDepth + 1 });
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Delegation decision (effective access at a point in time)
// ---------------------------------------------------------------------------

export interface DelegationDecision {
  readonly grantId: string;
  readonly delegateId: string;
  readonly action: AdminAction;
  readonly subjectId: string | null;
  readonly allowed: boolean;
  readonly reason: string;
  readonly decidedAt: string;
}

export function decideDelegationAccess(input: {
  readonly grant: DelegationGrant;
  readonly requestedAction: AdminAction;
  readonly requestedSubjectId: string | null;
  readonly nowIso: string;
}): DelegationDecision {
  const { grant, requestedAction, requestedSubjectId, nowIso } = input;
  const now = Date.parse(nowIso);
  if (grant.state !== "ACTIVE") {
    return Object.freeze({
      grantId: grant.grantId,
      delegateId: grant.delegateId,
      action: requestedAction,
      subjectId: requestedSubjectId,
      allowed: false,
      reason: `grant state ${grant.state}; deny`,
      decidedAt: nowIso,
    });
  }
  if (now > Date.parse(grant.expiresAt)) {
    return Object.freeze({
      grantId: grant.grantId,
      delegateId: grant.delegateId,
      action: requestedAction,
      subjectId: requestedSubjectId,
      allowed: false,
      reason: "grant expired",
      decidedAt: nowIso,
    });
  }
  if (!grant.grantedActions.includes(requestedAction)) {
    return Object.freeze({
      grantId: grant.grantId,
      delegateId: grant.delegateId,
      action: requestedAction,
      subjectId: requestedSubjectId,
      allowed: false,
      reason: `action ${requestedAction} not in grant`,
      decidedAt: nowIso,
    });
  }
  if (
    grant.subjectScope.length > 0 &&
    requestedSubjectId !== null &&
    !grant.subjectScope.includes(requestedSubjectId)
  ) {
    return Object.freeze({
      grantId: grant.grantId,
      delegateId: grant.delegateId,
      action: requestedAction,
      subjectId: requestedSubjectId,
      allowed: false,
      reason: `subject ${requestedSubjectId} outside grant scope`,
      decidedAt: nowIso,
    });
  }
  return Object.freeze({
    grantId: grant.grantId,
    delegateId: grant.delegateId,
    action: requestedAction,
    subjectId: requestedSubjectId,
    allowed: true,
    reason: "grant active, action + subject in scope",
    decidedAt: nowIso,
  });
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface DelegatedTrustReport {
  readonly executedAt: string;
  readonly grantsEvaluated: number;
  readonly findings: readonly (
    | { readonly tag: "validation-error"; readonly grantId: string; readonly error: DelegationValidationError }
    | { readonly tag: "subgrant-violation"; readonly childGrantId: string; readonly violation: SubGrantViolation }
  )[];
  readonly hasCiGatingCondition: boolean;
}

export function buildDelegatedTrustReport(
  grants: readonly DelegationGrant[],
  nowIso: string,
): DelegatedTrustReport {
  const findings: DelegatedTrustReport["findings"][number][] = [];
  let gating = false;
  const byId = new Map<string, DelegationGrant>();
  for (const g of grants) byId.set(g.grantId, g);

  for (const g of grants) {
    for (const e of validateDelegationGrant(g)) {
      findings.push({ tag: "validation-error", grantId: g.grantId, error: e });
      gating = true;
    }
    if (g.parentGrantId) {
      const parent = byId.get(g.parentGrantId);
      if (parent) {
        // Compute ancestry depth
        let depth = 0;
        let cursor: DelegationGrant | undefined = parent;
        while (cursor && cursor.parentGrantId) {
          depth += 1;
          if (depth > MAX_DELEGATION_DEPTH * 2) break; // cycle safety
          cursor = byId.get(cursor.parentGrantId);
        }
        for (const v of validateSubGrant(parent, g, depth)) {
          findings.push({ tag: "subgrant-violation", childGrantId: g.grantId, violation: v });
          gating = true;
        }
      }
    }
  }

  return Object.freeze({
    executedAt: nowIso,
    grantsEvaluated: grants.length,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
