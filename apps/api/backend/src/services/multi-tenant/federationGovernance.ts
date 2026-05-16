/**
 * federationGovernance.ts — W2-PR54A: Federated Governance Coordination
 *
 * Pure transforms enforcing the FEDERATION boundary on top of the tenant
 * boundary (W2-PR36A, tenantIsolation.ts). A federation is a named trust
 * boundary under which multiple tenants explicitly opt in to coordinate.
 * Federation membership is never implicit — it must be declared and
 * carry a tamper-evident attestation digest.
 *
 * Hard invariants (fail-closed):
 *   - A tenant is NOT in a federation unless its FederationMembership has
 *     been declared and is present in the membership set passed to the
 *     scope assertion. "Not in the set" is treated as "not in the federation",
 *     never as "implicit observer".
 *   - Cross-tenant lineage may only flow inside a single federation, and
 *     only between active members of that same federation.
 *   - A tenant claiming membership in two different federations within the
 *     same scope assertion is a hard violation (FEDERATION_MEMBERSHIP_AMBIGUOUS).
 *   - Trust synchronization across federation members fails closed when any
 *     member is missing or any member's view diverges by more than the
 *     declared tolerance — partial consensus is a violation, not a result.
 *   - Federation drift (members disagree about who is in the federation, or
 *     about the trust state of a shared subject) halts coordination — replay
 *     and sync return DEGRADED verdicts and assertion variants throw.
 *   - Ambiguity propagation is fan-out only across declared members; an
 *     ambiguity signature emitted for tenant T cannot leak to a tenant
 *     outside the federation.
 *   - Lineage digests, sync digests, drift digests, and ambiguity digests all
 *     hash the federationId — two federations CANNOT produce identical
 *     digests for the same payload.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the boundary
 * checker that other modules call before they replay, sync, or recover across
 * federated tenants.
 *
 * Layered above tenantIsolation.ts:
 *   single-tenant scope  ──▶  federation scope  ──▶  cross-tenant replay
 *   (W2-PR36A)                (W2-PR54A, here)         (only if scope is COORDINATED)
 */

import { sha256ForPayload } from '../../utils/deterministic';
import {
  normalizeTenantId,
  type TenantId,
} from './tenantIsolation';

// ── Types ─────────────────────────────────────────────────────────────────────

export type FederationId = string;

export type FederationViolationKind =
  | 'UNDECLARED_FEDERATION'
  | 'CROSS_FEDERATION_BLEED'
  | 'FEDERATION_MEMBERSHIP_AMBIGUOUS'
  | 'FEDERATION_DRIFT'
  | 'FEDERATION_REPLAY_LEAK'
  | 'TRUST_SYNC_DIVERGENCE'
  | 'FEDERATION_RECOVERY_BREACH'
  | 'FEDERATION_BLAST_RADIUS_BREACH'
  | 'AMBIGUITY_PROPAGATION_LEAK';

export class FederationGovernanceError extends Error {
  readonly code = 'FEDERATION_GOVERNANCE_VIOLATION' as const;
  readonly violation: FederationViolationKind;
  readonly federationId: FederationId | null;
  readonly tenantIds: readonly TenantId[];

  constructor(args: {
    violation: FederationViolationKind;
    message: string;
    federationId?: FederationId | null;
    tenantIds?: readonly TenantId[];
  }) {
    super(args.message);
    this.name = 'FederationGovernanceError';
    this.violation = args.violation;
    this.federationId = args.federationId ?? null;
    this.tenantIds = args.tenantIds ?? [];
  }
}

export type FederationVerdict = 'BOUNDED' | 'COORDINATED' | 'DEGRADED' | 'FAILED';

export type FederationMembershipRole = 'member' | 'observer' | 'arbiter';

export interface FederationMembership {
  schema: 'vitalcv.federation-membership.v1';
  federationId: FederationId;
  tenantId: TenantId;
  role: FederationMembershipRole;
  joinedAt: string;
  /** SHA-256 over (federationId, tenantId, role, joinedAt) — tamper-evident proof of declared membership. */
  attestationDigest: string;
}

export interface FederationScope {
  schema: 'vitalcv.federation-scope.v1';
  federationId: FederationId | null;
  primaryTenantId: TenantId;
  /** Sorted, deduplicated, never includes primaryTenantId. */
  participantTenantIds: TenantId[];
  verdict: FederationVerdict;
  /** SHA-256 over (federationId, primary, sorted participants, mode). */
  boundaryDigest: string;
  partitionedAt: string;
}

