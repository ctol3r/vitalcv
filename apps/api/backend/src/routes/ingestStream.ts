/**
 * ingestStream.ts — Real-time ingest SSE endpoints
 *
 * POST /api/ingest/:npi
 *   Starts an ingest run. Returns { runId } immediately.
 *   Idempotent: if a run is already in-flight for this NPI, returns existing runId.
 *
 * GET /api/ingest/:runId/stream
 *   Server-Sent Events stream.
 *   Replays any events emitted before the client connected, then streams live.
 *   Closes automatically when the run completes ('done' or 'error').
 *
 * CORS note: SSE requires specific headers for cross-origin clients.
 *   These routes run under the same origin in production (Next.js proxy).
 */

import type { Express, Request, Response } from 'express';
import { startIngestRun, getIngestRun, type IngestEvent } from '../services/ingest/ingestOrchestrator';
import { isValidNpi } from '../domain/entity/npiRouter';
import { log } from '../obs/logger';

// Track active NPI runs to allow idempotent POST
const npiRunMap = new Map<string, string>(); // npi → runId

export function registerIngestStreamRoutes(app: Express): void {

  /**
   * POST /api/ingest/:npi
   *
   * Starts (or returns existing) ingest run for an NPI.
   * Returns: { runId, npi, status }
   */
  app.post('/api/ingest/:npi([0-9]{10})', (req: Request, res: Response) => {
    const { npi } = req.params as { npi: string };

    if (!isValidNpi(npi)) {
      res.status(400).json({ error: 'NPI must be a 10-digit string.' });
      return;
    }

    // Return existing run if still in progress
    const existingRunId = npiRunMap.get(npi);
    if (existingRunId) {
      const existing = getIngestRun(existingRunId);
      if (existing && existing.status !== 'done' && existing.status !== 'error') {
        res.json({ runId: existingRunId, npi, status: existing.status });
        return;
      }
    }

    const runId = startIngestRun(npi);
    npiRunMap.set(npi, runId);

    // Clean up mapping when run completes
    const run = getIngestRun(runId);
    if (run) {
      run.emitter.once('event', function cleanup(evt: IngestEvent) {
        if (evt.type === 'done' || evt.type === 'error') {
          npiRunMap.delete(npi);
        } else {
          run.emitter.once('event', cleanup);
        }
      });
    }

    log('info', 'ingest_run_started', { runId, npi });
    res.status(202).json({ runId, npi, status: 'pending' });
  });

  /**
   * GET /api/ingest/:runId/stream
   *
   * Server-Sent Events stream for a run.
   * - Replays buffered events (for clients that connect after events fired)
   * - Streams live events until 'done' or 'error'
   * - Sends keepalive comment every 15s to prevent proxy timeouts
   */
  app.get('/api/ingest/:runId/stream', (req: Request, res: Response) => {
    const { runId } = req.params as { runId: string };
    const run = getIngestRun(runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found. It may have expired (TTL: 5 min).' });
      return;
    }

    // SSE headers
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');  // nginx: disable buffering
    res.flushHeaders();

    function send(event: IngestEvent): void {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Replay buffered events for late-connecting clients
    for (const evt of run.events) {
      send(evt);
    }

    // If run already finished, close immediately
    if (run.status === 'done' || run.status === 'error') {
      res.end();
      return;
    }

    // Stream live events
    function onEvent(evt: IngestEvent): void {
      send(evt);
      if (evt.type === 'done' || evt.type === 'error') {
        cleanup();
        res.end();
      }
    }

    // Keepalive ping every 15s
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15_000);

    function cleanup(): void {
      clearInterval(keepalive);
      run.emitter.removeListener('event', onEvent);
    }

    run.emitter.on('event', onEvent);

    // Client disconnect
    req.on('close', cleanup);
  });
}
