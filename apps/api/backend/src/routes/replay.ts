/**
 * REPLAY-PERSIST-α — Backend HTTP handlers for replay retrieval.
 *
 * Exposed surfaces:
 *
 *   GET /api/replay/runs/:runId
 *     → returns the ReplayRun row + its ordered events.
 *     → 404 when no row exists for runId.
 *
 *   GET /api/replay/lineage/:lineageKey/runs
 *     → returns all ReplayRun rows for the lineage, sorted by checkedAt asc.
 *     → 200 with empty list when no rows exist.
 *
 *   GET /api/replay/lineage/:lineageKey/receipt
 *     → returns the receipt-derivable payload for the most recent run
 *       on the lineage. The actual JWT signing lives on the web layer
 *       (apps/web/lib/crypto/receiptIssuer.ts) — this handler returns
 *       only the deterministic inputs the web layer needs to sign.
 *     → 404 when no row exists for the lineage.
 *
 * Truth invariants:
 *   - Chronology ordering is deterministic: checkedAt asc, createdAt
 *     asc tiebreaker. Within a run, events sort by sequenceNumber.
 *   - 16-char hex check on lineageKey / runId is enforced before
 *     touching Prisma; malformed inputs return 400 without a DB query.
 */
import type { Express, Request, Response } from 'express';
import {
  LINEAGE_PREFIX,
  RUN_PREFIX,
  findReplayEventsForRun,
  findReplayRunByRunId,
  findReplayRunsByEntityId,
  findReplayRunsByLineageKey,
  verifyReplayRunIntegrity,
  type ReplayRunRecord,
} from '../services/replay/replayIdentity';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function isValidNpi(value: string): boolean {
  return NPI_RE.test(value);
}

// Decode the canonical artifact-checksum encoding from
// `services/replay/replayWriterIngest.ts`. Pure best-effort decode:
// rows whose checksums don't match the expected colon-delimited shape
// return null entries so the caller can still render the raw string.
function parseArtifactChecksum(checksum: string): {
  sourceId: string;
  status: string;
  claimCount: number | null;
  credentialCount: number | null;
} | null {
  const parts = checksum.split(':');
  if (parts.length !== 4) return null;
  const claimCount = Number.parseInt(parts[2], 10);
  const credentialCount = Number.parseInt(parts[3], 10);
  return {
    sourceId: parts[0],
    status: parts[1],
    claimCount: Number.isFinite(claimCount) ? claimCount : null,
    credentialCount: Number.isFinite(credentialCount) ? credentialCount : null,
  };
}

// Run-level status derived from the per-source statuses in the
// artifactChecksums array. The derivation is honest about
// missing or unparseable checksums.
function deriveRunStatus(checksums: ReadonlyArray<string>): string {
  const parsed = checksums.map(parseArtifactChecksum);
  if (parsed.length === 0) return 'UNKNOWN';
  const statuses = parsed.map((p) => (p ? p.status : 'UNKNOWN'));
  if (statuses.every((s) => s === 'DONE')) return 'DONE';
  if (statuses.some((s) => s === 'ERROR')) return 'PARTIAL_ERROR';
  if (statuses.some((s) => s === 'UNKNOWN')) return 'UNKNOWN';
  return 'MIXED';
}

function renderRunSummary(row: ReplayRunRecord): Record<string, unknown> {
  return {
    runId: row.runId,
    lineageKey: row.lineageKey,
    checkedAt: row.checkedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    status: deriveRunStatus(row.artifactChecksums),
    sourceSummary: row.artifactChecksums.map((c) => {
      const parsed = parseArtifactChecksum(c);
      return parsed ?? { raw: c };
    }),
  };
}

const RUN_ID_RE = /^run_v1_[0-9a-f]{16}$/;
const LINEAGE_KEY_RE = /^lin_v1_[0-9a-f]{16}$/;

/**
 * Detect "replay tables don't exist yet in this database" — the case
 * where the migration has not been applied (e.g. on a fresh staging
 * environment, or before Railway picks up the new migration). Prisma
 * raises `P2021` when a queried table is missing. We return a stable
 * 503 with a known error code so callers (web proxies, future UI) can
 * branch deterministically rather than seeing a 500.
 */
function isPrismaTableMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  const message = (err as { message?: unknown }).message;
  if (code === 'P2021') return true;
  if (typeof message === 'string' && /does not exist in the current database|relation .* does not exist/i.test(message)) {
    return true;
  }
  return false;
}

function sendReplayInfrastructureUnavailable(res: Response, err: unknown): void {
  log('warn', 'replay_infrastructure_unavailable', {
    error: String(err),
    hint: 'apply the REPLAY-PERSIST-α migration (20260513000000_replay_run_persistence)',
  });
  res.status(503).json({
    error: 'replay_infrastructure_unavailable',
    detail: 'Replay persistence tables are not present in this database. Apply the REPLAY-PERSIST-α migration.',
  });
}