export interface FederatedReplayLineage {
  schema: 'vitalcv.federation-lineage.v1';
  federationId: FederationId;
  primaryTenantId: TenantId;
  /** Sorted, deduplicated, never includes primaryTenantId. */
  participantTenantIds: TenantId[];
  /** Capsule IDs included in the lineage, ordered as input then deduplicated. */
  capsuleIds: string[];
  /** Capsule IDs that were rejected from the lineage as outside the federation. */
  rejectedCapsuleIds: string[];
  /** Reasons keyed by rejected capsule id. */
  rejectedReasons: Record<string, string>;
  /** SHA-256 over (federationId, primary, participants, capsuleIds, rejected). */
  lineageDigest: string;
  ambiguity: AmbiguitySignature[];
  reconstructedAt: string;
}

export type AmbiguityReason =
  | 'UNRESOLVED_TRUST'
  | 'CONFLICTING_EVIDENCE'
  | 'MISSING_MEMBER_VIEW'
  | 'POLICY_DISAGREEMENT';

export interface AmbiguitySignature {
  schema: 'vitalcv.federation-ambiguity.v1';
  federationId: FederationId;
  tenantId: TenantId;
  reason: AmbiguityReason;
  /** SHA-256 over (federationId, tenantId, reason, payload). */
  digest: string;
  emittedAt: string;
}

export interface MemberTrustView {
  tenantId: TenantId;
  trustScore: number;
  trustBand: string;
  capturedAt: string;
}

export interface TrustSyncState {
  schema: 'vitalcv.federation-trust-sync.v1';
  federationId: FederationId;
  members: TenantId[];
  consensusReached: boolean;
  /** Members whose view diverged beyond tolerance (sorted). Empty if consensus. */
  divergentMembers: TenantId[];
  /** Members expected by membership but missing from input (sorted). Empty if all present. */
  missingMembers: TenantId[];
  /** SHA-256 over (federationId, members, views, tolerance, consensus). */
  syncDigest: string;
  syncedAt: string;
}

export type FederationDriftKind =
  | 'MEMBERSHIP'
  | 'TRUST_SCORE'
  | 'POLICY'
  | 'TIMELINE'
  | 'EVIDENCE';

export interface FederationDriftSignature {
  schema: 'vitalcv.federation-drift-signature.v1';
  federationId: FederationId;
  divergence: FederationDriftKind;
  /** Members whose view diverged from the federation majority (sorted). */
  divergentMembers: TenantId[];
  /** SHA-256 over (federationId, divergence, divergentMembers, payload). */
  driftDigest: string;
  detectedAt: string;
}

export type FederationBlastTier =
  | 'SINGLE_TENANT'
  | 'FEDERATION_BOUNDED'
  | 'CROSS_FEDERATION_BREACH';

export interface FederationBlastRadius {
  schema: 'vitalcv.federation-blast-radius.v1';
  tier: FederationBlastTier;
  affectedFederations: string[];
  affectedTenantIds: string[];
  affectedCapsuleIds: string[];
  partitioned: boolean;
  containmentReason: string;
}

export interface FederationRecoveryDecision {
  schema: 'vitalcv.federation-recovery.v1';
  triggerCapsuleId: string;
  scopeFederationId: FederationId | null;
  scopeTenantId: TenantId;
  permittedCapsuleIds: string[];
  rejectedCapsuleIds: string[];
  rejectedReasons: Record<string, string>;
  reason: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NO_FEDERATION_SENTINEL = '__no_federation__';
const NO_TENANT_SENTINEL = '__no_tenant__';

export function normalizeFederationId(value: unknown): FederationId | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function sortedUnique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort();
}

function membershipKey(federationId: FederationId, tenantId: TenantId): string {
  return `${federationId}::${tenantId}`;
}

function indexMemberships(memberships: readonly FederationMembership[]): Map<string, FederationMembership> {
  const map = new Map<string, FederationMembership>();
  for (const m of memberships) {
    const fed = normalizeFederationId(m.federationId);
    const tenant = normalizeTenantId(m.tenantId);
    if (!fed || !tenant) continue;
    map.set(membershipKey(fed, tenant), m);
  }
  return map;
}

// ── Membership declaration ────────────────────────────────────────────────────

/**
 * Build a tamper-evident membership attestation. Pure: same inputs always
 * yield the same attestationDigest, so the same attestation cannot be
 * silently swapped for a different role or federation.
 */
export function declareMembership(input: {
  federationId: FederationId;
  tenantId: TenantId;
  role: FederationMembershipRole;
  joinedAt: string;
}): FederationMembership {
  const federationId = normalizeFederationId(input.federationId);
  const tenantId = normalizeTenantId(input.tenantId);
  if (!federationId || !tenantId) {
    throw new FederationGovernanceError({
      violation: 'UNDECLARED_FEDERATION',
      message: 'declareMembership requires both federationId and tenantId',
      federationId,
      tenantIds: tenantId ? [tenantId] : [],
    });
  }
  const attestationDigest = sha256ForPayload({
    schema: 'vitalcv.federation-membership.v1',
    federationId,
    tenantId,
    role: input.role,
    joinedAt: input.joinedAt,
  });
  return {
    schema: 'vitalcv.federation-membership.v1',
    federationId,
    tenantId,
    role: input.role,
    joinedAt: input.joinedAt,
    attestationDigest,
  };
}

