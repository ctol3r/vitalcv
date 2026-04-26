import type {
  IssuerAuditEventRecord,
  IssuerAuditPersistenceMode,
  IssuerAuditWriteResult,
} from './auditPersistence';
import type {
  IssuerAuditPersistenceAdapter,
  IssuerAuditPersistenceAdapterConfig,
  IssuerPersistenceAdapterDecision,
} from './auditPersistenceAdapter';
import {
  chooseIssuerAuditPersistenceAdapter,
  createPersistenceAdapter,
} from './auditPersistenceAdapter';

/**
 * ISSUER-8 — Repository audit adapter stub.
 *
 * This module DELIBERATELY does NOT import the existing backend
 * repository (`apps/api/backend/repositories/psvReceipts.repo.ts`).
 *
 * Why not:
 *   - That repository imports `prisma` (server-only) and is bound to
 *     the `chai-vc-platform-backend` package. Importing it here would
 *     pull a server-only dependency into the web client bundle and
 *     break Next.js builds.
 *   - The backend repo's shape is the legacy snake_case
 *     `PsvReceiptSnapshot` (`receipt_id`, `fetched_at`, `ttl_seconds`,
 *     `revoked`) that predates the issuer-verification chain. It does
 *     not currently model `IssuerAuditEventRecord` at all.
 *   - Bridging the two shapes is a real architectural decision that
 *     belongs to a future wave (with its own brief and own Codex pass).
 *
 * What this module DOES:
 *   - Defines the type-only shape `RepositoryAuditEventPayload` that a
 *     future repository writer would produce from an
 *     `IssuerAuditEventRecord`.
 *   - Provides `mapRecordToRepositoryPayload` as a pure transform.
 *   - Exposes `createRepositoryAuditAdapter` which always returns a
 *     `repository_candidate` (or `unavailable`) decision until an
 *     operator explicitly opts into `enableRepositoryWrites: true` AND
 *     a real writer is wired (which this slice does not do).
 *   - Carries an `availability` description that the review surface
 *     renders verbatim so reviewers see exactly what would be needed
 *     to enable persistence.
 *
 * What this module does NOT:
 *   - Import any database driver, ORM client, or HTTP client.
 *   - Dynamic-import any backend module.
 *   - Write a real audit row.
 *   - Claim `persisted: true` from any code path here.
 */

/**
 * The shape a future repository writer would persist. This is
 * deliberately decoupled from the legacy backend `PsvReceiptSnapshot`
 * shape — bridging the two is a separate decision.
 */
export interface RepositoryAuditEventPayload {
  eventId: string;
  correlationId: string;
  requestId: string;
  subjectId?: string;
  actorId: string;
  actorRole: IssuerAuditEventRecord['actorRole'];
  eventType: IssuerAuditEventRecord['eventType'];
  occurredAt: string;
  source: IssuerAuditEventRecord['source'];
  payloadHash: string;
  limitationNote?: string;
  relatedArtifactId?: string;
}

/**
 * The result a future real repository write would return. Always
 * carries `persisted: boolean` so callers must inspect it
 * explicitly.
 */
export interface RepositoryAuditAdapterResult extends IssuerAuditWriteResult {
  /** True iff a row was actually written to the repository. */
  persisted: boolean;
  /** Optional id assigned by the repository on successful write. */
  persistedRowId?: string;
}

/**
 * Why a repository writer may be unavailable in the current build.
 * Surfaced verbatim by the review surface.
 */
export const REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON =
  'No client-safe repository adapter is wired. The existing backend ' +
  'repository at apps/api/backend/repositories/psvReceipts.repo.ts is ' +
  'Prisma-bound and lives in the chai-vc-platform-backend package; ' +
  'importing it here would pull server-only dependencies into the web ' +
  'client bundle. A separate wave is required to (a) add a ' +
  'client-safe RPC boundary or server action, and (b) reconcile the ' +
  'legacy PsvReceiptSnapshot shape with IssuerAuditEventRecord.';

/**
 * Pure transform: map an `IssuerAuditEventRecord` to the structural
 * payload a repository writer would persist. Does NOT write
 * anything. Does NOT call any service.
 */
