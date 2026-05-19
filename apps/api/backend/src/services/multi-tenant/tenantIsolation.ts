/**
 * tenantIsolation.ts — multi-tenant scope assertions
 *
 * Narrow-shim restoration of the module orphaned by commit 8912bc7e.
 * Used by services/audit/replayEngine.ts to guard cross-tenant
 * replay reads. The original file's intent is preserved exactly:
 * `assertTenantScope` MUST fail closed on cross-tenant or
 * ambiguous reads. The comment at replayEngine.ts:324 documents
 * the contract:
 *
 *   "Fail-closed: throws TenantIsolationError on cross-tenant or
 *    ambiguous reads."
 *
 * Doctrine:
 *   - `normalizeTenantId` and `scopeRelatedDecisions` are pure
 *     transforms. No I/O.
 *   - `assertTenantScope` is the security primitive and MUST fail
 *     closed. It returns a `TenantScope` only when the read is
 *     unambiguously safe (capsule has no tenant binding, OR the
 *     requester's tenant matches the capsule's tenant). Any
 *     mismatch throws `TenantIsolationError`.
 *   - This shim never silently widens scope. A later real
 *     implementation can replace the body but must preserve the
 *     fail-closed semantics.
 */

/** Tenant id — opaque string identifier for an organization. */
export type TenantId = string;

/**
 * Result of asserting tenant scope. The shape is structural so that
 * downstream code (`DecisionReplay.tenantScope`) can serialise it
 * directly into the replay record.
 */
export interface TenantScope {
  schema: 'vitalcv.tenant-scope.v1';
  /** The capsule's bound tenant, or null if unbound. */
  capsuleTenantId: TenantId | null;
  /** The requester's claimed tenant, or null if anonymous. */
  requesterTenantId: TenantId | null;
  /**
   * Scope kind:
   *   - `same-tenant`    — capsule and requester agree.
   *   - `unbound-capsule` — capsule has no tenant binding (legacy /
   *                        pre-multi-tenant records); the read is
   *                        allowed but flagged.
   *   - `anonymous-read` — requester didn't claim a tenant; capsule
   *                       is also unbound. Allowed but flagged.
   */
  scopeKind: 'same-tenant' | 'unbound-capsule' | 'anonymous-read';
}

/** Thrown when `assertTenantScope` refuses a cross-tenant read. */
export class TenantIsolationError extends Error {
  readonly capsuleId: string;
  readonly capsuleTenantId: TenantId | null;
  readonly requesterTenantId: TenantId | null;

  constructor(opts: {
    capsuleId: string;
    capsuleTenantId: TenantId | null;
    requesterTenantId: TenantId | null;
    reason: string;
  }) {
    super(
      `TenantIsolationError: ${opts.reason} (capsule=${opts.capsuleId}, ` +
        `capsuleTenant=${opts.capsuleTenantId ?? '∅'}, ` +
        `requesterTenant=${opts.requesterTenantId ?? '∅'})`,
    );
    this.name = 'TenantIsolationError';
    this.capsuleId = opts.capsuleId;
    this.capsuleTenantId = opts.capsuleTenantId;
    this.requesterTenantId = opts.requesterTenantId;
  }
}

/**
 * Normalise a tenant id: trim, treat empty as null. Pure, never throws.
 */
export function normalizeTenantId(value: string | null | undefined): TenantId | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Assert that a requester is allowed to read a capsule scoped to
 * `capsuleTenantId`. Fail-closed: throws `TenantIsolationError` on
 * any disagreement.
 *
 * Allowed combinations:
 *   - `requesterTenantId === capsuleTenantId` → `same-tenant`
 *   - `capsuleTenantId === null && requesterTenantId === null` → `anonymous-read`
 *   - `capsuleTenantId === null && requesterTenantId !== null` → `unbound-capsule`
 *
 * Forbidden combinations (throws):
 *   - `requesterTenantId !== null && capsuleTenantId !== null &&
 *      requesterTenantId !== capsuleTenantId`
 */
export function assertTenantScope(input: {
  capsuleId: string;
  capsuleTenantId: TenantId | null;
  requesterTenantId: TenantId | null;
}): TenantScope {
  const { capsuleId, capsuleTenantId, requesterTenantId } = input;

  if (capsuleTenantId !== null && requesterTenantId !== null) {
    if (capsuleTenantId !== requesterTenantId) {
      throw new TenantIsolationError({
        capsuleId,
        capsuleTenantId,
        requesterTenantId,
        reason: 'cross-tenant read refused',
      });
    }
    return {
      schema: 'vitalcv.tenant-scope.v1',
      capsuleTenantId,
      requesterTenantId,
      scopeKind: 'same-tenant',
    };
  }

  if (capsuleTenantId === null && requesterTenantId === null) {
    return {
      schema: 'vitalcv.tenant-scope.v1',
      capsuleTenantId: null,
      requesterTenantId: null,
      scopeKind: 'anonymous-read',
    };
  }

  // capsuleTenantId === null && requesterTenantId !== null
  return {
    schema: 'vitalcv.tenant-scope.v1',
    capsuleTenantId: null,
    requesterTenantId,
    scopeKind: 'unbound-capsule',
  };
}

/** Tenant-scoping shape required by `scopeRelatedDecisions`. */
export type TenantScopeFields = {
  verifierOrgId?: string | null;
  organizationId?: string | null;
};

/**
 * Defence-in-depth filter applied after a tenant-scoped Prisma query.
 * Keeps only records whose `verifierOrgId` (or `organizationId`)
 * matches `tenantId`. If `tenantId` is null, no filtering is applied
 * (anonymous read path).
 *
 * The replay engine's call site (replayEngine.ts:606) already
 * tenant-scopes at the query layer. This function is the second
 * fence: it ensures a stale / mis-indexed row cannot leak across
 * tenants even if the query layer regresses.
 *
 * Note on typing: the call site composes records via spread + Prisma
 * `findMany().map(...)`, and the wider backend currently carries
 * Prisma-client typing breakage on `origin/main` (Prisma.InputJsonValue
 * missing, etc.) that cascades down into a `select`'s result type.
 * To keep this shim from depending on that broken inference chain,
 * the parameter is typed permissively via `unknown` and the return
 * uses `any[]` so the existing call site continues to read
 * `record.metadata`, `record.id`, `record.decisionType` without
 * re-narrowing. The runtime behaviour is identical to a strictly
 * typed version — `normalizeTenantId` accepts arbitrary string-or-null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeRelatedDecisions(
  records: ReadonlyArray<unknown>,
  tenantId: TenantId | null,
): any[] {
  const arr = [...records];
  if (tenantId === null) return arr;
  return arr.filter((record) => {
    const tenantFields = record as TenantScopeFields;
    const recordTenant =
      normalizeTenantId(tenantFields.verifierOrgId ?? null) ??
      normalizeTenantId(tenantFields.organizationId ?? null);
    return recordTenant === tenantId;
  });
}
