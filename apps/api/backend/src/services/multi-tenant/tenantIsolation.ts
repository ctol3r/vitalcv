/**
 * tenantIsolation.ts — W2-PR36A: Multi-Tenant Governance Isolation
 *
 * Pure transforms enforcing the tenant boundary across replay lineage, drift
 * propagation, blast-radius segmentation, and recovery semantics.
 *
 * Hard invariants (fail-closed):
 *   - A tenanted requester may NEVER read a capsule owned by another tenant.
 *   - A tenanted requester may NEVER read a capsule with no tenant anchor
 *     (ambiguity is a violation, not a free pass).
 *   - Replay timeline (`relatedDecisions`) is filtered to the source capsule's
 *     tenant, even when the requester does not claim a tenant — so unscoped
 *     callers cannot harvest a cross-tenant timeline by side channel.
 *   - Drift signatures hash the tenantId into the digest — drift events for
 *     two tenants can never produce the same signature, so cross-tenant
 *     drift cannot poison a peer's lineage.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the boundary
 * checker that other modules call before they mutate or emit.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TenantId = string;

export type TenantViolationKind =
  | 'CROSS_TENANT_REPLAY'
  | 'CROSS_TENANT_BUNDLE'
  | 'AMBIGUOUS_TENANT'
  | 'DRIFT_BLEEDOVER'
  | 'RECOVERY_LEAK'
  | 'BLAST_RADIUS_BREACH';

export class TenantIsolationError extends Error {
  readonly code = 'TENANT_ISOLATION_VIOLATION' as const;
  readonly violation: TenantViolationKind;
  readonly capsuleTenantId: TenantId | null;
  readonly requesterTenantId: TenantId | null;
  readonly capsuleId: string | null;

  constructor(args: {
    violation: TenantViolationKind;
    message: string;
    capsuleId?: string | null;
    capsuleTenantId?: TenantId | null;
    requesterTenantId?: TenantId | null;
  }) {
    super(args.message);
    this.name = 'TenantIsolationError';
    this.violation = args.violation;
    this.capsuleId = args.capsuleId ?? null;
    this.capsuleTenantId = args.capsuleTenantId ?? null;
    this.requesterTenantId = args.requesterTenantId ?? null;
  }
}

export type IsolationVerdict = 'ENFORCED' | 'OPEN' | 'FAILED';

export interface TenantScope {
  schema: 'vitalcv.tenant-isolation.v1';
  capsuleTenantId: TenantId | null;
  requesterTenantId: TenantId | null;
  isolationVerdict: IsolationVerdict;
  /** SHA-256 over (capsuleId, capsuleTenantId, requesterTenantId) — tamper-evident boundary marker. */
  boundaryDigest: string;
  partitionedAt: string;
}

export type BlastRadiusTier =
  | 'SINGLE_DECISION'
  | 'SINGLE_TENANT'
  | 'CROSS_TENANT_CONTAINMENT_BREACH';

export interface BlastRadius {
  schema: 'vitalcv.tenant-blast-radius.v1';
  tier: BlastRadiusTier;
  /** Distinct tenants touched, sorted for determinism. `__no_tenant__` is used for null. */
  affectedTenantIds: string[];
  affectedCapsuleIds: string[];
  /** True iff the radius is contained within a single tenant (or a single un-anchored set). */
  partitioned: boolean;
  containmentReason: string;
}

export interface TenantRecoveryDecision {
  schema: 'vitalcv.tenant-recovery.v1';
  triggerCapsuleId: string;
  scopeTenantId: TenantId | null;
  permittedCapsuleIds: string[];
  rejectedCapsuleIds: string[];
  reason: string;
}

export interface TenantDriftSignature {
  schema: 'vitalcv.tenant-drift-signature.v1';
  /** `__no_tenant__` sentinel when the source had no tenant anchor — never an empty string. */
  tenantId: string;
  driftSeverity: string;
  source: string;
  signature: string;
  emittedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NO_TENANT_SENTINEL = '__no_tenant__';
const NO_REQUESTER_SENTINEL = '__no_requester__';

export function normalizeTenantId(value: unknown): TenantId | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function tenantBoundaryDigest(input: {
  capsuleId: string;
  capsuleTenantId: TenantId | null;
  requesterTenantId: TenantId | null;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.tenant-boundary.v1',
    capsuleId: input.capsuleId,
    capsuleTenantId: input.capsuleTenantId ?? NO_TENANT_SENTINEL,
    requesterTenantId: input.requesterTenantId ?? NO_REQUESTER_SENTINEL,
  });
}

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Fail-closed tenant scope validator.
 *
 *   requesterTenantId | capsuleTenantId | verdict
 *   ------------------+-----------------+--------------------------
 *   null              | any             | OPEN (no enforcement)
 *   set               | null            | THROWS AMBIGUOUS_TENANT
 *   set               | matches         | ENFORCED
 *   set               | mismatches      | THROWS CROSS_TENANT_REPLAY
 */
