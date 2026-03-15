/**
 * storylines.ts — Storyline API
 *
 * Routes:
 *   GET    /api/storylines                — Query storylines
 *   GET    /api/storylines/stats          — Storyline statistics
 *   GET    /api/storylines/:id            — Single storyline detail
 *   GET    /api/storylines/npi/:npi       — Storylines for a provider
 *   POST   /api/storylines/:id/feedback   — User feedback
 *   POST   /api/storylines/cluster        — Trigger manual clustering
 */

import type { Express, Request, Response } from 'express';
import {
  queryStorylines,
  getStorylineById,
  getStorylinesForNpi,
  getStorylineStats,
  recordStorylineFeedback,
  clusterFindings,
  type StorylineType,
  type StorylineStage,
  type StorylineFeedback,
} from '../services/storylines/storylineEngine';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const VALID_FEEDBACK: StorylineFeedback[] = ['acknowledge', 'dismiss', 'escalate', 'archive', 'save', 'compare', 'follow_up'];

export function registerStorylineRoutes(app: Express): void {

  app.get('/api/storylines', (req: Request, res: Response) => {
    const types = typeof req.query.type === 'string'
      ? req.query.type.split(',') as StorylineType[]
      : undefined;
    const stages = typeof req.query.stage === 'string'
      ? req.query.stage.split(',') as StorylineStage[]
      : undefined;
    const npis = typeof req.query.npi === 'string'
      ? req.query.npi.split(',')
      : undefined;
    const status = typeof req.query.status === 'string'
      ? req.query.status.split(',') as ('ACTIVE' | 'ACKNOWLEDGED' | 'ARCHIVED' | 'RESOLVED')[]
      : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;
    const minScore = typeof req.query.minScore === 'string' ? parseInt(req.query.minScore) : undefined;

    const results = queryStorylines({ types, stages, npis, status, limit, minScore });
    res.json({
      schema: 'https://vitalcv.com/storylines/v1',
      count: results.length,
      storylines: results,
      stats: getStorylineStats(),
    });
  });

  app.get('/api/storylines/stats', (_req: Request, res: Response) => {
    res.json({ schema: 'https://vitalcv.com/storylines-stats/v1', ...getStorylineStats() });
  });

  app.get('/api/storylines/npi/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    const results = getStorylinesForNpi(npi);
    res.json({ npi, count: results.length, storylines: results });
  });

  app.get('/api/storylines/:id', (req: Request, res: Response) => {
    const storyline = getStorylineById(req.params.id);
    if (!storyline) return res.status(404).json({ error: 'Storyline not found' });
    res.json(storyline);
  });

  app.post('/api/storylines/:id/feedback', (req: Request, res: Response) => {
    const { action } = req.body as { action?: string };
    if (!action || !VALID_FEEDBACK.includes(action as StorylineFeedback)) {
      return res.status(400).json({ error: `action must be one of: ${VALID_FEEDBACK.join(', ')}` });
    }
    const updated = recordStorylineFeedback(req.params.id, action as StorylineFeedback);
    if (!updated) return res.status(404).json({ error: 'Storyline not found' });
    res.json({ updated: true, storyline: updated });
  });

  app.post('/api/storylines/cluster', (_req: Request, res: Response) => {
    try {
      const result = clusterFindings();
      res.json({
        schema: 'https://vitalcv.com/storylines-cluster/v1',
        ...result,
        stats: getStorylineStats(),
      });
    } catch (err) {
      log('error', `[Storylines] Clustering failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Clustering failed' });
    }
  });
}
