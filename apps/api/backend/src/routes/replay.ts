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
  findReplayRunsByLineageKey,
  verifyReplayRunIntegrity,
} from '../services/replay/replayIdentity';
import { log } from '../obs/logger';

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

export function registerReplayRoutes(app: Express): void {
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