export function assertTenantScope(input: {
  capsuleId: string;
  capsuleTenantId: TenantId | null;
  requesterTenantId: TenantId | null;
}): TenantScope {
  const partitionedAt = new Date().toISOString();
  const boundaryDigest = tenantBoundaryDigest(input);
  const requester = normalizeTenantId(input.requesterTenantId);
  const owner = normalizeTenantId(input.capsuleTenantId);

  if (!requester) {
    return {
      schema: 'vitalcv.tenant-isolation.v1',
      capsuleTenantId: owner,
      requesterTenantId: null,
      isolationVerdict: 'OPEN',
      boundaryDigest,
      partitionedAt,
    };
  }

  if (!owner) {
    throw new TenantIsolationError({
      violation: 'AMBIGUOUS_TENANT',
      message: `Capsule ${input.capsuleId} has no tenant anchor; cannot serve to tenanted requester ${requester}`,
      capsuleId: input.capsuleId,
      capsuleTenantId: null,
      requesterTenantId: requester,
    });
  }

  if (owner !== requester) {
    throw new TenantIsolationError({
      violation: 'CROSS_TENANT_REPLAY',
      message: `Tenant ${requester} requested capsule ${input.capsuleId} owned by tenant ${owner}`,
      capsuleId: input.capsuleId,
      capsuleTenantId: owner,
      requesterTenantId: requester,
    });
  }

  return {
    schema: 'vitalcv.tenant-isolation.v1',
    capsuleTenantId: owner,
    requesterTenantId: requester,
    isolationVerdict: 'ENFORCED',
    boundaryDigest,
    partitionedAt,
  };
}

/**
 * Mirror of `assertTenantScope` for non-throwing call sites that need a
 * verdict object (e.g. CI inspectors, dashboards). Returns isolationVerdict
 * = 'FAILED' instead of throwing.
 */
export function evaluateTenantScope(input: {
  capsuleId: string;
  capsuleTenantId: TenantId | null;
  requesterTenantId: TenantId | null;
}): TenantScope {
  try {
    return assertTenantScope(input);
  } catch {
    return {
      schema: 'vitalcv.tenant-isolation.v1',
      capsuleTenantId: normalizeTenantId(input.capsuleTenantId),
      requesterTenantId: normalizeTenantId(input.requesterTenantId),
      isolationVerdict: 'FAILED',
      boundaryDigest: tenantBoundaryDigest(input),
      partitionedAt: new Date().toISOString(),
    };
  }
}

// ── Replay lineage scoping ────────────────────────────────────────────────────

export interface ScopedDecisionInput {
  id?: string;
  verifierOrgId: TenantId | null;
}

/**
 * Filter a timeline of decisions to a single tenant. Pure transform; never
 * throws. Decisions whose tenant differs from `capsuleTenantId` are dropped —
 * the unscoped caller cannot harvest a cross-tenant timeline by side channel.
 *
 * If `capsuleTenantId` is null, only decisions ALSO without a tenant are kept
 * (fail-closed — never mix anchored and un-anchored decisions in one timeline).
 */
export function scopeRelatedDecisions<T extends ScopedDecisionInput>(
  decisions: readonly T[],
  capsuleTenantId: TenantId | null,
): T[] {
  const owner = normalizeTenantId(capsuleTenantId);
  return decisions.filter(d => normalizeTenantId(d.verifierOrgId) === owner);
}

// ── Blast-radius segmentation ─────────────────────────────────────────────────

export function computeBlastRadius(input: {
  triggerCapsuleId: string;
  triggerTenantId: TenantId | null;
  affectedCapsules: ReadonlyArray<{ id: string; verifierOrgId: TenantId | null }>;
}): BlastRadius {
  const tenants = new Set<string>();
  const ids: string[] = [];

  const triggerTenant = normalizeTenantId(input.triggerTenantId);
  tenants.add(triggerTenant ?? NO_TENANT_SENTINEL);

  for (const c of input.affectedCapsules) {
    ids.push(c.id);
    tenants.add(normalizeTenantId(c.verifierOrgId) ?? NO_TENANT_SENTINEL);
  }

  const tenantList = [...tenants].sort();

  if (tenantList.length > 1) {
    return {
      schema: 'vitalcv.tenant-blast-radius.v1',
      tier: 'CROSS_TENANT_CONTAINMENT_BREACH',
      affectedTenantIds: tenantList,
      affectedCapsuleIds: ids,
      partitioned: false,
      containmentReason: `Affected capsules span ${tenantList.length} tenant scopes — segmentation breached.`,
    };
  }

  if (input.affectedCapsules.length === 0) {
    return {
      schema: 'vitalcv.tenant-blast-radius.v1',
      tier: 'SINGLE_DECISION',
      affectedTenantIds: tenantList,
      affectedCapsuleIds: ids,
      partitioned: true,
      containmentReason: 'No related capsules — blast radius limited to trigger.',
    };
  }

  return {
    schema: 'vitalcv.tenant-blast-radius.v1',
    tier: 'SINGLE_TENANT',
    affectedTenantIds: tenantList,
    affectedCapsuleIds: ids,
    partitioned: true,
    containmentReason: `Blast radius contained within tenant ${tenantList[0]}.`,
  };
}

