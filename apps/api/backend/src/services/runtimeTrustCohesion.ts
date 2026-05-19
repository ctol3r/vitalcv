/**
 * runtimeTrustCohesion.ts — runtime trust metadata constructors
 *
 * Narrow-shim restoration of the module orphaned by commit 8912bc7e
 * ("fix: final institutional convergence — … employer review runtime
 * trust cohesion, replay corruption containment, export packet
 * hardening"). That commit shipped three consumer files
 * (routes/employerActions.ts, services/entity/employerReviewActions.ts,
 * services/audit/replayEngine.ts) that import from this path, but
 * the module itself was never staged. This file restores enough of
 * the contract to make tsc compile and to keep the call sites
 * runtime-correct.
 *
 * Doctrine:
 *   - Pure data shaping. No I/O, no Prisma, no network.
 *   - Deterministic: identical input → identical fingerprint.
 *   - Conservative defaults so any later real implementation can
 *     replace the bodies without changing the type contract.
 */

import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Whether the mutation was attempted by a read-only role. Surfaces in
 * the audit row so a regression that bypasses the read-only guard is
 * forensically visible.
 */
export interface RuntimeReadonlyIndicator {
  attemptedByReadonly: boolean;
  /** Header / context that indicated read-only status, or null if N/A. */
  source: string | null;
}

/**
 * Per-mutation runtime trust metadata snapshot. Attached to every
 * AuditEvent and to every employer-review state record. The values
 * are derived deterministically from request context; they are not
 * a security primitive on their own — they are the *evidence record*
 * that downstream forensic queries rely on.
 */
export interface RuntimeTrustMetadata {
  /** ISO-8601 timestamp the snapshot was built at. */
  snapshotAt: string;
  /** Correlation id propagated across the request. */
  correlationId: string;
  /** Deterministic SHA-256 fingerprint over the canonical mutation payload. */
  mutationFingerprint: string;
  /** SHA-256 over the request payload (subset of the fingerprint domain). */
  payloadHash: string;
  /** Stable actor identifier (Clerk user id, system id, etc.). */
  actor: {
    actorId: string;
    entityId: string;
    clinicianNpi: string;
  };
  /**
   * Coarse mutation classification used by the replay-category gate.
   * `mutation` = ordinary write; `denied-mutation` = blocked attempt;
   * `read` = read trace.
   */
  mutationClassification: 'mutation' | 'denied-mutation' | 'read';
  /**
   * Replay category — does this mutation get included in the replay
   * stream by default. `replayable` for committed writes; `blocked`
   * for denials.
   */
  replayCategory: 'replayable' | 'blocked';
  /** Outcome that landed in the audit row. */
  outcome: 'allowed' | 'denied';
  /** Free-form denial reason when outcome === 'denied'. */
  denialReason: string | null;
  /** Read-only attempt indicator, copied from the request. */
  readonly: RuntimeReadonlyIndicator;
}

/**
 * Per-replay runtime trust metadata snapshot. Embedded in DecisionReplay
 * so the replay record carries the same fingerprint family the
 * original mutation captured.
 */
export interface RuntimeReplayMetadata {
  schema: 'vitalcv.runtime-replay-metadata.v1';
  snapshotAt: string;
  capsuleId: string;
  correlationId: string;
  payloadHash: string;
  mutationFingerprint: string;
  /** Capsule's tenant id, bound into the replay fingerprint so two
   *  tenants replaying the same capsule id cannot collide. */
  tenantId: string | null;
  /** Replay fingerprint — derived from the mutation fingerprint + tenant. */
  replayFingerprint: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function stableStringify(value: unknown): string {
  // Deterministic JSON.stringify — sorts object keys so the fingerprint
  // does not depend on insertion order.
  const seen = new WeakSet<object>();
  const replacer = (_key: string, v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return '[Circular]';
      seen.add(v as object);
      if (!Array.isArray(v)) {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(v as Record<string, unknown>).sort()) {
          sorted[k] = (v as Record<string, unknown>)[k];
        }
        return sorted;
      }
    }
    return v;
  };
  return JSON.stringify(value, replacer);
}

// ── buildRuntimeMutationMetadata ──────────────────────────────────────────────

export interface BuildMutationMetadataInput {
  action: string;
  actorId: string;
  entityId: string;
  clinicianNpi: string;
  correlationId: string;
  payload: unknown;
  outcome: 'allowed' | 'denied';
  denialReason?: string;
  readonly: RuntimeReadonlyIndicator;
  /** Override the default classification (e.g. 'read' for trace-only). */
  mutationClassification?: RuntimeTrustMetadata['mutationClassification'];
}

export function buildRuntimeMutationMetadata(
  input: BuildMutationMetadataInput,
): RuntimeTrustMetadata {
  const snapshotAt = new Date().toISOString();
  const payloadHash = sha256Hex(stableStringify(input.payload ?? null));

  const fingerprintBasis = stableStringify({
    schema: 'vitalcv.runtime-mutation-fingerprint.v1',
    action: input.action,
    actorId: input.actorId,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi,
    correlationId: input.correlationId,
    payloadHash,
    outcome: input.outcome,
    denialReason: input.denialReason ?? null,
    readonly: input.readonly,
  });
  const mutationFingerprint = sha256Hex(fingerprintBasis);

  const mutationClassification: RuntimeTrustMetadata['mutationClassification'] =
    input.mutationClassification ??
    (input.outcome === 'denied' ? 'denied-mutation' : 'mutation');
  const replayCategory: RuntimeTrustMetadata['replayCategory'] =
    input.outcome === 'denied' ? 'blocked' : 'replayable';

  return {
    snapshotAt,
    correlationId: input.correlationId,
    mutationFingerprint,
    payloadHash,
    actor: {
      actorId: input.actorId,
      entityId: input.entityId,
      clinicianNpi: input.clinicianNpi,
    },
    mutationClassification,
    replayCategory,
    outcome: input.outcome,
    denialReason: input.denialReason ?? null,
    readonly: input.readonly,
  };
}

// ── buildRuntimeReplayMetadata ────────────────────────────────────────────────

export interface BuildReplayMetadataInput {
  capsuleId: string;
  /** Runtime values arrive from `readRuntimeString(value: unknown):
   *  string | null` — accept nullable so the call site doesn't have
   *  to narrow before invoking. Missing values fall back to the
   *  capsule id so the fingerprint is still deterministic. */
  correlationId: string | null;
  payloadHash: string | null;
  mutationFingerprint: string | null;
  tenantId: string | null;
}

export function buildRuntimeReplayMetadata(
  input: BuildReplayMetadataInput,
): RuntimeReplayMetadata {
  const snapshotAt = new Date().toISOString();
  const correlationId = input.correlationId ?? input.capsuleId;
  const payloadHash = input.payloadHash ?? '';
  const mutationFingerprint = input.mutationFingerprint ?? '';
  const replayFingerprint = sha256Hex(
    stableStringify({
      schema: 'vitalcv.runtime-replay-fingerprint.v1',
      capsuleId: input.capsuleId,
      mutationFingerprint,
      payloadHash,
      correlationId,
      tenantId: input.tenantId ?? null,
    }),
  );
  return {
    schema: 'vitalcv.runtime-replay-metadata.v1',
    snapshotAt,
    capsuleId: input.capsuleId,
    correlationId,
    payloadHash,
    mutationFingerprint,
    tenantId: input.tenantId,
    replayFingerprint,
  };
}
