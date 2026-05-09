/**
 * Governance exception registry (W2-PR24A target 2).
 *
 * Doctrine: docs/ops/constitutional-override-governance.md (the closest
 * existing primitive — but exceptions are GOVERNANCE-tooling-level, not
 * operational-override-level).
 *
 * Per W2-PR24A non-negotiable rule #3: exceptions must remain visible +
 * temporary.
 *
 * This module exposes the SHAPE for governance exceptions used by CI
 * scanners. The actual exception list is data-only (typically a checked-in
 * JSON or YAML file consumed by scanners). This module provides
 * type-safety + validation for that data.
 */

export const EXCEPTION_SEVERITY = ["BLOCKING", "WARNING", "INFO", "LEGACY", "EXPERIMENTAL"] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITY)[number];

export const EXCEPTION_KIND = [
  "lexicon-allowlist",
  "adoption-allowlist",
  "deferred-cleanup",
  "legacy-grandfather",
  "experimental-suppression",
] as const;
export type ExceptionKind = (typeof EXCEPTION_KIND)[number];

export interface GovernanceException {
  /** Unique identifier (e.g., "EXC-2026-001"). */
  readonly id: string;
  /** Exception kind — what scanner / surface this applies to. */
  readonly kind: ExceptionKind;
  /** Severity downgrade applied via this exception. */
  readonly severity: ExceptionSeverity;
  /** File-path prefix OR exact match the exception covers. */
  readonly scopePath: string;
  /** Specific phrase or violation tag this exception suppresses ("*" = all). */
  readonly scopeLabel: string;
  /** Operator-readable justification (REQUIRED; no silent allowlist). */
  readonly justification: string;
  /** Expiration date (ISO-8601 UTC date). */
  readonly expiresAt: string;
  /** Owner (name or role). */
  readonly owner: string;
  /** Approver (founder OR delegate name). */
  readonly approver: string;
  /** Approval timestamp (ISO-8601 UTC). */
  readonly approvedAt: string;
  /** Optional cross-reference (drift-registry id, audit-log entry). */
  readonly crossReference?: string;
}

export type ExceptionValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof GovernanceException }
  | { readonly tag: "expired"; readonly expiresAt: string; readonly now: string }
  | { readonly tag: "expiration-too-far-out"; readonly maxDays: number; readonly actualDays: number }
  | { readonly tag: "invalid-id-format"; readonly id: string };

const EXCEPTION_ID_REGEX = /^EXC-\d{4}-\d{3,5}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/;

/**
 * Maximum allowed exception duration: 90 days.
 * Per W2-PR24A non-negotiable rule #3: exceptions are TEMPORARY.
 * Longer-than-90-day exceptions require explicit founder + Codex SAFE.
 */
export const MAX_EXCEPTION_DURATION_DAYS = 90;

export function validateException(
  exc: Partial<GovernanceException>,
  nowIso: string,
): readonly ExceptionValidationError[] {
  const errors: ExceptionValidationError[] = [];

  const required: ReadonlyArray<keyof GovernanceException> = [
    "id",
    "kind",
    "severity",
    "scopePath",
    "scopeLabel",
    "justification",
    "expiresAt",
    "owner",
    "approver",
    "approvedAt",
  ];
  for (const field of required) {
    const value = exc[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ tag: "missing-field", field });
    }
  }

  if (typeof exc.id === "string" && !EXCEPTION_ID_REGEX.test(exc.id)) {
    errors.push({ tag: "invalid-id-format", id: exc.id });
  }

  if (typeof exc.expiresAt === "string" && ISO_DATE_REGEX.test(exc.expiresAt)) {
    const expiresMs = Date.parse(exc.expiresAt);
    const nowMs = Date.parse(nowIso);
    if (Number.isFinite(expiresMs) && Number.isFinite(nowMs)) {
      if (expiresMs < nowMs) {
        errors.push({ tag: "expired", expiresAt: exc.expiresAt, now: nowIso });
      }
      const approvedMs =
        typeof exc.approvedAt === "string" && ISO_DATE_REGEX.test(exc.approvedAt)
          ? Date.parse(exc.approvedAt)
          : nowMs;
      const durationDays = (expiresMs - approvedMs) / (24 * 60 * 60 * 1000);
      if (durationDays > MAX_EXCEPTION_DURATION_DAYS) {
        errors.push({
          tag: "expiration-too-far-out",
          maxDays: MAX_EXCEPTION_DURATION_DAYS,
          actualDays: Math.round(durationDays),
        });
      }
    }
  }

  return errors;
}

/**
 * Severity-classification helper. Maps a violation tag to default severity.
 *
 * Per W2-PR24A target 1:
 *   - replay inflation = BLOCKING
 *   - local governance enums = BLOCKING
 *   - migration surfaces = WARNING
 *   - legacy tolerated surfaces = LEGACY
 *
 * Caller can override with explicit exception entry.
 */
export function defaultSeverityForTag(tag: string): ExceptionSeverity {
  switch (tag) {
    case "missing-registry-import":
    case "duplicate-literal":
      return "BLOCKING";
    case "ad-hoc-rendering":
      return "BLOCKING";
    case "lexicon-violation":
      return "BLOCKING";
    case "migration-surface":
      return "WARNING";
    case "legacy-grandfathered":
      return "LEGACY";
    case "experimental":
      return "EXPERIMENTAL";
    default:
      return "WARNING";
  }
}

/**
 * Per W2-PR24A target 4: actionable remediation guidance per violation tag.
 */
export function remediationGuidance(tag: string, context?: { phrase?: string; literal?: string }): string {
  switch (tag) {
    case "missing-registry-import":
      return (
        `Add 'import { ... } from \"@vitalcv/governance-runtime\";' AND replace local literals with imported types. ` +
        `See packages/governance-runtime/src/index.ts for available exports.`
      );
    case "ad-hoc-rendering":
      return (
        `Replace local rendering with approved primitives from apps/web/components/governance/: ` +
        `IntegrityBadge, TrustClassBadge, ReplayWarning, UnknownStateBanner.`
      );
    case "duplicate-literal":
      return (
        `Remove the local literal definition; import from @vitalcv/governance-runtime. ` +
        `Per docs/ops/constitutional-enforcement-matrix.md: registry is single source of truth.`
      );
    case "lexicon-violation": {
      const phrase = context?.phrase ?? "<phrase>";
      return (
        `Forbidden phrase: "${phrase}". See docs/ops/operational-alias-layer.md §11 quick-reference for substitutions. ` +
        `If allowlist needed, propose entry per TRUST_GUARANTEE_LEXICON.md §6 update protocol (founder + Codex SAFE).`
      );
    }
    default:
      return `Consult docs/ops/constitutional-governance-runbook.md for the appropriate runbook scenario.`;
  }
}