export function mapRecordToRepositoryPayload(
  record: IssuerAuditEventRecord,
): RepositoryAuditEventPayload {
  return {
    eventId: record.eventId,
    correlationId: record.correlationId,
    requestId: record.requestId,
    subjectId: record.subjectId,
    actorId: record.actor.actorId,
    actorRole: record.actorRole,
    eventType: record.eventType,
    occurredAt: record.occurredAt,
    source: record.source,
    payloadHash: record.payloadHash,
    limitationNote: record.limitationNote,
    relatedArtifactId: record.relatedArtifactId,
  };
}

/**
 * Inverse helper for tests: confirm a payload preserves every
 * record field listed by the truth contract. Returns the missing
 * field names (empty array means all preserved).
 */
export function findRepositoryPayloadOmissions(
  record: IssuerAuditEventRecord,
  payload: RepositoryAuditEventPayload,
): string[] {
  const missing: string[] = [];
  if (payload.eventId !== record.eventId) missing.push('eventId');
  if (payload.correlationId !== record.correlationId) missing.push('correlationId');
  if (payload.requestId !== record.requestId) missing.push('requestId');
  if (payload.subjectId !== record.subjectId) missing.push('subjectId');
  if (payload.actorId !== record.actor.actorId) missing.push('actorId');
  if (payload.actorRole !== record.actorRole) missing.push('actorRole');
  if (payload.eventType !== record.eventType) missing.push('eventType');
  if (payload.occurredAt !== record.occurredAt) missing.push('occurredAt');
  if (payload.source !== record.source) missing.push('source');
  if (payload.payloadHash !== record.payloadHash) missing.push('payloadHash');
  if (payload.limitationNote !== record.limitationNote)
    missing.push('limitationNote');
  if (payload.relatedArtifactId !== record.relatedArtifactId)
    missing.push('relatedArtifactId');
  return missing;
}

/**
 * Build the repository-shaped adapter. Without an explicit
 * `enableRepositoryWrites: true`, this returns a
 * `repository_candidate` adapter — type-safe, never persists, never
 * imports backend code.
 *
 * Even when `enableRepositoryWrites: true` is supplied, this slice
 * keeps the adapter in `unavailable` mode (with an explanatory
 * reason) because the underlying writer does not exist yet. This
 * is intentional and load-bearing for the truth contract.
 */
export function createRepositoryAuditAdapter(
  config: IssuerAuditPersistenceAdapterConfig = { mode: 'repository' },
): IssuerAuditPersistenceAdapter {
  if (config.mode !== 'repository') {
    return createPersistenceAdapter(
      chooseIssuerAuditPersistenceAdapter(config),
    );
  }

  if (config.enableRepositoryWrites === true) {
    // Even when an operator opts in, this slice keeps persistence
    // off because no real writer exists. Future ISSUER-9 (or
    // similar) is responsible for wiring a client-safe RPC boundary
    // and toggling the kind to `repository_enabled` for real.
    const decision = chooseIssuerAuditPersistenceAdapter({
      mode: 'none',
      unavailableReason: REPOSITORY_AUDIT_ADAPTER_UNAVAILABLE_REASON,
      wiringDescription:
        config.wiringDescription ??
        'Backend Prisma repository (chai-vc-platform-backend) — bridge pending.',
    });
    return createPersistenceAdapter(decision);
  }

  return createPersistenceAdapter(
    chooseIssuerAuditPersistenceAdapter({
      mode: 'repository',
      enableRepositoryWrites: false,
      wiringDescription:
        config.wiringDescription ??
        'Backend Prisma repository (chai-vc-platform-backend) — type-safe candidate only.',
    }),
  );
}

/**
 * Pure: a sentinel that returns the repository adapter's
 * write-result shape without invoking any writer. Useful for the
 * review surface to display "what would the result look like" without
 * any side effect.
 */
export function previewRepositoryAdapterResult(
  decision: IssuerPersistenceAdapterDecision,
  record: IssuerAuditEventRecord,
): RepositoryAuditAdapterResult {
  void record;
  const baseMode: IssuerAuditPersistenceMode = decision.resultMode;
  return {
    status: decision.kind === 'unavailable' ? 'unavailable' : 'demo_not_persisted',
    mode: baseMode,
    persisted: false,
    message:
      'Preview only. No repository writer was invoked; no row was persisted.',
  };
}
