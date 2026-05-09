/**
 * Override audit logging primitives.
 *
 * Doctrine: docs/ops/constitutional-override-governance.md §2 + §4
 *
 * Mandatory fields per §2:
 *   Override ID, Override class, Specific drift, Scope, Approval
 *   requester, Approver, Approval timestamp, Expiration timestamp,
 *   Renewal policy, Survivability risk, Forensic risk, Constitutional
 *   impact, Closure plan.
 *
 * Override expiration: ≤ 30 days from approval.
 * Renewal max: 3 (per §6 + HF-8 normalization detection).
 */

export const OVERRIDE_CLASSES = ["OV-1", "OV-2", "OV-3", "OV-4"] as const;
export type OverrideClass = (typeof OVERRIDE_CLASSES)[number];

export const OVERRIDE_STATUS = ["ACTIVE", "EXPIRED", "RENEWED", "CLOSED"] as const;
export type OverrideStatus = (typeof OVERRIDE_STATUS)[number];

export const RENEWAL_POLICY = ["auto-expire", "renewal-required"] as const;
export type RenewalPolicy = (typeof RENEWAL_POLICY)[number];

/**
 * Maximum allowed renewals per `constitutional-override-governance.md` §6.
 * After this count, the override MUST be closed; further renewal is forbidden.
 */
export const MAX_RENEWALS = 3 as const;

/**
 * Maximum override duration from approval (30 days).
 * Per `constitutional-override-governance.md` §2.
 */
export const MAX_OVERRIDE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface OverrideAuditEntry {
  readonly overrideId: string; // UUID
  readonly overrideClass: OverrideClass;
  readonly specificDrift: string; // cross-reference to constitutional-drift-registry.md entry
  readonly scope: string; // affected surfaces / handlers / paths
  readonly approvalRequester: string;
  readonly approver: string; // founder
  readonly approvalTimestamp: string; // ISO-8601 UTC
  readonly expirationTimestamp: string; // ISO-8601 UTC
  readonly renewalPolicy: RenewalPolicy;
  readonly survivabilityRisk: string;
  readonly forensicRisk: string;
  readonly constitutionalImpact: string;
  readonly closurePlan: string;
  readonly status: OverrideStatus;
  readonly renewalCount: number; // monotonic; max MAX_RENEWALS
}

/**
 * Validation errors enumerated explicitly. Caller pattern-matches on tag.
 */
export type OverrideValidationError =
  | { readonly tag: "missing-field"; readonly field: keyof OverrideAuditEntry }
  | { readonly tag: "invalid-uuid"; readonly field: keyof OverrideAuditEntry; readonly value: string }
  | { readonly tag: "invalid-iso-timestamp"; readonly field: keyof OverrideAuditEntry; readonly value: string }
  | { readonly tag: "expiration-exceeds-max-duration"; readonly maxMs: number; readonly actualMs: number }
  | { readonly tag: "expiration-before-approval" }
  | { readonly tag: "renewal-count-exceeded"; readonly max: number; readonly actual: number };

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * Validate an override entry. Returns array of errors (empty array = valid).
 *
 * Pure validation. Does NOT mutate. Does NOT throw.
 */
export function validateOverrideEntry(
  entry: Partial<OverrideAuditEntry>,
): readonly OverrideValidationError[] {
  const errors: OverrideValidationError[] = [];

  // Required-field checks (per §2 mandatory fields)
  const requiredFields: readonly (keyof OverrideAuditEntry)[] = [
    "overrideId",
    "overrideClass",
    "specificDrift",
    "scope",
    "approvalRequester",
    "approver",
    "approvalTimestamp",
    "expirationTimestamp",
    "renewalPolicy",
    "survivabilityRisk",
    "forensicRisk",
    "constitutionalImpact",
    "closurePlan",
    "status",
    "renewalCount",
  ];

  for (const field of requiredFields) {
    const value = entry[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ tag: "missing-field", field });
    }
  }

  if (typeof entry.overrideId === "string" && !UUID_V4_REGEX.test(entry.overrideId)) {
    errors.push({ tag: "invalid-uuid", field: "overrideId", value: entry.overrideId });
  }

  if (typeof entry.approvalTimestamp === "string" && !RFC3339_UTC_REGEX.test(entry.approvalTimestamp)) {
    errors.push({
      tag: "invalid-iso-timestamp",
      field: "approvalTimestamp",
      value: entry.approvalTimestamp,
    });
  }
  if (typeof entry.expirationTimestamp === "string" && !RFC3339_UTC_REGEX.test(entry.expirationTimestamp)) {
    errors.push({
      tag: "invalid-iso-timestamp",
      field: "expirationTimestamp",
      value: entry.expirationTimestamp,
    });
  }

  // Expiration window checks
  if (
    typeof entry.approvalTimestamp === "string" &&
    typeof entry.expirationTimestamp === "string" &&
    RFC3339_UTC_REGEX.test(entry.approvalTimestamp) &&
    RFC3339_UTC_REGEX.test(entry.expirationTimestamp)
  ) {
    const approval = Date.parse(entry.approvalTimestamp);
    const expiration = Date.parse(entry.expirationTimestamp);
    if (Number.isFinite(approval) && Number.isFinite(expiration)) {
      if (expiration < approval) {
        errors.push({ tag: "expiration-before-approval" });
      }
      const durationMs = expiration - approval;
      if (durationMs > MAX_OVERRIDE_DURATION_MS) {
        errors.push({
          tag: "expiration-exceeds-max-duration",
          maxMs: MAX_OVERRIDE_DURATION_MS,
          actualMs: durationMs,
        });
      }
    }
  }

  // Renewal-count check
  if (typeof entry.renewalCount === "number" && entry.renewalCount > MAX_RENEWALS) {
    errors.push({ tag: "renewal-count-exceeded", max: MAX_RENEWALS, actual: entry.renewalCount });
  }

  return errors;
}

/**
 * Forbidden override patterns per §7.
 * Returns reason string if pattern detected; null if clean.
 */
export function detectForbiddenOverridePattern(scope: string): string | null {
  const lc = scope.toLowerCase();
  if (lc.includes("permanent")) return "permanent override forbidden — overrides MUST expire";
  if (lc.includes("until further notice")) return "'until further notice' is permanent-equivalent — forbidden";
  if (lc.includes("verbal approval")) return "verbal approval forbidden — must be in audit log with timestamp";
  if (lc.includes("implicit")) return "implicit override forbidden — must be explicit + audited";
  return null;
}
