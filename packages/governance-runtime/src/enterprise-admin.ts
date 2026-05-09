/**
 * Enterprise admin + governance controls (W2-PR47A).
 *
 * Org-level RBAC + governance policy primitives. Pure data model +
 * authorization decisions. The web/API layer enforces.
 *
 * Non-negotiable:
 *   - role boundaries enforced (least-privilege default)
 *   - replay access auditable (every replay-data access produces a
 *     decision record)
 *   - override administration replay-safe
 *   - governance mutations constrained (kernel-freeze + adoption rules)
 *   - ambiguity visibility preserved
 *   - fail-closed admin semantics (unknown role → deny)
 */

// ---------------------------------------------------------------------------
// Roles + actions
// ---------------------------------------------------------------------------

export const ENTERPRISE_ROLES = [
  "ORG_OWNER",
  "GOVERNANCE_ADMIN",
  "VERIFIER_ADMIN",
  "VERIFIER_REVIEWER",
  "OBSERVER",
] as const;
export type EnterpriseRole = (typeof ENTERPRISE_ROLES)[number];

export const ADMIN_ACTIONS = [
  "READ_GOVERNANCE_STATE",
  "READ_REPLAY_LINEAGE",
  "EXPORT_AUDIT_RECEIPT",
  "INITIATE_OVERRIDE",
  "APPROVE_OVERRIDE_RENEWAL",
  "REVOKE_OVERRIDE",
  "ESCALATE_AMBIGUITY",
  "RESOLVE_INCIDENT",
  "MUTATE_ORG_POLICY",
  "MUTATE_KERNEL_BASELINE",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/**
 * Role → allowed actions matrix. Anything not listed is denied (fail-closed).
 *
 * Notes:
 *   - MUTATE_KERNEL_BASELINE is reserved for ORG_OWNER + GOVERNANCE_ADMIN.
 *   - INITIATE_OVERRIDE is restricted; founder-tier OverrideKindProfile
 *     also enforces founder approval at the discipline layer.
 *   - OBSERVER is read-only.
 */
const ROLE_MATRIX: Readonly<Record<EnterpriseRole, ReadonlySet<AdminAction>>> = Object.freeze({
  ORG_OWNER: new Set<AdminAction>([
    "READ_GOVERNANCE_STATE",
    "READ_REPLAY_LINEAGE",
    "EXPORT_AUDIT_RECEIPT",
    "INITIATE_OVERRIDE",
    "APPROVE_OVERRIDE_RENEWAL",
    "REVOKE_OVERRIDE",
    "ESCALATE_AMBIGUITY",
    "RESOLVE_INCIDENT",
    "MUTATE_ORG_POLICY",
    "MUTATE_KERNEL_BASELINE",
  ]),
  GOVERNANCE_ADMIN: new Set<AdminAction>([
    "READ_GOVERNANCE_STATE",
    "READ_REPLAY_LINEAGE",
    "EXPORT_AUDIT_RECEIPT",
    "INITIATE_OVERRIDE",
    "APPROVE_OVERRIDE_RENEWAL",
    "REVOKE_OVERRIDE",
    "ESCALATE_AMBIGUITY",
    "RESOLVE_INCIDENT",
    "MUTATE_ORG_POLICY",
    "MUTATE_KERNEL_BASELINE",
  ]),
  VERIFIER_ADMIN: new Set<AdminAction>([
    "READ_GOVERNANCE_STATE",
    "READ_REPLAY_LINEAGE",
    "EXPORT_AUDIT_RECEIPT",
    "ESCALATE_AMBIGUITY",
    "RESOLVE_INCIDENT",
  ]),
  VERIFIER_REVIEWER: new Set<AdminAction>([
    "READ_GOVERNANCE_STATE",
    "READ_REPLAY_LINEAGE",
    "ESCALATE_AMBIGUITY",
  ]),
  OBSERVER: new Set<AdminAction>([
    "READ_GOVERNANCE_STATE",
  ]),
});

export function parseEnterpriseRole(s: unknown): EnterpriseRole | null {
  if (typeof s !== "string") return null;
  return (ENTERPRISE_ROLES as readonly string[]).includes(s) ? (s as EnterpriseRole) : null;
}

// ---------------------------------------------------------------------------
// Authorization decision
// ---------------------------------------------------------------------------

export interface AuthorizationDecision {
  readonly action: AdminAction;
  readonly actorId: string;
  readonly role: EnterpriseRole | null;
  readonly allowed: boolean;
  readonly reason: string;
  readonly decidedAt: string;
}

/**
 * Pure authorization decision. Unknown role → deny (fail-closed).
 *
 * The decision is intentionally returned as a record (not just a bool)
 * so callers can persist it as an audit row.
 */
export function decideAuthorization(input: {
  readonly action: AdminAction;
  readonly actorId: string;
  readonly role: unknown;
  readonly nowIso: string;
}): AuthorizationDecision {
  const role = parseEnterpriseRole(input.role);
  if (role === null) {
    return Object.freeze({
      action: input.action,
      actorId: input.actorId,
      role: null,
      allowed: false,
      reason: "unknown role; fail-closed deny",
      decidedAt: input.nowIso,
    });
  }
  const allowed = ROLE_MATRIX[role].has(input.action);
  return Object.freeze({
    action: input.action,
    actorId: input.actorId,
    role,
    allowed,
    reason: allowed
      ? `role ${role} permits ${input.action}`
      : `role ${role} does not permit ${input.action}`,
    decidedAt: input.nowIso,
  });
}

// ---------------------------------------------------------------------------
// Org governance policy
// ---------------------------------------------------------------------------

export interface OrgGovernancePolicy {
  readonly orgId: string;
  /** Maximum override duration override (must be ≤ kernel maxDurationMs per kind). */
  readonly maxOverrideDurationMsCeiling: number;
  /** Required reviewer count for OV-1 / EXECUTIVE_EXCEPTION (≥ 2 enforces dual control). */
  readonly criticalOverrideMinReviewers: number;
  /** Whether this org permits TEST_OVERRIDE in production (must be false). */
  readonly testOverrideAllowedInProduction: false;
  /** Org-level ambiguity-suppression toggle — must be false (rule preservation). */
  readonly ambiguitySuppressionAllowed: false;
}

export type PolicyValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof OrgGovernancePolicy }
  | { readonly tag: "duration-ceiling-exceeds-kernel-max"; readonly value: number; readonly maxAllowedMs: number }
  | { readonly tag: "critical-min-reviewers-too-low"; readonly value: number }
  | { readonly tag: "test-override-in-production-not-allowed" }
  | { readonly tag: "ambiguity-suppression-not-allowed" };

