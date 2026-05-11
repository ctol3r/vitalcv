/**
 * buildPassportLineage — W3-PR213A bridge.
 *
 * Bridges the existing `IngestEvent` Prisma rows (apps/api/backend/
 * prisma/schema.prisma:754) into the `ReplayLineage` shape from #313
 * (apps/api/backend/src/services/passport/replayLineage.ts).
 *
 * Pure function: takes a pre-fetched list of IngestEvent rows + the
 * passport's claimed sources + a wall-clock timestamp, returns a
 * frozen `ReplayLineage` (or null when input is insufficient).
 *
 * NOT included in this PR: the call-site that actually queries Prisma
 * by runId and attaches the result to the passport response. That is
 * the live wiring step. Reasoning:
 *
 *   - Live wiring requires knowing which runId is associated with
 *     which passport request. The existing passport service does not
 *     yet record this binding on the response path; adding it touches
 *     the data flow in passport.ts and passportService.ts and needs
 *     integration tests against a real Postgres fixture.
 *   - This PR is the PURE-FUNCTION foundation. The integration step
 *     becomes a one-line call site: `lineage = buildPassportLineage(
 *     await prisma.ingestEvent.findMany({ where: { ingestRunId } }),
 *     runId, sources, new Date().toISOString())`.
 *
 * Tests run without a DB (pure transform). Integration is the
 * follow-up.
 */

import { buildReplayLineage, type ReplayLineage, type IngestEventLike } from './replayLineage';

/**
 * Structural shape of an `IngestEvent` Prisma row. Typed loosely so
 * this module does not depend on the generated Prisma client (which
 * pulls in the entire schema type).
 */
export interface IngestEventRow {
  readonly ingestRunId: string;
  readonly sequence: number;
  readonly eventType: string;
  readonly sourceId: string | null;
  readonly payload: unknown;
  readonly createdAt: Date | string;
}

/**
 * Adapts an IngestEventRow into the IngestEventLike shape that
 * `buildReplayLineage` expects. We map:
 *   - sourceId: null → undefined (the primitive expects optional)
 *   - createdAt Date → ISO string (lineage stores ISO strings)
 *   - payload: passed through, including the eventId if present
 */
function toIngestEventLike(row: IngestEventRow): IngestEventLike {
  const observedAt =
    typeof row.createdAt === 'string'
      ? row.createdAt
      : row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date().toISOString();
  return {
    type: row.eventType,
    sourceId: row.sourceId ?? undefined,
    timestamp: observedAt,
    payload: row.payload,
  };
}

/**
 * Builds a `ReplayLineage` from a pre-fetched list of `IngestEvent`
 * rows + the passport's claimed sources.
 *
 * Returns null when:
 *   - rows is empty
 *   - rows is non-array
 *   - runId is missing
 *
 * Sorts rows by `sequence` ascending before lineage construction —
 * the database's `(ingestRunId, sequence)` unique constraint
 * guarantees this is deterministic per run.
 *
 * `claimedSources` is the list of sources the passport response
 * claims as `sources.checked`. The lineage's `comprehensive` flag
 * derives from whether every claimed source has a `source_complete`
 * event in the trace.
 */
export function buildPassportLineage(input: {
  rows: readonly IngestEventRow[] | null | undefined;
  runId: string | null | undefined;
  claimedSources?: readonly string[];
  nowIso: string;
}): ReplayLineage | null {
  if (!input.runId || input.runId.length === 0) return null;
  if (!Array.isArray(input.rows) || input.rows.length === 0) return null;

  // Sort ascending by sequence — the DB unique index guarantees
  // (ingestRunId, sequence) is deterministic per run.
  const sorted = [...input.rows].sort((a, b) => a.sequence - b.sequence);

  const events = sorted.map(toIngestEventLike);

  return buildReplayLineage({
    runId: input.runId,
    events,
    claimedSources: input.claimedSources,
    nowIso: input.nowIso,
  });
}
