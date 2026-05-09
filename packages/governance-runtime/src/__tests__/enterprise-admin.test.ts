import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTIONS,
  buildEnterpriseGovernanceReport,
  decideAuthorization,
  ENTERPRISE_ROLES,
  parseEnterpriseRole,
  validateOrgPolicy,
  type OrgGovernancePolicy,
} from "../enterprise-admin.js";

describe("W2-PR47A — roles + parser", () => {
  it("ENTERPRISE_ROLES has 5 roles", () => expect(ENTERPRISE_ROLES.length).toBe(5));
  it("parseEnterpriseRole fail-closes on unknown", () => {
    expect(parseEnterpriseRole("ORG_OWNER")).toBe("ORG_OWNER");
    expect(parseEnterpriseRole("ROOT")).toBeNull();
    expect(parseEnterpriseRole(undefined)).toBeNull();
  });
});

describe("W2-PR47A — authorization decisions (fail-closed)", () => {
  it("OBSERVER cannot INITIATE_OVERRIDE", () => {
    const d = decideAuthorization({ action: "INITIATE_OVERRIDE", actorId: "u1", role: "OBSERVER", nowIso: "2026-05-09T00:00:00Z" });
    expect(d.allowed).toBe(false);
  });
  it("ORG_OWNER may MUTATE_KERNEL_BASELINE", () => {
    const d = decideAuthorization({ action: "MUTATE_KERNEL_BASELINE", actorId: "u1", role: "ORG_OWNER", nowIso: "2026-05-09T00:00:00Z" });
    expect(d.allowed).toBe(true);
  });
  it("VERIFIER_ADMIN may EXPORT_AUDIT_RECEIPT but not MUTATE_KERNEL_BASELINE", () => {
    expect(decideAuthorization({ action: "EXPORT_AUDIT_RECEIPT", actorId: "u", role: "VERIFIER_ADMIN", nowIso: "2026-05-09T00:00:00Z" }).allowed).toBe(true);
    expect(decideAuthorization({ action: "MUTATE_KERNEL_BASELINE", actorId: "u", role: "VERIFIER_ADMIN", nowIso: "2026-05-09T00:00:00Z" }).allowed).toBe(false);
  });
  it("unknown role denies all (fail-closed)", () => {
    for (const a of ADMIN_ACTIONS) {
      const d = decideAuthorization({ action: a, actorId: "u", role: "ROOT", nowIso: "2026-05-09T00:00:00Z" });
      expect(d.allowed).toBe(false);
    }
  });
  it("decision returns audit-row-shaped record", () => {
    const d = decideAuthorization({ action: "READ_GOVERNANCE_STATE", actorId: "u1", role: "OBSERVER", nowIso: "2026-05-09T00:00:00Z" });
    expect(d.action).toBe("READ_GOVERNANCE_STATE");
    expect(d.actorId).toBe("u1");
    expect(d.decidedAt).toBe("2026-05-09T00:00:00Z");
    expect(d.reason).toBeTruthy();
  });
});

describe("W2-PR47A — org policy validators", () => {
  function policy(o: Partial<OrgGovernancePolicy> = {}): OrgGovernancePolicy {
    return {
      orgId: "org-1",
      maxOverrideDurationMsCeiling: 24 * 60 * 60 * 1000,
      criticalOverrideMinReviewers: 2,
      testOverrideAllowedInProduction: false,
      ambiguitySuppressionAllowed: false,
      ...o,
    };
  }
  it("clean policy passes", () => expect(validateOrgPolicy(policy())).toEqual([]));
  it("duration ceiling > 30 days rejected", () => {
    const e = validateOrgPolicy(policy({ maxOverrideDurationMsCeiling: 60 * 24 * 60 * 60 * 1000 }));
    expect(e.some((x) => x.tag === "duration-ceiling-exceeds-kernel-max")).toBe(true);
  });
  it("critical reviewers < 2 rejected", () => {
    const e = validateOrgPolicy(policy({ criticalOverrideMinReviewers: 1 }));
    expect(e.some((x) => x.tag === "critical-min-reviewers-too-low")).toBe(true);
  });
  it("ambiguity suppression toggle cannot be true (rule preservation)", () => {
    const e = validateOrgPolicy({ ...policy(), ambiguitySuppressionAllowed: true as never });
    expect(e.some((x) => x.tag === "ambiguity-suppression-not-allowed")).toBe(true);
  });
  it("test-override-in-prod cannot be true", () => {
    const e = validateOrgPolicy({ ...policy(), testOverrideAllowedInProduction: true as never });
    expect(e.some((x) => x.tag === "test-override-in-production-not-allowed")).toBe(true);
  });
});

describe("W2-PR47A — CI gate", () => {
  it("clean policy fleet → no gating", () => {
    const r = buildEnterpriseGovernanceReport(
      [
        {
          orgId: "org-1",
          maxOverrideDurationMsCeiling: 24 * 60 * 60 * 1000,
          criticalOverrideMinReviewers: 2,
          testOverrideAllowedInProduction: false,
          ambiguitySuppressionAllowed: false,
        },
      ],
      "2026-05-09T00:00:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(false);
  });

  it("CHAOS: bad policy → gating fires", () => {
    const r = buildEnterpriseGovernanceReport(
      [
        {
          orgId: "org-bad",
          maxOverrideDurationMsCeiling: 365 * 24 * 60 * 60 * 1000,
          criticalOverrideMinReviewers: 1,
          testOverrideAllowedInProduction: false,
          ambiguitySuppressionAllowed: false,
        },
      ],
      "2026-05-09T00:00:00Z",
    );
    expect(r.hasCiGatingCondition).toBe(true);
  });
});