/**
 * Asserts the radius is partitioned. Throws BLAST_RADIUS_BREACH otherwise.
 * Used by recovery hooks before they fan out replay/refresh actions.
 */
export function assertBlastRadiusContained(radius: BlastRadius): void {
  if (!radius.partitioned) {
    throw new TenantIsolationError({
      violation: 'BLAST_RADIUS_BREACH',
      message: radius.containmentReason,
    });
  }
}

// ── Scoped recovery semantics ─────────────────────────────────────────────────

/**
 * Given a set of candidate capsules to replay/recover, partition them by
 * tenant scope.  Other-tenant candidates land in `rejectedCapsuleIds`. Only
 * `permittedCapsuleIds` may be acted on.
 *
 * If `scopeTenantId` is null, only un-anchored candidates are permitted —
 * never mix anchored and un-anchored capsules in a single recovery wave.
 */
export function scopeRecovery(input: {
  triggerCapsuleId: string;
  scopeTenantId: TenantId | null;
  candidates: ReadonlyArray<{ id: string; verifierOrgId: TenantId | null }>;
}): TenantRecoveryDecision {
  const scope = normalizeTenantId(input.scopeTenantId);
  const permitted: string[] = [];
  const rejected: string[] = [];

  for (const c of input.candidates) {
    const t = normalizeTenantId(c.verifierOrgId);
    if (t === scope) {
      permitted.push(c.id);
    } else {
      rejected.push(c.id);
    }
  }

  return {
    schema: 'vitalcv.tenant-recovery.v1',
    triggerCapsuleId: input.triggerCapsuleId,
    scopeTenantId: scope,
    permittedCapsuleIds: permitted,
    rejectedCapsuleIds: rejected,
    reason: rejected.length === 0
      ? 'Recovery scope clean — every candidate matches scope tenant.'
      : `Rejected ${rejected.length} candidate(s) outside scope tenant ${scope ?? NO_TENANT_SENTINEL}.`,
  };
}

/**
 * Strict variant — throws if any candidate would be rejected. For call sites
 * that must abort the recovery rather than silently proceed.
 */
export function assertRecoveryScopeClean(decision: TenantRecoveryDecision): void {
  if (decision.rejectedCapsuleIds.length > 0) {
    throw new TenantIsolationError({
      violation: 'RECOVERY_LEAK',
      message: decision.reason,
      capsuleId: decision.triggerCapsuleId,
      capsuleTenantId: decision.scopeTenantId,
    });
  }
}

// ── Tenant drift separation ───────────────────────────────────────────────────

export function buildTenantDriftSignature(input: {
  tenantId: TenantId | null;
  driftSeverity: string;
  source: string;
  payload: unknown;
}): TenantDriftSignature {
  const tenantId = normalizeTenantId(input.tenantId) ?? NO_TENANT_SENTINEL;
  const signature = sha256ForPayload({
    schema: 'vitalcv.tenant-drift-signature.v1',
    tenantId,
    driftSeverity: input.driftSeverity,
    source: input.source,
    payload: input.payload ?? {},
  });
  return {
    schema: 'vitalcv.tenant-drift-signature.v1',
    tenantId,
    driftSeverity: input.driftSeverity,
    source: input.source,
    signature,
    emittedAt: new Date().toISOString(),
  };
}

/**
 * True iff two drift signatures originated from the same tenant scope.
 * Used by chaos tests to assert no drift bleedover, and by drift consumers
 * to refuse to merge cross-tenant signatures into a single lineage.
 */
export function driftSignaturesShareTenant(
  a: TenantDriftSignature,
  b: TenantDriftSignature,
): boolean {
  return a.tenantId === b.tenantId;
}

/**
 * Strict variant — throws DRIFT_BLEEDOVER if the two signatures don't share
 * a tenant.  For call sites that must hard-fail rather than silently merge.
 */
export function assertDriftSignaturesSameTenant(
  a: TenantDriftSignature,
  b: TenantDriftSignature,
): void {
  if (!driftSignaturesShareTenant(a, b)) {
    throw new TenantIsolationError({
      violation: 'DRIFT_BLEEDOVER',
      message: `Drift signatures span tenants ${a.tenantId} and ${b.tenantId}; merging would contaminate lineage.`,
      capsuleTenantId: a.tenantId,
      requesterTenantId: b.tenantId,
    });
  }
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const TENANT_SENTINELS = Object.freeze({
  NO_TENANT: NO_TENANT_SENTINEL,
  NO_REQUESTER: NO_REQUESTER_SENTINEL,
});
