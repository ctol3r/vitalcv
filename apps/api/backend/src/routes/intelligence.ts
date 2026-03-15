/**
 * intelligence.ts — Intelligence Engine API
 *
 * Routes:
 *   GET  /api/intelligence/status           — Orchestrator status
 *   POST /api/intelligence/cycle            — Trigger orchestration cycle
 *   POST /api/intelligence/ingest/:npi      — Run ingestion loop for NPI
 *   POST /api/intelligence/anomaly/:npi     — Run anomaly detection for NPI
 *   GET  /api/intelligence/insights         — Get cached/generated insights
 *   GET  /api/intelligence/insights/graph   — Graph topology insights
 *   GET  /api/intelligence/events           — Recent intelligence events
 *   GET  /api/intelligence/learning         — AI decision learning state
 *   POST /api/intelligence/learning/record  — Record AI suggestion decision
 *   GET  /api/intelligence/confidence       — Calibrated confidence thresholds
 */

import type { Express, Request, Response } from 'express';
import {
  getOrchestratorStatus,
  runOrchestrationCycle,
  runIngestionLoop,
  runAnomalyLoop,
  generateInsights,
  getCachedInsights,
  getRecentEvents,
  getDecisionLearningState,
  recordAiDecision,
  calibrateConfidenceThresholds,
} from '../services/intelligence/intelligenceEngine';
import { generateGraphInsights } from '../services/intelligence/graphInsightEngine';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

export function registerIntelligenceEngineRoutes(app: Express): void {

  // ── GET /api/intelligence/status ──────────────────────────────────────────
  app.get('/api/intelligence/status', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/intelligence/v1',
      ...getOrchestratorStatus(),
    });
  });

  // ── POST /api/intelligence/cycle ──────────────────────────────────────────
  app.post('/api/intelligence/cycle', async (req: Request, res: Response) => {
    const body = req.body as { npis?: string[]; maxIngestions?: number; skipInsights?: boolean } | undefined;
    try {
      const result = await runOrchestrationCycle({
        npis:           body?.npis,
        maxIngestions:   body?.maxIngestions,
        skipInsights:    body?.skipInsights,
      });
      res.json({ schema: 'https://vitalcv.com/intelligence-cycle/v1', ...result });
    } catch (err) {
      log('error', `[Intelligence] Cycle failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Orchestration cycle failed' });
    }
  });

  // ── POST /api/intelligence/ingest/:npi ────────────────────────────────────
  app.post('/api/intelligence/ingest/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    try {
      const result = await runIngestionLoop(npi);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Ingestion loop failed', npi });
    }
  });

  // ── POST /api/intelligence/anomaly/:npi ───────────────────────────────────
  app.post('/api/intelligence/anomaly/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    try {
      const result = await runAnomalyLoop(npi);
      const statusCode = result.divergenceCount > 0 ? 207 : 200;
      res.status(statusCode).json(result);
    } catch (err) {
      res.status(500).json({ error: 'Anomaly detection failed', npi });
    }
  });

  // ── GET /api/intelligence/insights ────────────────────────────────────────
  app.get('/api/intelligence/insights', async (req: Request, res: Response) => {
    const fresh = req.query.fresh === 'true';
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;
    try {
      const insights = fresh
        ? await generateInsights({ limit: limitParam })
        : getCachedInsights();
      res.json({
        count:      insights.length,
        insights,
        cached:     !fresh,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Insight generation failed' });
    }
  });

  // ── GET /api/intelligence/insights/graph ──────────────────────────────────
  app.get('/api/intelligence/insights/graph', async (_req: Request, res: Response) => {
    try {
      const insights = await generateGraphInsights();
      res.json({ count: insights.length, insights, generatedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: 'Graph insight generation failed' });
    }
  });

  // ── GET /api/intelligence/events ──────────────────────────────────────────
  app.get('/api/intelligence/events', (req: Request, res: Response) => {
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 100;
    const events = getRecentEvents(Math.min(limitParam, 500));
    res.json({ count: events.length, events });
  });

  // ── GET /api/intelligence/learning ────────────────────────────────────────
  app.get('/api/intelligence/learning', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/decision-learning/v1',
      ...getDecisionLearningState(),
    });
  });

  // ── POST /api/intelligence/learning/record ────────────────────────────────
  app.post('/api/intelligence/learning/record', (req: Request, res: Response) => {
    const { suggestionId, action, strategy } = req.body as {
      suggestionId?: string; action?: string; strategy?: string;
    };
    if (!suggestionId || (action !== 'accept' && action !== 'reject')) {
      return res.status(400).json({
        error: 'Body must include suggestionId: string, action: "accept"|"reject"',
      });
    }
    recordAiDecision(suggestionId, action, strategy);
    res.json({ recorded: true, state: getDecisionLearningState() });
  });

  // ── GET /api/intelligence/confidence ──────────────────────────────────────
  app.get('/api/intelligence/confidence', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/confidence-calibration/v1',
      thresholds: calibrateConfidenceThresholds(),
      decisionState: getDecisionLearningState(),
      computedAt: new Date().toISOString(),
    });
  });
}
