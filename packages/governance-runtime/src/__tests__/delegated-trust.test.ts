import { describe, expect, it } from "vitest";
import {
  buildDelegatedTrustReport,
  computeGrantId,
  decideDelegationAccess,
  DELEGATION_LIFECYCLE,
  MAX_DELEGATION_DEPTH,
  MAX_DELEGATION_DURATION_MS,
  validateDelegationGrant,
  validateSubGrant,
  type DelegationGrant,
} from "../delegated-trust.js";

function grant(o: Partial<DelegationGrant> = {}): DelegationGrant {
  const base = {
    delegatorId: "u-owner",
    delegateId: "u-reviewer",
    grantedActions: ["READ_GOVERNANCE_STATE", "READ_REPLAY_LINEAGE"] as const,
    subjectScope: ["org:acme"] as const,
    issuedAt: "2026-05-09T00:00:00Z",
    expiresAt: "2026-05-12T00:00:00Z",
    parentGrantId: null,
  };
  return {
    grantId: computeGrantId(base),
    state: "ACTIVE",
    stateReason: null,
    ...base,
    ...o,
  };
}

describe("W2-PR53A — taxonomy + receipt", () => {
  it("DELEGATION_LIFECYCLE has 4 states", () => {
    expect(DELEGATION_LIFECYCLE.length).toBe(4);
    expect(DELEGATION_LIFECYCLE).toContain("ESCALATED");
  });
  it("computeGrantId is order-independent (canonicalization)", () => {
    const a = computeGrantId({ delegatorId: "a", delegateId: "b", grantedActions: ["READ_GOVERNANCE_STATE", "READ_REPLAY_LINEAGE"], subjectScope: ["x", "y"], issuedAt: "2026-05-09T00:00:00Z", expiresAt: "2026-05-10T00:00:00Z", parentGrantId: null });
    const b = computeGrantId({ delegatorId: "a", delegateId: "b", grantedActions: ["READ_REPLAY_LINEAGE", "READ_GOVERNANCE_STATE"], subjectScope: ["y", "x"], issuedAt: "2026-05-09T00:00:00Z", expiresAt: "2026-05-10T00:00:00Z", parentGrantId: null });
    expect(a).toBe(b);
  });
});

describe("W2-PR53A — validators", () => {
  it("clean grant passes", () => expect(validateDelegationGrant(grant())).toEqual([]));
  it("self-delegation rejected", () => {
    const e = validateDelegationGrant({ ...grant({ delegateId: "u-owner" }) });
    // Need to recompute id since delegate changed
    const fixed = grant({ delegateId: "u-owner" });
    const e2 = validateDelegationGrant({ ...fixed, grantId: computeGrantId({ ...fixed, parentGrantId: fixed.parentGrantId ?? null }) });
    expect(e2.some((x) => x.tag === "self-delegation-forbidden")).toBe(true);
    expect(e.length).toBeGreaterThan(0);
  });
  it("duration > 14 days rejected", () => {
    const g = grant({ expiresAt: "2026-06-09T00:00:00Z" });
    const e = validateDelegationGrant({ ...g, grantId: computeGrantId({ ...g, parentGrantId: null }) });
    expect(e.some((x) => x.tag === "duration-exceeds-max")).toBe(true);
  });
  it("expires-before-issued rejected", () => {
    const g = grant({ expiresAt: "2026-05-08T00:00:00Z" });
    const e = validateDelegationGrant({ ...g, grantId: computeGrantId({ ...g, parentGrantId: null }) });
    expect(e.some((x) => x.tag === "expires-before-issued")).toBe(true);
  });
  it("REVOKED without reason flagged", () => {
    const g = grant({ state: "REVOKED" });
    const e = validateDelegationGrant(g);
    expect(e.some((x) => x.tag === "state-requires-reason")).toBe(true);
  });
  it("grant-id mismatch detected", () => {
    const g = grant();
    const tampered = { ...g, grantId: "deadbeef" };
    const e = validateDelegationGrant(tampered);
    expect(e.some((x) => x.tag === "grant-id-mismatch")).toBe(true);
  });
});

