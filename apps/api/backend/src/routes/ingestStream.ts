import type { Express, Request, Response } from 'express';
import { isValidNpi } from '../domain/entity/npiRouter';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import { log } from '../obs/logger';
import type { PersistedIngestEvent } from '../services/ingest/contracts';
import { getIngestRun, startBatchIngestRuns, startIngestRun } from '../services/ingest/ingestOrchestrator';
import { listIngestEvents } from '../services/ingest/ingestEventStore';

const MAX_BATCH_INGEST_NPIS = 25;

function sanitizeBatchNpis(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const unique = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = entry.trim();
    if (!isValidNpi(trimmed)) {
      continue;
    }

    unique.add(trimmed);
    if (unique.size >= MAX_BATCH_INGEST_NPIS) {
      break;
    }
  }

  return [...unique];
}

function parseLastEventId(headerValue: string | undefined): number {
  if (!headerValue) {
    return 0;
  }

  const parsed = Number.parseInt(headerValue, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isTerminalEvent(event: PersistedIngestEvent): boolean {
  return event.type === 'done' || event.type === 'error';
}

function isTerminalRunStatus(status: string): boolean {
  return status === 'DONE' || status === 'ERROR';
}

export function registerIngestStreamRoutes(app: Express): void {
  app.post('/api/ingest/batch', async (req: Request, res: Response) => {
    const npis = sanitizeBatchNpis((req.body as Record<string, unknown> | undefined)?.npis);
    if (npis.length === 0) {
      res.status(400).json({
        error: 'invalid_batch_npis',
        error_description: `npis must include at least one valid 10-digit NPI (max ${MAX_BATCH_INGEST_NPIS}).`,
      });
      return;
    }

    try {
      const runs = await startBatchIngestRuns(npis);
      res.status(202).json({
        submitted: runs.map(({ npi, run }) => ({
          npi,
          runId: run.id,
          status: run.status.toLowerCase(),
        })),
        submittedCount: runs.length,
      });
    } catch (error) {
      log('error', 'ingest_batch_failed_to_start', {
        npis,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to start ingest batch.' });
    }
  });

  app.post('/api/ingest/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params as { npi: string };

    if (!isValidNpi(npi)) {
      res.status(400).json({ error: 'NPI must be a 10-digit string.' });
      return;
    }

    try {
      const run = await startIngestRun(npi);

      // Learning: track NPI check event (fire-and-forget)
      emitLearningEvent({ type: 'NPI_CHECKED', providerId: npi, metadata: {}, payload: {} });

      log('info', 'ingest_run_started', { runId: run.id, npi, status: run.status });
      res.status(202).json({
        runId: run.id,
        npi,
        status: run.status.toLowerCase(),
      });
    } catch (error) {
      log('error', 'ingest_run_failed_to_start', { npi, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to start ingest run.' });
    }
  });

  app.get('/api/ingest/:runId/stream', async (req: Request, res: Response) => {
    const { runId } = req.params as { runId: string };
    const run = await getIngestRun(runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let lastSequence = parseLastEventId(req.header('Last-Event-ID'));
    let polling = false;

    function send(event: PersistedIngestEvent): void {
      res.write(`id: ${event.sequence}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    async function flushNewEvents(): Promise<void> {
      if (polling) {
        return;
      }
      polling = true;
      try {
        const events = await listIngestEvents(runId, { afterSequence: lastSequence });
        for (const event of events) {
          lastSequence = event.sequence;
          send(event);
        }

        const latestRun = await getIngestRun(runId);
        const lastEvent = events.at(-1);
        if (
          latestRun
          && isTerminalRunStatus(latestRun.status)
          && (!lastEvent || isTerminalEvent(lastEvent))
        ) {
          cleanup();
          res.end();
        }
      } finally {
        polling = false;
      }
    }

    const poller = setInterval(() => {
      void flushNewEvents();
    }, 1_000);

    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15_000);

    function cleanup(): void {
      clearInterval(poller);
      clearInterval(keepalive);
    }

    req.on('close', cleanup);

    void flushNewEvents();
  });
}
