/**
 * REPLAY-PERSIST-α — Canonical replay identity scheme v1.
 *
 * Pure deterministic identifiers + a thin writer that persists a run.
 * The hashing logic is portable: a browser mirror (apps/web/lib/replay/
 * clientReplayIdentity.ts) can produce byte-identical lineageKey / runId
 * from the same canonical payload using crypto.subtle.digest.
 *
 * Truth invariants:
 *   - Two runs with the same entityId + channel + sorted artifact
 *     checksums produce the SAME `lineageKey`.
 *   - Two runs that additionally share `checkedAt` produce the SAME
 *     `runId`.
 *   - The writer is idempotent on (runId): re-recording the same run
 *     returns the existing row instead of inserting a duplicate.
 */
import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';

export const LINEAGE_PREFIX = 'lin_v1_';
export const RUN_PREFIX = 'run_v1_';
const HASH_DIGEST_LENGTH = 16;

export interface ReplayIdentityInput {
  entityId: string;
  channel: string;
  checkedAt: Date | string;
  artifactChecksums: ReadonlyArray<string>;
}

export interface ReplayIdentity {
  lineageKey: string;
  runId: string;
  payloadDigest: string;
}

function canonical(value: string): string {
  return value.trim();
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sortedChecksumString(checksums: ReadonlyArray<string>): string {
  return [...checksums].map(canonical).sort().join(',');
}

function buildLineagePayload(input: ReplayIdentityInput): string {
  return [
    'entity', canonical(input.entityId),
    'channel', canonical(input.channel),
    'artifacts', sortedChecksumString(input.artifactChecksums),
  ].join('|');
}

function buildRunPayload(input: ReplayIdentityInput): string {
  return buildLineagePayload(input) + '|checkedAt|' + toIsoString(input.checkedAt);
}

function sha256Hex(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function computeLineageKey(input: ReplayIdentityInput): string {
  return LINEAGE_PREFIX + sha256Hex(buildLineagePayload(input)).slice(0, HASH_DIGEST_LENGTH);
}

export function computeRunId(input: ReplayIdentityInput): string {
  return RUN_PREFIX + sha256Hex(buildRunPayload(input)).slice(0, HASH_DIGEST_LENGTH);
}

export function computeReplayIdentity(input: ReplayIdentityInput): ReplayIdentity {
  const payloadDigest = sha256Hex(buildRunPayload(input));
  return {
    lineageKey: computeLineageKey(input),
    runId: computeRunId(input),
    payloadDigest,
  };
}

// ── Writer ──────────────────────────────────────────────────────────────────

export interface RecordReplayRunInput extends ReplayIdentityInput {
  recordedBy?: string;
}

export interface ReplayRunRecord {
  id: string;
  runId: string;
  lineageKey: string;
  entityId: string;
  channel: string;
  checkedAt: Date;
  artifactChecksums: string[];
  payloadDigest: string;
  recordedBy: string;
  createdAt: Date;
}

/**
 * Idempotent writer. If a row with the same runId already exists,
 * returns it unchanged. Otherwise inserts a new row with the computed
 * lineageKey + runId.
 */
export async function recordReplayRun(
  input: RecordReplayRunInput,
): Promise<ReplayRunRecord> {
  const identity = computeReplayIdentity(input);
  const checkedAtDate = input.checkedAt instanceof Date
    ? input.checkedAt
    : new Date(input.checkedAt);

  // upsert keyed by runId (unique). The where clause matches at most one row.
  const row = await prisma.replayRun.upsert({
    where: { runId: identity.runId },
    create: {
      runId: identity.runId,
      lineageKey: identity.lineageKey,
      entityId: canonical(input.entityId),
      channel: canonical(input.channel),
      checkedAt: checkedAtDate,
      artifactChecksums: [...input.artifactChecksums].map(canonical).sort(),
      payloadDigest: identity.payloadDigest,
      recordedBy: input.recordedBy ?? 'system',
    },
    update: {},
  });

  return row as unknown as ReplayRunRecord;
}

export interface RecordReplayEventInput {
  replayRunId: string;
  sequenceNumber: number;
  eventType: string;
  checksum: string;
  occurredAt: Date | string;
  payload?: Record<string, unknown>;
}

/**
 * Idempotent event writer. (replayRunId, sequenceNumber) is the unique
 * key; re-recording the same event is a no-op.
 */
export async function recordReplayEvent(
  input: RecordReplayEventInput,
): Promise<void> {
  const occurredAtDate = input.occurredAt instanceof Date
    ? input.occurredAt
    : new Date(input.occurredAt);

  await prisma.replayEvent.upsert({
    where: {
      replayRunId_sequenceNumber: {
        replayRunId: input.replayRunId,
        sequenceNumber: input.sequenceNumber,
      },
    },
    create: {
      replayRunId: input.replayRunId,
      sequenceNumber: input.sequenceNumber,
      eventType: input.eventType,
      checksum: input.checksum,
      occurredAt: occurredAtDate,
      payload: input.payload as never,
    },
    update: {},
  });
}

// ── Reader helpers ──────────────────────────────────────────────────────────

export async function findReplayRunByRunId(runId: string): Promise<ReplayRunRecord | null> {
  const row = await prisma.replayRun.findUnique({ where: { runId } });
  return (row as unknown as ReplayRunRecord) ?? null;
}

export async function findReplayRunsByLineageKey(
  lineageKey: string,
): Promise<ReplayRunRecord[]> {
  // Chronology is sorted by checkedAt ASC; createdAt is the deterministic
  // tiebreaker for two runs sharing the same checkedAt.
  const rows = await prisma.replayRun.findMany({
    where: { lineageKey },
    orderBy: [{ checkedAt: 'asc' }, { createdAt: 'asc' }],
  });
  return rows as unknown as ReplayRunRecord[];
}

export interface ReplayEventRecord {
  id: string;
  replayRunId: string;
  sequenceNumber: number;
  eventType: string;
  checksum: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export async function findReplayRunsByEntityId(
  entityId: string,
): Promise<ReplayRunRecord[]> {
  // Newest-first ordering for operator-facing discovery endpoints.
  const rows = await prisma.replayRun.findMany({
    where: { entityId },
    orderBy: [{ checkedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows as unknown as ReplayRunRecord[];
}

export async function findReplayEventsForRun(
  replayRunId: string,
): Promise<ReplayEventRecord[]> {
  // Within a run, events MUST sort by sequenceNumber. Tiebreaker by
  // createdAt is defensive — sequenceNumber is already unique within
  // a run.
  const rows = await prisma.replayEvent.findMany({
    where: { replayRunId },
    orderBy: [{ sequenceNumber: 'asc' }],
  });
  return rows as unknown as ReplayEventRecord[];
}

// ── Integrity check ─────────────────────────────────────────────────────────

export type IntegrityVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'lineage_key_mismatch'
        | 'run_id_mismatch'
        | 'payload_digest_mismatch';
      expected: { lineageKey: string; runId: string; payloadDigest: string };
      stored: { lineageKey: string; runId: string; payloadDigest: string };
    };

/**
 * Re-derive (lineageKey, runId, payloadDigest) from the stored fields
 * and compare against what's persisted on the row. Detects tampering
 * with any of: entityId, channel, checkedAt, artifactChecksums. The
 * stored lineageKey/runId/payloadDigest are the bound output of the
 * canonical algorithm over those inputs — any drift surfaces here.
 *
 * Pure function; does not touch the database.
 */
export function verifyReplayRunIntegrity(row: ReplayRunRecord): IntegrityVerdict {
  const recomputed = computeReplayIdentity({
    entityId: row.entityId,
    channel: row.channel,
    checkedAt: row.checkedAt,
    artifactChecksums: row.artifactChecksums,
  });

  if (recomputed.lineageKey !== row.lineageKey) {
    return {
      ok: false,
      reason: 'lineage_key_mismatch',
      expected: recomputed,
      stored: {
        lineageKey: row.lineageKey,
        runId: row.runId,
        payloadDigest: row.payloadDigest,
      },
    };
  }
  if (recomputed.runId !== row.runId) {
    return {
      ok: false,
      reason: 'run_id_mismatch',
      expected: recomputed,
      stored: {
        lineageKey: row.lineageKey,
        runId: row.runId,
        payloadDigest: row.payloadDigest,
      },
    };
  }
  if (recomputed.payloadDigest !== row.payloadDigest) {
    return {
      ok: false,
      reason: 'payload_digest_mismatch',
      expected: recomputed,
      stored: {
        lineageKey: row.lineageKey,
        runId: row.runId,
        payloadDigest: row.payloadDigest,
      },
    };
  }

  return { ok: true };
}