const KERNEL_MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches override-audit MAX_OVERRIDE_DURATION_MS

export function validateOrgPolicy(p: Partial<OrgGovernancePolicy>): readonly PolicyValidationError[] {
  const errors: PolicyValidationError[] = [];
  for (const f of [
    "orgId",
    "maxOverrideDurationMsCeiling",
    "criticalOverrideMinReviewers",
    "testOverrideAllowedInProduction",
    "ambiguitySuppressionAllowed",
  ] as const) {
    if (p[f] === undefined || p[f] === null) errors.push({ tag: "missing-field", field: f });
  }
  if (typeof p.maxOverrideDurationMsCeiling === "number" && p.maxOverrideDurationMsCeiling > KERNEL_MAX_DURATION_MS) {
    errors.push({
      tag: "duration-ceiling-exceeds-kernel-max",
      value: p.maxOverrideDurationMsCeiling,
      maxAllowedMs: KERNEL_MAX_DURATION_MS,
    });
  }
  if (typeof p.criticalOverrideMinReviewers === "number" && p.criticalOverrideMinReviewers < 2) {
    errors.push({ tag: "critical-min-reviewers-too-low", value: p.criticalOverrideMinReviewers });
  }
  if (p.testOverrideAllowedInProduction === true) {
    errors.push({ tag: "test-override-in-production-not-allowed" });
  }
  if (p.ambiguitySuppressionAllowed === true) {
    errors.push({ tag: "ambiguity-suppression-not-allowed" });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export interface EnterpriseGovernanceReport {
  readonly executedAt: string;
  readonly policiesEvaluated: number;
  readonly findings: readonly { readonly tag: "validation-error"; readonly orgId: string; readonly error: PolicyValidationError }[];
  readonly hasCiGatingCondition: boolean;
}

export function buildEnterpriseGovernanceReport(
  policies: readonly OrgGovernancePolicy[],
  nowIso: string,
): EnterpriseGovernanceReport {
  const findings: EnterpriseGovernanceReport["findings"][number][] = [];
  let gating = false;
  for (const p of policies) {
    for (const e of validateOrgPolicy(p)) {
      findings.push({ tag: "validation-error", orgId: p.orgId, error: e });
      gating = true;
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    policiesEvaluated: policies.length,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
