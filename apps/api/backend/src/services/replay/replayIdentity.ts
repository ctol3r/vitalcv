/**
 * Canonical replay identity (Wave 10 of the trust-convergence migration).
 *
 * Every replayable object — a passport, a trust-state snapshot, an
 * employer-review payload — gets two stable identifiers:
 *
 *   lineageKey — permanent identity of the SUBJECT being verified.
 *                Same across every check, snapshot, and review for the
 *                same entity. Survives refresh / restart / deploy /
 *                schema migration unconditionally, because it's a hash
 *                over the entity id alone.
 *
 *   runId      — identity of the specific SNAPSHOT. Stable within one
 *                snapshot, changes when the underlying evidence changes.
 *                Computed as a hash over (entityId + lastCheckedAt +
 *                sorted artifact checksums). Survives refresh / restart
 *                / deploy AS LONG AS the inputs are persisted. The
 *                generator is pure and deterministic — given the same
 *                evidence, two processes on two machines compute the
 *                same id.
 *
 * Survivability contract:
 *   - refresh   ✓ pure function; recomputed identically every request.
 *   - restart   ✓ same inputs from DB → same outputs.
 *   - deploy    ✓ no in-memory state; algorithm versioned via prefix.
 *   - degraded  ✓ as long as `entityId` is available, both ids can
 *                 be produced. Missing artifacts cause the runId to
 *                 reflect that — a degraded run gets a distinct
 *                 deterministic id, NOT a fallback / random value,
 *                 so a verifier can tell a partial run apart from a
 *                 complete one by inspecting which inputs went in.
 *
 * Format:
 *   lineageKey: `lin_v1_<sha256[0:16]>`
 *   runId:      `run_v1_<sha256[0:16]>`
 *
 * The `v1` prefix is the algorithm version. Future input changes that
 * would alter the hash space MUST bump this to v2 so older ids remain
 * recognizable and don't collide with new ones.
 */
import { createHash } from 'node:crypto';

const LINEAGE_PREFIX = 'lin_v1_';
const RUN_PREFIX = 'run_v1_';
const HASH_DIGEST_LENGTH = 16;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Deterministic lineage key for an entity. Same across every run that
 * touches the same entity. The only input is the entity id, so this is
 * stable forever for a given entity, regardless of evidence state.
 *
 * Trimmed + lower-cased internally so cosmetic whitespace or case
 * differences in the entity-id source cannot fork the lineage.
 */
export function computeLineageKey(entityId: string): string {
  const canonical = entityId.trim().toLowerCase();
  if (!canonical) {
    throw new Error('computeLineageKey: entityId is required');
  }
  return `${LINEAGE_PREFIX}${sha256Hex(`entity|${canonical}`).slice(0, HASH_DIGEST_LENGTH)}`;
}

export interface ReplayRunInput {
  /** Entity (NPI / canonical id) being verified. */
  entityId: string;
  /** ISO timestamp of the snapshot. Use the response-level lastCheckedAt;
   *  pass `null` only if no evidence has been collected yet. */
  lastCheckedAt: string | null;
  /** Verification-artifact checksums that contributed to this run.
   *  Order is normalized inside; callers don't need to sort. May be empty
   *  for a fully-degraded run that produced no usable artifacts. */
  artifactChecksums?: readonly string[];
  /** Optional runtime channel — when supplied, lets the hash distinguish
   *  e.g. a preview run from a signed run for the same evidence. */
  channel?: string | null;
}

/**
 * Deterministic run id for a snapshot. Stable for identical inputs;
 * changes only when the underlying evidence or check timing changes.
 *
 * A "degraded" run that produced no artifacts is fine — it gets a
 * distinct stable id derived from `entityId + lastCheckedAt + (empty
 * artifact set)`, which IS observably different from a complete run's
 * id. A verifier comparing two run ids can therefore tell whether the
 * underlying inputs were the same.
 */
export function computeRunId(input: ReplayRunInput): string {
  const canonicalEntity = input.entityId.trim().toLowerCase();
  if (!canonicalEntity) {
    throw new Error('computeRunId: entityId is required');
  }
  const sortedChecksums = [...(input.artifactChecksums ?? [])]
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .sort((a, b) => a.localeCompare(b));
  const channel = (input.channel ?? '').trim().toLowerCase();

  const payload = [
    'entity', canonicalEntity,
    'checkedAt', input.lastCheckedAt ?? 'never',
    'channel', channel,
    'artifacts', sortedChecksums.join(','),
  ].join('|');

  return `${RUN_PREFIX}${sha256Hex(payload).slice(0, HASH_DIGEST_LENGTH)}`;
}

export interface ReplayIdentity {
  lineageKey: string;
  runId: string;
  /** Algorithm version embedded in the id prefixes; useful for clients
   *  that need to gate behavior on the identity scheme. */
  schemeVersion: 'v1';
}

/** Convenience: compute both ids in one call. */
export function computeReplayIdentity(input: ReplayRunInput): ReplayIdentity {
  return {
    lineageKey: computeLineageKey(input.entityId),
    runId: computeRunId(input),
    schemeVersion: 'v1',
  };
}

/**
 * Type guards for downstream consumers that want to validate the
 * scheme version a particular id was issued under (e.g. to handle a
 * future v2 migration without misinterpreting older ids).
 */
export function isV1LineageKey(value: string): boolean {
  return value.startsWith(LINEAGE_PREFIX) && value.length === LINEAGE_PREFIX.length + HASH_DIGEST_LENGTH;
}

export function isV1RunId(value: string): boolean {
  return value.startsWith(RUN_PREFIX) && value.length === RUN_PREFIX.length + HASH_DIGEST_LENGTH;
}
