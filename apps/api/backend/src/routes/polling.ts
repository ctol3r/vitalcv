/**
 * polling.ts — Polling Scheduler API
 *
 * Routes:
 *   GET  /api/polling/status           — Scheduler status + source overview
 *   GET  /api/polling/sources          — Source poll configurations
 *   GET  /api/polling/cycles           — Recent poll cycle results
 *   POST /api/polling/trigger/:source  — Manually trigger source poll
 *   POST /api/polling/trigger-all      — Trigger all enabled source polls
 *   POST /api/polling/burst            — Process a burst event (large batch)
 */

import type { Express, Request, Response } from 'express';
import {
  getPollingStatus,
  getSourcePollConfigs,
  getRecentPollCycles,
  triggerPoll,
  triggerAllPolls,
  processBurstEvent,
  type BurstEventConfig,
} from '../services/polling/pollingScheduler';
import type { IngestionSources } from '../services/identity/identityIngestionPipeline';
import { log } from '../obs/logger';

const VALID_SOURCES: IngestionSources[] = [
  'NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'OPEN_PAYMENTS',
  'SAM_GOV', 'DOCTORS_CLINICIANS', 'NURSYS', 'STATE_BOARD',
  'OPENALEX', 'CLINICAL_TRIALS', 'PUBMED',
];

export function registerPollingRoutes(app: Express): void {

  app.get('/api/polling/status', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/polling-status/v1',
      ...getPollingStatus(),
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/api/polling/sources', (_req: Request, res: Response) => {
    res.json({ sources: getSourcePollConfigs() });
  });

  app.get('/api/polling/cycles', (req: Request, res: Response) => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20;
    res.json({ cycles: getRecentPollCycles(limit) });
  });

  app.post('/api/polling/trigger/:source', async (req: Request, res: Response) => {
    const source = req.params.source as IngestionSources;
    if (!VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` });
    }
    try {
      const result = await triggerPoll(source);
      if (!result) return res.status(404).json({ error: `Source ${source} not configured` });
      res.json(result);
    } catch (err) {
      log('error', `[Polling] Manual trigger ${source} failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: `Poll failed for ${source}` });
    }
  });

  app.post('/api/polling/trigger-all', async (_req: Request, res: Response) => {
    try {
      const results = await triggerAllPolls();
      const summary = {
        sourcesPolled: results.length,
        totalNpis: results.reduce((s, r) => s + r.npisPolled, 0),
        totalEvents: results.reduce((s, r) => s + r.eventsGenerated, 0),
        totalErrors: results.reduce((s, r) => s + r.errors, 0),
        totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
      };
      res.json({ schema: 'https://vitalcv.com/polling-scan/v1', summary, results });
    } catch (err) {
      log('error', `[Polling] Full trigger failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Full poll trigger failed' });
    }
  });

  app.post('/api/polling/burst', async (req: Request, res: Response) => {
    const { source, description, npis, batchSize, delayMs } = req.body as Partial<BurstEventConfig>;

    if (!source || !VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: `source required, must be one of: ${VALID_SOURCES.join(', ')}` });
    }
    if (!npis || !Array.isArray(npis) || npis.length === 0) {
      return res.status(400).json({ error: 'npis array required and must not be empty' });
    }

    try {
      const result = await processBurstEvent({
        source,
        description: description ?? `Manual burst for ${source}`,
        npis,
        batchSize: batchSize ?? 50,
        delayMs: delayMs ?? 1000,
      });
      res.json({ schema: 'https://vitalcv.com/burst-result/v1', ...result });
    } catch (err) {
      log('error', `[Polling] Burst failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Burst processing failed' });
    }
  });
}