export function federationBoundaryDigest(input: {
  federationId: FederationId | null;
  primaryTenantId: TenantId;
  participantTenantIds: readonly TenantId[];
  mode: 'BOUNDED' | 'COORDINATED';
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.federation-boundary.v1',
    federationId: input.federationId ?? NO_FEDERATION_SENTINEL,
    primaryTenantId: input.primaryTenantId,
    participantTenantIds: sortedUnique(input.participantTenantIds.filter(t => t !== input.primaryTenantId)),
    mode: input.mode,
  });
}

// ── Federation scope validator ────────────────────────────────────────────────

/**
 * Fail-closed federation scope validator.
 *
 *   mode          | federationId | participants | verdict
 *   --------------+--------------+--------------+----------------------------------
 *   BOUNDED       | any          | non-empty    | THROWS CROSS_FEDERATION_BLEED
 *   BOUNDED       | null         | empty        | BOUNDED (single tenant, no fed)
 *   BOUNDED       | set          | empty        | BOUNDED (single member of fed)
 *   COORDINATED   | null         | any          | THROWS UNDECLARED_FEDERATION
 *   COORDINATED   | set          | every active | COORDINATED
 *   COORDINATED   | set          | any missing  | THROWS UNDECLARED_FEDERATION
 *   COORDINATED   | set          | tenant in 2  | THROWS FEDERATION_MEMBERSHIP_AMBIGUOUS
 */
export function assertFederationScope(input: {
  federationId: FederationId | null;
  primaryTenantId: TenantId;
  participantTenantIds: readonly TenantId[];
  memberships: readonly FederationMembership[];
  mode: 'BOUNDED' | 'COORDINATED';
}): FederationScope {
  const partitionedAt = new Date().toISOString();
  const federationId = normalizeFederationId(input.federationId);
  const primary = normalizeTenantId(input.primaryTenantId);
  if (!primary) {
    throw new FederationGovernanceError({
      violation: 'UNDECLARED_FEDERATION',
      message: 'assertFederationScope requires a non-empty primaryTenantId',
      federationId,
    });
  }
  const participants = sortedUnique(
    input.participantTenantIds
      .map(t => normalizeTenantId(t))
      .filter((t): t is TenantId => Boolean(t) && t !== primary),
  );
  const boundaryDigest = federationBoundaryDigest({
    federationId,
    primaryTenantId: primary,
    participantTenantIds: participants,
    mode: input.mode,
  });

  // BOUNDED mode: single tenant or single-member-of-federation. Participants forbidden.
  if (input.mode === 'BOUNDED') {
    if (participants.length > 0) {
      throw new FederationGovernanceError({
        violation: 'CROSS_FEDERATION_BLEED',
        message: `BOUNDED scope cannot include participants; received ${participants.length}`,
        federationId,
        tenantIds: [primary, ...participants],
      });
    }
    return {
      schema: 'vitalcv.federation-scope.v1',
      federationId,
      primaryTenantId: primary,
      participantTenantIds: [],
      verdict: 'BOUNDED',
      boundaryDigest,
      partitionedAt,
    };
  }

  // COORDINATED mode requires explicit federationId.
  if (!federationId) {
    throw new FederationGovernanceError({
      violation: 'UNDECLARED_FEDERATION',
      message: 'COORDINATED scope requires a non-null federationId',
      federationId: null,
      tenantIds: [primary, ...participants],
    });
  }

  // Index memberships and check ambiguity (a tenant claiming to belong
  // to TWO federations in the same membership set is a hard violation,
  // even when only one of them is the active federationId).
  const seenInOtherFederation = new Map<TenantId, Set<FederationId>>();
  for (const m of input.memberships) {
    const fed = normalizeFederationId(m.federationId);
    const tenant = normalizeTenantId(m.tenantId);
    if (!fed || !tenant) continue;
    let set = seenInOtherFederation.get(tenant);
    if (!set) {
      set = new Set<FederationId>();
      seenInOtherFederation.set(tenant, set);
    }
    set.add(fed);
  }
  for (const [tenant, feds] of seenInOtherFederation) {
    if (feds.size > 1) {
      throw new FederationGovernanceError({
        violation: 'FEDERATION_MEMBERSHIP_AMBIGUOUS',
        message: `Tenant ${tenant} claims membership in ${feds.size} federations: ${[...feds].sort().join(', ')}`,
        federationId,
        tenantIds: [tenant],
      });
    }
  }

  // Every participant + primary must have an active membership in this federation.
  const memberIndex = indexMemberships(input.memberships);
  const allTenants = [primary, ...participants];
  const missing: TenantId[] = [];
  for (const t of allTenants) {
    if (!memberIndex.has(membershipKey(federationId, t))) {
      missing.push(t);
    }
  }
  if (missing.length > 0) {
    throw new FederationGovernanceError({
      violation: 'UNDECLARED_FEDERATION',
      message: `Tenants ${missing.sort().join(', ')} have no declared membership in federation ${federationId}`,
      federationId,
      tenantIds: missing,
    });
  }

  return {
    schema: 'vitalcv.federation-scope.v1',
    federationId,
    primaryTenantId: primary,
    participantTenantIds: participants,
    verdict: 'COORDINATED',
    boundaryDigest,
    partitionedAt,
  };
}

