/**
 * REPLAY-PERSIST-β — Input builder for fire-and-forget replay-run
 * recording from the ingest orchestrator.
 *
 * Pure function: turns the orchestrator's per-source completion
 * summary + the passport-bound checkedAt into the canonical input
 * shape that `recordReplayRun` consumes.
 *
 * Separation of concerns: keeping the input construction pure means
 * the integration site in `ingestOrchestrator.ts` is a single call
 * + a fire-and-forget Promise + a catch. No business logic in the
 * orchestrator hot path; no Prisma access from this module.
 *
 * Artifact-checksum encoding (stable / deterministic):
 *   `<sourceId>:<status>:<claimCount>:<credentialCount>`
 *
 * Two ingest runs that produce the same per-source (status,
 * claimCount, credentialCount) tuple will produce the same
 * artifact-checksum set → the same `lineageKey`. The checksums are
 * not cryptographic hashes; they are deterministic summaries of the
 * source completion state, which is what we want to bind into the
 * lineageKey for institutional continuity.
 */
import type { RecordReplayRunInput } from './replayIdentity';

export interface IngestSourceCompletion {
  readonly sourceId: string;
  readonly status: string;
  readonly claimCount: number;
  readonly credentialCount: number;
}

export interface IngestPassportSummary {
  readonly entityId: string;
  /** ISO 8601 string or Date — matches the contract in replayIdentity.ts */
  readonly lastCheckedAt: string | Date;
}

export const INGEST_REPLAY_CHANNEL = 'ingest_orchestrator';

export function buildReplayWriterInputFromIngest(
  passport: IngestPassportSummary,
  sourceSummary: ReadonlyArray<IngestSourceCompletion>,
): RecordReplayRunInput {
  return {
    entityId: passport.entityId,
    channel: INGEST_REPLAY_CHANNEL,
    checkedAt: passport.lastCheckedAt,
    artifactChecksums: sourceSummary.map(formatArtifactChecksum),
    recordedBy: INGEST_REPLAY_CHANNEL,
  };
}

export function formatArtifactChecksum(source: IngestSourceCompletion): string {
  return `${source.sourceId}:${source.status}:${source.claimCount}:${source.credentialCount}`;
}