function isValidRunId(value: string): boolean {
  return RUN_ID_RE.test(value);
}

function isValidLineageKey(value: string): boolean {
  return LINEAGE_KEY_RE.test(value);
}

// ── NPI-keyed discoverability surfaces ─────────────────────────────────────

interface VcvEntityLookup {
  id: string;
  npi: string | null;
  entityType: string;
}

async function findVcvEntityForNpi(npi: string): Promise<VcvEntityLookup | null> {
  // findFirst because `npi` is indexed but not unique on VcvEntity
  // (the unique key is `canonicalId`). Newest entity wins if multiple
  // rows somehow exist.
  const row = await prisma.vcvEntity.findFirst({
    where: { npi },
    select: { id: true, npi: true, entityType: true },
    orderBy: { createdAt: 'desc' },
  });
  return row as VcvEntityLookup | null;
}

export function registerReplayRoutes(app: Express): void {
  app.get(
    '/api/replay/runs/by-npi/:npi',
    async (req: Request, res: Response) => {
      const { npi } = req.params;
      if (!isValidNpi(npi)) {
        res.status(400).json({
          error: 'invalid_npi',
          expected: '10 digits',
        });
        return;
      }

      try {
        const entity = await findVcvEntityForNpi(npi);
        if (!entity) {
          // No entity yet — respond with an empty-runs shape rather than
          // 404 so callers can render "no observations yet" uniformly.
          res.status(200).json({ npi, entityId: null, runs: [] });
          return;
        }

        const runs = await findReplayRunsByEntityId(entity.id);
        res.status(200).json({
          npi,
          entityId: entity.id,
          runs: runs.map(renderRunSummary),
        });
      } catch (err) {
        if (isPrismaTableMissingError(err)) {
          sendReplayInfrastructureUnavailable(res, err);
          return;
        }
        log('error', 'replay_runs_by_npi_failed', { npi, error: String(err) });
        res.status(500).json({ error: 'internal_error' });
      }
    },
  );

  app.get(
    '/api/replay/chain/:npi',
    async (req: Request, res: Response) => {
      const { npi } = req.params;
      if (!isValidNpi(npi)) {
        res.status(400).json({
          error: 'invalid_npi',
          expected: '10 digits',
        });
        return;
      }

      try {
        const entity = await findVcvEntityForNpi(npi);
        if (!entity) {
          res.status(200).json({ npi, entityId: null, lineages: [] });
          return;
        }

        const runs = await findReplayRunsByEntityId(entity.id);
        // Group by lineageKey while preserving newest-first run order
        // within each lineage. The first run encountered for a given
        // lineageKey is therefore the latest.
        const byLineage = new Map<string, ReplayRunRecord[]>();
        for (const r of runs) {
          const bucket = byLineage.get(r.lineageKey);
          if (bucket) {
            bucket.push(r);
          } else {
            byLineage.set(r.lineageKey, [r]);
          }
        }

        // The latest lineage overall is the one that contains the
        // newest run. Because `runs` is already sorted newest-first,
        // the first key inserted into the map IS the latest lineage.
        const lineageKeysInLatestOrder = Array.from(byLineage.keys());
        const latestLineage = lineageKeysInLatestOrder[0] ?? null;

        const lineages = lineageKeysInLatestOrder.map((lineageKey) => {
          const bucket = byLineage.get(lineageKey) as ReplayRunRecord[];
          const latest = bucket[0];
          const isCurrent = lineageKey === latestLineage;
          const continuityState: 'stable' | 'extended' | 'diverged' =
            !isCurrent
              ? 'diverged'
              : bucket.length === 1
                ? 'stable'
                : 'extended';
          return {
            lineageKey,
            historyCount: bucket.length,
            latestRunId: latest.runId,
            latestCheckedAt: latest.checkedAt.toISOString(),
            continuityState,
          };
        });

        res.status(200).json({
          npi,
          entityId: entity.id,
          lineages,
        });
      } catch (err) {
        if (isPrismaTableMissingError(err)) {
          sendReplayInfrastructureUnavailable(res, err);
          return;
        }
        log('error', 'replay_chain_by_npi_failed', { npi, error: String(err) });
        res.status(500).json({ error: 'internal_error' });
      }
    },
  );


  app.get('/api/replay/runs/:runId', async (req: Request, res: Response) => {
    const { runId } = req.params;
    if (!isValidRunId(runId)) {
      res.status(400).json({
        error: 'invalid_run_id',
        expected: `${RUN_PREFIX}<16 lowercase hex chars>`,
      });
      return;
    }

    try {
      const run = await findReplayRunByRunId(runId);
      if (!run) {
        res.status(404).json({ error: 'replay_run_not_found', runId });
        return;
      }

      const events = await findReplayEventsForRun(run.id);

      res.status(200).json({
        run: {
          runId: run.runId,
          lineageKey: run.lineageKey,
          entityId: run.entityId,
          channel: run.channel,
          checkedAt: run.checkedAt.toISOString(),
          artifactChecksums: run.artifactChecksums,
          payloadDigest: run.payloadDigest,
          recordedBy: run.recordedBy,
          createdAt: run.createdAt.toISOString(),
        },
        events: events.map((e) => ({
          sequenceNumber: e.sequenceNumber,
          eventType: e.eventType,
          checksum: e.checksum,
          occurredAt: e.occurredAt.toISOString(),
          payload: e.payload,
        })),
      });
    } catch (err) {
      if (isPrismaTableMissingError(err)) {
        sendReplayInfrastructureUnavailable(res, err);
        return;
      }
      log('error', 'replay_run_fetch_failed', { runId, error: String(err) });
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.get(
    '/api/replay/lineage/:lineageKey/runs',
    async (req: Request, res: Response) => {
      const { lineageKey } = req.params;
      if (!isValidLineageKey(lineageKey)) {
        res.status(400).json({
          error: 'invalid_lineage_key',
          expected: `${LINEAGE_PREFIX}<16 lowercase hex chars>`,
        });
        return;
      }

      try {
        const runs = await findReplayRunsByLineageKey(lineageKey);
        res.status(200).json({
          lineageKey,
          runs: runs.map((r) => ({
            runId: r.runId,
            entityId: r.entityId,
            channel: r.channel,
            checkedAt: r.checkedAt.toISOString(),
            artifactChecksums: r.artifactChecksums,
            payloadDigest: r.payloadDigest,
            recordedBy: r.recordedBy,
            createdAt: r.createdAt.toISOString(),
          })),
        });
      } catch (err) {
        if (isPrismaTableMissingError(err)) {
          sendReplayInfrastructureUnavailable(res, err);
          return;
        }
        log('error', 'replay_lineage_fetch_failed', { lineageKey, error: String(err) });
        res.status(500).json({ error: 'internal_error' });
      }
    },
  );

  app.get(
    '/api/replay/runs/:runId/integrity',
    async (req: Request, res: Response) => {
      const { runId } = req.params;
      if (!isValidRunId(runId)) {
        res.status(400).json({
          error: 'invalid_run_id',
          expected: `${RUN_PREFIX}<16 lowercase hex chars>`,
        });
        return;
      }

      try {
        const run = await findReplayRunByRunId(runId);
        if (!run) {
          res.status(404).json({ error: 'replay_run_not_found', runId });
          return;
        }
        const verdict = verifyReplayRunIntegrity(run);
        res.status(200).json({ runId, ...verdict });
      } catch (err) {
        if (isPrismaTableMissingError(err)) {
          sendReplayInfrastructureUnavailable(res, err);
          return;
        }
        log('error', 'replay_run_integrity_failed', { runId, error: String(err) });
        res.status(500).json({ error: 'internal_error' });
      }
    },
  );

  app.get(
    '/api/replay/lineage/:lineageKey/receipt',
    async (req: Request, res: Response) => {
      const { lineageKey } = req.params;
      if (!isValidLineageKey(lineageKey)) {
        res.status(400).json({
          error: 'invalid_lineage_key',
          expected: `${LINEAGE_PREFIX}<16 lowercase hex chars>`,
        });
        return;
      }

      try {
        const runs = await findReplayRunsByLineageKey(lineageKey);
        if (runs.length === 0) {
          res.status(404).json({ error: 'replay_lineage_not_found', lineageKey });
          return;
        }

        // The receipt derives from the MOST RECENT run on this lineage
        // (deterministic per the checkedAt asc, createdAt asc ordering
        // in findReplayRunsByLineageKey — last element is most recent).
        const latest = runs[runs.length - 1];

        res.status(200).json({
          lineageKey,
          runId: latest.runId,
          entityId: latest.entityId,
          channel: latest.channel,
          checkedAt: latest.checkedAt.toISOString(),
          artifactChecksums: latest.artifactChecksums,
          payloadDigest: latest.payloadDigest,
          // The deterministic jti the web signer will use:
          //   `receipt:` + runId. The web layer (which holds the ES256
          //   private key) is responsible for the actual JWT signing.
          derivedJti: `receipt:${latest.runId}`,
          historyCount: runs.length,
        });
      } catch (err) {
        if (isPrismaTableMissingError(err)) {
          sendReplayInfrastructureUnavailable(res, err);
          return;
        }
        log('error', 'replay_lineage_receipt_fetch_failed', { lineageKey, error: String(err) });
        res.status(500).json({ error: 'internal_error' });
      }
    },
  );
}