/**
 * Mirror of assertFederationScope for non-throwing call sites (CI inspectors,
 * dashboards). Returns verdict='FAILED' instead of throwing.
 */
export function evaluateFederationScope(input: {
  federationId: FederationId | null;
  primaryTenantId: TenantId;
  participantTenantIds: readonly TenantId[];
  memberships: readonly FederationMembership[];
  mode: 'BOUNDED' | 'COORDINATED';
}): FederationScope {
  try {
    return assertFederationScope(input);
  } catch {
    const federationId = normalizeFederationId(input.federationId);
    const primary = normalizeTenantId(input.primaryTenantId) ?? '';
    const participants = sortedUnique(
      input.participantTenantIds
        .map(t => normalizeTenantId(t))
        .filter((t): t is TenantId => Boolean(t) && t !== primary),
    );
    return {
      schema: 'vitalcv.federation-scope.v1',
      federationId,
      primaryTenantId: primary,
      participantTenantIds: participants,
      verdict: 'FAILED',
      boundaryDigest: federationBoundaryDigest({
        federationId,
        primaryTenantId: primary,
        participantTenantIds: participants,
        mode: input.mode,
      }),
      partitionedAt: new Date().toISOString(),
    };
  }
}

// ── Cross-org lineage ─────────────────────────────────────────────────────────

/**
 * Resolve a federated replay lineage. Pure transform; never throws.
 *
 * Capsules whose tenant is not a declared member of `federationId` are
 * dropped into `rejectedCapsuleIds` with a per-capsule reason. Lineage
 * digest binds federationId, members, and capsule order, so two
 * federations cannot produce identical digests for the same payload.
 */
export function resolveFederatedReplayLineage(input: {
  federationId: FederationId;
  primaryTenantId: TenantId;
  capsules: ReadonlyArray<{ id: string; verifierOrgId: TenantId | null }>;
  memberships: readonly FederationMembership[];
  ambiguity?: readonly AmbiguitySignature[];
}): FederatedReplayLineage {
  const federationId = normalizeFederationId(input.federationId);
  const primary = normalizeTenantId(input.primaryTenantId);
  const reconstructedAt = new Date().toISOString();

  if (!federationId || !primary) {
    return {
      schema: 'vitalcv.federation-lineage.v1',
      federationId: federationId ?? '',
      primaryTenantId: primary ?? '',
      participantTenantIds: [],
      capsuleIds: [],
      rejectedCapsuleIds: input.capsules.map(c => c.id),
      rejectedReasons: Object.fromEntries(
        input.capsules.map(c => [c.id, 'INVALID_FEDERATION_OR_PRIMARY']),
      ),
      lineageDigest: sha256ForPayload({ schema: 'vitalcv.federation-lineage.v1', empty: true }),
      ambiguity: [],
      reconstructedAt,
    };
  }

  const memberIndex = indexMemberships(input.memberships);
  const memberTenants = new Set<TenantId>();
  for (const m of input.memberships) {
    const fed = normalizeFederationId(m.federationId);
    const tenant = normalizeTenantId(m.tenantId);
    if (fed === federationId && tenant) memberTenants.add(tenant);
  }

  const seenIds = new Set<string>();
  const capsuleIds: string[] = [];
  const rejectedCapsuleIds: string[] = [];
  const rejectedReasons: Record<string, string> = {};
  const participantSet = new Set<TenantId>();

  for (const c of input.capsules) {
    if (seenIds.has(c.id)) continue; // dedupe by id, preserve first-seen order
    seenIds.add(c.id);
    const tenant = normalizeTenantId(c.verifierOrgId);
    if (!tenant) {
      rejectedCapsuleIds.push(c.id);
      rejectedReasons[c.id] = 'AMBIGUOUS_TENANT';
      continue;
    }
    if (!memberIndex.has(membershipKey(federationId, tenant))) {
      rejectedCapsuleIds.push(c.id);
      rejectedReasons[c.id] = `TENANT_${tenant}_NOT_IN_FEDERATION_${federationId}`;
      continue;
    }
    capsuleIds.push(c.id);
    if (tenant !== primary) participantSet.add(tenant);
  }

  // Surface ALL members as participants (not just observed). This means a
  // lineage with zero capsules from a member still records the member.
  for (const t of memberTenants) {
    if (t !== primary) participantSet.add(t);
  }
  const participantTenantIds = sortedUnique([...participantSet]);

  // Filter ambiguity to this federation only — propagation leak guard.
  const filteredAmbiguity = (input.ambiguity ?? []).filter(
    a => normalizeFederationId(a.federationId) === federationId,
  );

  const lineageDigest = sha256ForPayload({
    schema: 'vitalcv.federation-lineage.v1',
    federationId,
    primaryTenantId: primary,
    participantTenantIds,
    capsuleIds,
    rejectedCapsuleIds,
  });

  return {
    schema: 'vitalcv.federation-lineage.v1',
    federationId,
    primaryTenantId: primary,
    participantTenantIds,
    capsuleIds,
    rejectedCapsuleIds,
    rejectedReasons,
    lineageDigest,
    ambiguity: filteredAmbiguity,
    reconstructedAt,
  };
}

