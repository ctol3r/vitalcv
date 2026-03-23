import type { Express, Request, Response } from 'express';
import { isValidNpi } from '../domain/entity/npiRouter';
import { log } from '../obs/logger';
import type { PersistedIngestEvent } from '../services/ingest/contracts';
import { getIngestRun, startIngestRun } from '../services/ingest/ingestOrchestrator';
import { listIngestEvents } from '../services/ingest/ingestEventStore';

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
  app.post('/api/ingest/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params as { npi: string };

    if (!isValidNpi(npi)) {
      res.status(400).json({ error: 'NPI must be a 10-digit string.' });
      return;
    }

    const run = await startIngestRun(npi);

    log('info', 'ingest_run_started', { runId: run.id, npi, status: run.status });
    res.status(202).json({
      runId: run.id,
      npi,
      status: run.status.toLowerCase(),
    });
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