describe("W2-PR53A — bounded re-delegation", () => {
  it("child action not in parent → flagged", () => {
    const parent = grant();
    const child = grant({
      delegatorId: parent.delegateId,
      delegateId: "u-junior",
      grantedActions: ["MUTATE_KERNEL_BASELINE"] as const,
      parentGrantId: parent.grantId,
    });
    const childWithId = { ...child, grantId: computeGrantId({ ...child, parentGrantId: parent.grantId }) };
    const v = validateSubGrant(parent, childWithId, 0);
    expect(v.some((x) => x.tag === "action-not-in-parent")).toBe(true);
  });

  it("child subject outside parent scope → flagged", () => {
    const parent = grant();
    const child = grant({
      delegatorId: parent.delegateId,
      delegateId: "u-junior",
      subjectScope: ["org:foreign"],
      parentGrantId: parent.grantId,
    });
    const v = validateSubGrant(parent, child, 0);
    expect(v.some((x) => x.tag === "subject-not-in-parent-scope")).toBe(true);
  });

  it("child expires past parent → flagged", () => {
    const parent = grant();
    const child = grant({
      delegatorId: parent.delegateId,
      delegateId: "u-junior",
      expiresAt: "2026-05-13T00:00:00Z",
      parentGrantId: parent.grantId,
    });
    const v = validateSubGrant(parent, child, 0);
    expect(v.some((x) => x.tag === "expiration-extends-past-parent")).toBe(true);
  });

  it("depth > MAX_DELEGATION_DEPTH → flagged", () => {
    const parent = grant();
    const child = grant({ parentGrantId: parent.grantId });
    const v = validateSubGrant(parent, child, MAX_DELEGATION_DEPTH);
    expect(v.some((x) => x.tag === "depth-exceeded")).toBe(true);
  });
});

describe("W2-PR53A — decision (fail-closed)", () => {
  it("inactive grant denies", () => {
    const g = grant({ state: "REVOKED", stateReason: "operator removed" });
    const d = decideDelegationAccess({ grant: g, requestedAction: "READ_GOVERNANCE_STATE", requestedSubjectId: "org:acme", nowIso: "2026-05-10T00:00:00Z" });
    expect(d.allowed).toBe(false);
  });
  it("expired grant denies", () => {
    const g = grant();
    const d = decideDelegationAccess({ grant: g, requestedAction: "READ_GOVERNANCE_STATE", requestedSubjectId: "org:acme", nowIso: "2026-05-20T00:00:00Z" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/expired/);
  });
  it("subject outside scope denies", () => {
    const g = grant();
    const d = decideDelegationAccess({ grant: g, requestedAction: "READ_GOVERNANCE_STATE", requestedSubjectId: "org:foreign", nowIso: "2026-05-10T00:00:00Z" });
    expect(d.allowed).toBe(false);
  });
  it("action not in grant denies", () => {
    const g = grant();
    const d = decideDelegationAccess({ grant: g, requestedAction: "MUTATE_KERNEL_BASELINE", requestedSubjectId: "org:acme", nowIso: "2026-05-10T00:00:00Z" });
    expect(d.allowed).toBe(false);
  });
  it("active + in-scope → allow", () => {
    const g = grant();
    const d = decideDelegationAccess({ grant: g, requestedAction: "READ_GOVERNANCE_STATE", requestedSubjectId: "org:acme", nowIso: "2026-05-10T00:00:00Z" });
    expect(d.allowed).toBe(true);
  });
});

describe("W2-PR53A — CI gate + chaos", () => {
  it("clean grants → no gating", () => {
    const r = buildDelegatedTrustReport([grant()], "2026-05-10T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
  });
  it("CHAOS: child trying to elevate beyond parent fires gating", () => {
    const parent = grant();
    const child = grant({
      delegatorId: parent.delegateId,
      delegateId: "u-junior",
      grantedActions: ["MUTATE_KERNEL_BASELINE"] as const,
      parentGrantId: parent.grantId,
    });
    const childWithId = { ...child, grantId: computeGrantId({ ...child, parentGrantId: parent.grantId }) };
    const r = buildDelegatedTrustReport([parent, childWithId], "2026-05-10T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
    expect(r.findings.some((f) => f.tag === "subgrant-violation")).toBe(true);
  });
});