/**
 * Strict variant — throws FEDERATION_REPLAY_LEAK if any capsule was rejected.
 * Used by call sites that must hard-fail rather than silently shrink the
 * lineage (e.g. regulatory exports).
 */
export function assertLineageMembersBound(lineage: FederatedReplayLineage): void {
  if (lineage.rejectedCapsuleIds.length > 0) {
    throw new FederationGovernanceError({
      violation: 'FEDERATION_REPLAY_LEAK',
      message: `Lineage ${lineage.federationId} rejected ${lineage.rejectedCapsuleIds.length} capsule(s) outside federation`,
      federationId: lineage.federationId,
      tenantIds: lineage.participantTenantIds,
    });
  }
}

// ── Trust synchronization ─────────────────────────────────────────────────────

/**
 * Synchronize trust state across federation members. Returns a state object
 * indicating whether consensus was reached. Pure; never throws.
 *
 * Consensus rules:
 *   - Every declared member must contribute a view (missing → divergent).
 *   - Pairwise trustScore differences must be within `tolerance.trustScoreEpsilon`.
 *   - Pairwise trustBand mismatches → divergent.
 */
export function synchronizeTrustState(input: {
  federationId: FederationId;
  expectedMembers: readonly TenantId[];
  memberViews: readonly MemberTrustView[];
  tolerance: { trustScoreEpsilon: number };
}): TrustSyncState {
  const federationId = normalizeFederationId(input.federationId);
  const syncedAt = new Date().toISOString();

  const expected = sortedUnique(
    input.expectedMembers.map(t => normalizeTenantId(t)).filter((t): t is TenantId => Boolean(t)),
  );
  const viewsByTenant = new Map<TenantId, MemberTrustView>();
  for (const v of input.memberViews) {
    const tenant = normalizeTenantId(v.tenantId);
    if (tenant) viewsByTenant.set(tenant, { ...v, tenantId: tenant });
  }

  const missing = expected.filter(t => !viewsByTenant.has(t));

  // Identify divergent members. A member is divergent if its score differs
  // from any other present member by more than tolerance, or if its band
  // disagrees with any other present member.
  const present = expected.filter(t => viewsByTenant.has(t));
  const divergentSet = new Set<TenantId>();
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = viewsByTenant.get(present[i])!;
      const b = viewsByTenant.get(present[j])!;
      const scoreDiff = Math.abs(a.trustScore - b.trustScore);
      if (scoreDiff > input.tolerance.trustScoreEpsilon || a.trustBand !== b.trustBand) {
        divergentSet.add(present[i]);
        divergentSet.add(present[j]);
      }
    }
  }
  const divergentMembers = sortedUnique([...divergentSet]);

  const consensusReached = missing.length === 0 && divergentMembers.length === 0;

  const syncDigest = sha256ForPayload({
    schema: 'vitalcv.federation-trust-sync.v1',
    federationId: federationId ?? NO_FEDERATION_SENTINEL,
    expected,
    views: present.map(t => viewsByTenant.get(t)!),
    tolerance: input.tolerance,
    consensusReached,
  });

  return {
    schema: 'vitalcv.federation-trust-sync.v1',
    federationId: federationId ?? '',
    members: expected,
    consensusReached,
    divergentMembers,
    missingMembers: missing,
    syncDigest,
    syncedAt,
  };
}

/**
 * Strict variant — throws TRUST_SYNC_DIVERGENCE if consensus was not reached.
 * Used by call sites that must abort downstream work rather than proceed on
 * partial consensus.
 */
