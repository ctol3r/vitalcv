/**
 * Delegation revocation cascades (W2-PR63A).
 *
 * Pure cascade computation: given a set of DelegationGrants and a
 * revocation event, derive the deterministic descendant set that must
 * also revoke. Replay-safe (deterministic given identical input).
 */

import type { DelegationGrant } from "./delegated-trust.js";

export interface RevocationEvent {
  readonly revokedGrantId: string;
  readonly reason: string;
  readonly revokedAt: string;
}

export interface CascadeResult {
  readonly revokedGrantId: string;
  readonly directlyRevoked: readonly string[];
  readonly cascadeRevokedDescendants: readonly string[];
  readonly orphanedGrants: readonly string[];
  readonly blastRadiusScore: number; // 0..100
}

/**
 * Compute the descendant cascade set deterministically.
 *
 * Algorithm: BFS over (grant.parentGrantId === revoked.grantId), repeated
 * for each newly-discovered descendant.
 */
export function computeRevocationCascade(
  grants: readonly DelegationGrant[],
  event: RevocationEvent,
): CascadeResult {
  const childrenByParent = new Map<string, string[]>();
  for (const g of grants) {
    if (g.parentGrantId) {
      const arr = childrenByParent.get(g.parentGrantId) ?? [];
      arr.push(g.grantId);
      childrenByParent.set(g.parentGrantId, arr);
    }
  }

  const direct = childrenByParent.get(event.revokedGrantId) ?? [];
  const seen = new Set<string>(direct);
  const stack: string[] = [...direct];
  const cascade: string[] = [];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    cascade.push(cur);
    for (const child of childrenByParent.get(cur) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        stack.push(child);
      }
    }
  }

  // Orphans: grants whose ancestry includes the revoked grant but were
  // already in non-ACTIVE state — they don't need fresh revocation but
  // are listed for audit.
  const orphans = grants
    .filter((g) => seen.has(g.grantId) && g.state !== "ACTIVE")
    .map((g) => g.grantId);

  const blast = Math.min(100, cascade.length * 10);

  return Object.freeze({
    revokedGrantId: event.revokedGrantId,
    directlyRevoked: Object.freeze([...direct]),
    cascadeRevokedDescendants: Object.freeze(cascade),
    orphanedGrants: Object.freeze(orphans),
    blastRadiusScore: blast,
  });
}

export interface RevocationCascadeReport {
  readonly executedAt: string;
  readonly cascade: CascadeResult;
  readonly findings: readonly (
    | { readonly tag: "uncollapsed-descendant-active"; readonly grantId: string }
    | { readonly tag: "high-blast-radius"; readonly score: number }
  )[];
  readonly hasCiGatingCondition: boolean;
}

export function buildRevocationCascadeReport(
  grants: readonly DelegationGrant[],
  event: RevocationEvent,
  nowIso: string,
): RevocationCascadeReport {
  const cascade = computeRevocationCascade(grants, event);
  const findings: RevocationCascadeReport["findings"][number][] = [];
  let gating = false;
  // Any descendant that is still ACTIVE in the input means revocation
  // hasn't yet been applied — this is the CI signal to the orchestrator
  // that the cascade is incomplete.
  const grantById = new Map<string, DelegationGrant>();
  for (const g of grants) grantById.set(g.grantId, g);
  for (const id of cascade.cascadeRevokedDescendants) {
    const g = grantById.get(id);
    if (g && g.state === "ACTIVE") {
      findings.push({ tag: "uncollapsed-descendant-active", grantId: id });
      gating = true;
    }
  }
  if (cascade.blastRadiusScore >= 60) {
    findings.push({ tag: "high-blast-radius", score: cascade.blastRadiusScore });
  }
  return Object.freeze({
    executedAt: nowIso,
    cascade,
    findings: Object.freeze(findings),
    hasCiGatingCondition: gating,
  });
}