export function assertTrustSyncConverged(state: TrustSyncState): void {
  if (!state.consensusReached) {
    throw new FederationGovernanceError({
      violation: 'TRUST_SYNC_DIVERGENCE',
      message:
        `Trust sync for federation ${state.federationId} did not converge — ` +
        `missing=[${state.missingMembers.join(',')}], divergent=[${state.divergentMembers.join(',')}]`,
      federationId: state.federationId,
      tenantIds: [...state.missingMembers, ...state.divergentMembers],
    });
  }
}

// ── Federation drift ──────────────────────────────────────────────────────────

export interface MemberFederationView {
  tenantId: TenantId;
  /** This member's view of who is in the federation (sorted). */
  observedMembers: readonly TenantId[];
  /** Optional opaque digest representing this member's policy/timeline/etc. */
  viewDigest?: string;
  emittedAt: string;
}

/**
 * Detect federation drift across member views. Returns null when every
 * member agrees on the membership set AND on viewDigest (if provided).
 * Returns a drift signature otherwise.
 *
 * MEMBERSHIP drift: members disagree about who is in the federation.
 * POLICY drift: viewDigests differ across members.
 */
export function detectFederationDrift(input: {
  federationId: FederationId;
  memberViews: readonly MemberFederationView[];
}): FederationDriftSignature | null {
  const federationId = normalizeFederationId(input.federationId);
  if (!federationId || input.memberViews.length === 0) return null;

  // Compare observedMembers across views
  const memberSetDigests = new Map<string, TenantId[]>();
  for (const v of input.memberViews) {
    const sorted = sortedUnique(
      v.observedMembers.map(t => normalizeTenantId(t)).filter((t): t is TenantId => Boolean(t)),
    );
    const key = sorted.join('|');
    if (!memberSetDigests.has(key)) memberSetDigests.set(key, []);
    const tenant = normalizeTenantId(v.tenantId);
    if (tenant) memberSetDigests.get(key)!.push(tenant);
  }

  if (memberSetDigests.size > 1) {
    // Pick the smallest groups as divergent (the ones disagreeing with majority)
    const groups = [...memberSetDigests.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );
    const divergent = sortedUnique(
      groups.slice(1).flatMap(([, members]) => members),
    );
    const driftDigest = sha256ForPayload({
      schema: 'vitalcv.federation-drift-signature.v1',
      federationId,
      divergence: 'MEMBERSHIP',
      divergentMembers: divergent,
      groups: groups.map(([k, v]) => ({ memberSet: k, witnesses: sortedUnique(v) })),
    });
    return {
      schema: 'vitalcv.federation-drift-signature.v1',
      federationId,
      divergence: 'MEMBERSHIP',
      divergentMembers: divergent,
      driftDigest,
      detectedAt: new Date().toISOString(),
    };
  }

  // Compare viewDigests across views (POLICY drift)
  const digestGroups = new Map<string, TenantId[]>();
  for (const v of input.memberViews) {
    const tenant = normalizeTenantId(v.tenantId);
    if (!tenant) continue;
    const digest = v.viewDigest ?? '__no_digest__';
    if (!digestGroups.has(digest)) digestGroups.set(digest, []);
    digestGroups.get(digest)!.push(tenant);
  }
  if (digestGroups.size > 1) {
    const groups = [...digestGroups.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );
    const divergent = sortedUnique(
      groups.slice(1).flatMap(([, members]) => members),
    );
    const driftDigest = sha256ForPayload({
      schema: 'vitalcv.federation-drift-signature.v1',
      federationId,
      divergence: 'POLICY',
      divergentMembers: divergent,
      groups: groups.map(([k, v]) => ({ viewDigest: k, witnesses: sortedUnique(v) })),
    });
    return {
      schema: 'vitalcv.federation-drift-signature.v1',
      federationId,
      divergence: 'POLICY',
      divergentMembers: divergent,
      driftDigest,
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Strict variant — throws FEDERATION_DRIFT if drift is present.
 */
export function assertNoFederationDrift(drift: FederationDriftSignature | null): void {
  if (drift) {
    throw new FederationGovernanceError({
      violation: 'FEDERATION_DRIFT',
      message:
        `Federation ${drift.federationId} drift (${drift.divergence}): ` +
        `divergent members=[${drift.divergentMembers.join(',')}]`,
      federationId: drift.federationId,
      tenantIds: drift.divergentMembers,
    });
  }
}

// ── Ambiguity propagation ─────────────────────────────────────────────────────

export function buildAmbiguitySignature(input: {
  federationId: FederationId;
  tenantId: TenantId;
  reason: AmbiguityReason;
  payload: unknown;
}): AmbiguitySignature {
  const federationId = normalizeFederationId(input.federationId) ?? '';
  const tenantId = normalizeTenantId(input.tenantId) ?? '';
  const digest = sha256ForPayload({
    schema: 'vitalcv.federation-ambiguity.v1',
    federationId,
    tenantId,
    reason: input.reason,
    payload: input.payload ?? {},
  });
  return {
    schema: 'vitalcv.federation-ambiguity.v1',
    federationId,
    tenantId,
    reason: input.reason,
    digest,
    emittedAt: new Date().toISOString(),
  };
}

/**
 * Propagate an ambiguity signature across federation members. Returns one
 * signature per declared member of the same federation (including the source
 * tenant), with deterministic per-tenant digests. Members of OTHER federations
 * are never reached — propagation cannot leak across federation boundaries.
 *
 * Throws AMBIGUITY_PROPAGATION_LEAK if the source signature's federationId
 * does not match the declared federationId, OR if memberships claim the
 * source tenant in a different federation than its signature.
 */
export function propagateFederatedAmbiguity(input: {
  federationId: FederationId;
  source: AmbiguitySignature;
  memberships: readonly FederationMembership[];
}): AmbiguitySignature[] {
  const federationId = normalizeFederationId(input.federationId);
  const sourceFederationId = normalizeFederationId(input.source.federationId);
  if (!federationId || sourceFederationId !== federationId) {
    throw new FederationGovernanceError({
      violation: 'AMBIGUITY_PROPAGATION_LEAK',
      message: `Cannot propagate ambiguity from federation ${sourceFederationId ?? 'null'} into ${federationId ?? 'null'}`,
      federationId,
      tenantIds: [input.source.tenantId],
    });
  }

  const sourceTenant = normalizeTenantId(input.source.tenantId);
  if (!sourceTenant) {
    throw new FederationGovernanceError({
      violation: 'AMBIGUITY_PROPAGATION_LEAK',
      message: 'Ambiguity source tenant is empty',
      federationId,
    });
  }

  // Check that the source tenant is actually a declared member of THIS federation.
  const memberTenants = sortedUnique(
    input.memberships
      .filter(m => normalizeFederationId(m.federationId) === federationId)
      .map(m => normalizeTenantId(m.tenantId))
      .filter((t): t is TenantId => Boolean(t)),
  );
  if (!memberTenants.includes(sourceTenant)) {
    throw new FederationGovernanceError({
      violation: 'AMBIGUITY_PROPAGATION_LEAK',
      message: `Source tenant ${sourceTenant} is not a declared member of federation ${federationId}`,
      federationId,
      tenantIds: [sourceTenant],
    });
  }

  // Build per-tenant signatures. Each carries the same reason but a distinct
  // digest because tenantId is hashed in.
  return memberTenants.map(t =>
    buildAmbiguitySignature({
      federationId,
      tenantId: t,
      reason: input.source.reason,
      // The original payload is captured via the source digest so receiving
      // members can correlate without re-hashing the full payload.
      payload: { sourceTenantId: sourceTenant, sourceDigest: input.source.digest },
    }),
  );
}

/**
 * True iff two ambiguity signatures share federation AND tenant — i.e.
 * they are correlated views of the same underlying ambiguity. Used by
 * tests and dashboards to assert non-leakage across federations.
 */
export function ambiguitySignaturesShareScope(
  a: AmbiguitySignature,
  b: AmbiguitySignature,
): boolean {
  return a.federationId === b.federationId && a.tenantId === b.tenantId;
}

// ── Blast radius (federation-aware) ───────────────────────────────────────────

export function computeFederationBlastRadius(input: {
  triggerCapsuleId: string;
  triggerTenantId: TenantId;
  triggerFederationId: FederationId | null;
  affectedCapsules: ReadonlyArray<{
    id: string;
    verifierOrgId: TenantId | null;
    federationId: FederationId | null;
  }>;
}): FederationBlastRadius {
  const triggerTenant = normalizeTenantId(input.triggerTenantId) ?? NO_TENANT_SENTINEL;
  const triggerFederation = normalizeFederationId(input.triggerFederationId) ?? NO_FEDERATION_SENTINEL;

  const tenants = new Set<string>([triggerTenant]);
  const federations = new Set<string>([triggerFederation]);
  const ids: string[] = [];

  for (const c of input.affectedCapsules) {
    ids.push(c.id);
    tenants.add(normalizeTenantId(c.verifierOrgId) ?? NO_TENANT_SENTINEL);
    federations.add(normalizeFederationId(c.federationId) ?? NO_FEDERATION_SENTINEL);
  }

  const tenantList = sortedUnique([...tenants]);
  const federationList = sortedUnique([...federations]);

  if (federationList.length > 1) {
    return {
      schema: 'vitalcv.federation-blast-radius.v1',
      tier: 'CROSS_FEDERATION_BREACH',
      affectedFederations: federationList,
      affectedTenantIds: tenantList,
      affectedCapsuleIds: ids,
      partitioned: false,
      containmentReason: `Affected capsules span ${federationList.length} federation scopes — coordination breached.`,
    };
  }

  if (tenantList.length > 1) {
    return {
      schema: 'vitalcv.federation-blast-radius.v1',
      tier: 'FEDERATION_BOUNDED',
      affectedFederations: federationList,
      affectedTenantIds: tenantList,
      affectedCapsuleIds: ids,
      partitioned: true,
      containmentReason:
        `Blast radius contained within federation ${federationList[0]} ` +
        `across ${tenantList.length} tenant(s).`,
    };
  }

  return {
    schema: 'vitalcv.federation-blast-radius.v1',
    tier: 'SINGLE_TENANT',
    affectedFederations: federationList,
    affectedTenantIds: tenantList,
    affectedCapsuleIds: ids,
    partitioned: true,
    containmentReason: `Blast radius contained within tenant ${tenantList[0]}.`,
  };
}

export function assertFederationBlastRadiusContained(r: FederationBlastRadius): void {
  if (!r.partitioned) {
    throw new FederationGovernanceError({
      violation: 'FEDERATION_BLAST_RADIUS_BREACH',
      message: r.containmentReason,
    });
  }
}

// ── Federation recovery scoping ───────────────────────────────────────────────

export function scopeFederationRecovery(input: {
  triggerCapsuleId: string;
  scopeFederationId: FederationId | null;
  scopeTenantId: TenantId;
  candidates: ReadonlyArray<{
    id: string;
    verifierOrgId: TenantId | null;
    federationId: FederationId | null;
  }>;
  memberships: readonly FederationMembership[];
}): FederationRecoveryDecision {
  const scopeFederationId = normalizeFederationId(input.scopeFederationId);
  const scopeTenantId = normalizeTenantId(input.scopeTenantId) ?? '';
  const memberIndex = scopeFederationId ? indexMemberships(input.memberships) : new Map();

  const permitted: string[] = [];
  const rejected: string[] = [];
  const rejectedReasons: Record<string, string> = {};

  for (const c of input.candidates) {
    const candidateTenant = normalizeTenantId(c.verifierOrgId);
    const candidateFederation = normalizeFederationId(c.federationId);

    // No federation scope — only same-tenant candidates allowed.
    if (!scopeFederationId) {
      if (candidateTenant === scopeTenantId) {
        permitted.push(c.id);
      } else {
        rejected.push(c.id);
        rejectedReasons[c.id] = 'NO_FEDERATION_SCOPE_TENANT_MISMATCH';
      }
      continue;
    }

    // Federation scope — candidate must declare same federation AND its tenant
    // must be a member of that federation.
    if (candidateFederation !== scopeFederationId) {
      rejected.push(c.id);
      rejectedReasons[c.id] = `FEDERATION_${candidateFederation ?? 'null'}_NOT_${scopeFederationId}`;
      continue;
    }
    if (!candidateTenant || !memberIndex.has(membershipKey(scopeFederationId, candidateTenant))) {
      rejected.push(c.id);
      rejectedReasons[c.id] = `TENANT_${candidateTenant ?? 'null'}_NOT_IN_${scopeFederationId}`;
      continue;
    }
    permitted.push(c.id);
  }

  return {
    schema: 'vitalcv.federation-recovery.v1',
    triggerCapsuleId: input.triggerCapsuleId,
    scopeFederationId,
    scopeTenantId,
    permittedCapsuleIds: permitted,
    rejectedCapsuleIds: rejected,
    rejectedReasons,
    reason:
      rejected.length === 0
        ? 'Federation recovery scope clean.'
        : `Rejected ${rejected.length} candidate(s) outside federation ${scopeFederationId ?? 'null'}.`,
  };
}

export function assertFederationRecoveryClean(d: FederationRecoveryDecision): void {
  if (d.rejectedCapsuleIds.length > 0) {
    throw new FederationGovernanceError({
      violation: 'FEDERATION_RECOVERY_BREACH',
      message: d.reason,
      federationId: d.scopeFederationId,
      tenantIds: [d.scopeTenantId],
    });
  }
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const FEDERATION_SENTINELS = Object.freeze({
  NO_FEDERATION: NO_FEDERATION_SENTINEL,
  NO_TENANT: NO_TENANT_SENTINEL,
});

export const FEDERATION_VIOLATIONS = Object.freeze([
  'UNDECLARED_FEDERATION',
  'CROSS_FEDERATION_BLEED',
  'FEDERATION_MEMBERSHIP_AMBIGUOUS',
  'FEDERATION_DRIFT',
  'FEDERATION_REPLAY_LEAK',
  'TRUST_SYNC_DIVERGENCE',
  'FEDERATION_RECOVERY_BREACH',
  'FEDERATION_BLAST_RADIUS_BREACH',
  'AMBIGUITY_PROPAGATION_LEAK',
] as const);
