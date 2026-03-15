/**
 * findings.ts — Findings Feed API
 *
 * Routes:
 *   GET    /api/findings                  — Query findings feed
 *   GET    /api/findings/stats            — Feed statistics
 *   GET    /api/findings/:id              — Single finding detail
 *   GET    /api/findings/npi/:npi         — Findings for a specific NPI
 *   POST   /api/findings/:id/feedback     — Submit user feedback
 *   GET    /api/findings/feedback/history  — Feedback log
 *   GET    /api/investigators             — List registered investigators
 *   POST   /api/investigators/scan        — Trigger manual scan
 */

import type { Express, Request, Response } from 'express';
import {
  queryFindings,
  getFindingById,
  getFindingsForNpi,
  getFeedStats,
  recordFeedback,
  getFeedbackHistory,
  listInvestigators,
  type FeedbackAction,
  type FindingCategory,
  type FindingSeverity,
} from '../services/investigators/framework';
import { runAllScans } from '../services/investigators/orchestrator';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const VALID_FEEDBACK: FeedbackAction[] = ['acknowledge', 'dismiss', 'escalate', 'save', 'compare', 'follow_up'];

export function registerFindingsRoutes(app: Express): void {

  // ── GET /api/findings ─────────────────────────────────────────────────────
  app.get('/api/findings', (req: Request, res: Response) => {
    const categories = typeof req.query.category === 'string'
      ? req.query.category.split(',') as FindingCategory[]
      : undefined;
    const severities = typeof req.query.severity === 'string'
      ? req.query.severity.split(',') as FindingSeverity[]
      : undefined;
    const npis = typeof req.query.npi === 'string'
      ? req.query.npi.split(',')
      : undefined;
    const status = typeof req.query.status === 'string'
      ? req.query.status.split(',') as ('ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ESCALATED' | 'EXPIRED')[]
      : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;
    const minScore = typeof req.query.minScore === 'string' ? parseInt(req.query.minScore) : undefined;

    const results = queryFindings({ categories, severities, npis, status, limit, minScore });
    res.json({
      schema: 'https://vitalcv.com/findings/v1',
      count: results.length,
      findings: results,
      stats: getFeedStats(),
    });
  });

  // ── GET /api/findings/stats ───────────────────────────────────────────────
  app.get('/api/findings/stats', (_req: Request, res: Response) => {
    res.json({ schema: 'https://vitalcv.com/findings-stats/v1', ...getFeedStats() });
  });

  // ── GET /api/findings/feedback/history ────────────────────────────────────
  app.get('/api/findings/feedback/history', (req: Request, res: Response) => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
    res.json({ history: getFeedbackHistory(limit) });
  });

  // ── GET /api/findings/npi/:npi ────────────────────────────────────────────
  app.get('/api/findings/npi/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) return res.status(400).json({ error: 'Invalid NPI' });
    const results = getFindingsForNpi(npi);
    res.json({ npi, count: results.length, findings: results });
  });

  // ── GET /api/findings/:id ─────────────────────────────────────────────────
  app.get('/api/findings/:id', (req: Request, res: Response) => {
    const finding = getFindingById(req.params.id);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    res.json(finding);
  });

  // ── POST /api/findings/:id/feedback ───────────────────────────────────────
  app.post('/api/findings/:id/feedback', (req: Request, res: Response) => {
    const { action, userId, note } = req.body as {
      action?: string; userId?: string; note?: string;
    };

    if (!action || !VALID_FEEDBACK.includes(action as FeedbackAction)) {
      return res.status(400).json({
        error: `action must be one of: ${VALID_FEEDBACK.join(', ')}`,
      });
    }

    const updated = recordFeedback(req.params.id, action as FeedbackAction, userId, note);
    if (!updated) return res.status(404).json({ error: 'Finding not found' });
    res.json({ updated: true, finding: updated });
  });

  // ── GET /api/investigators ────────────────────────────────────────────────
  app.get('/api/investigators', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/investigators/v1',
      investigators: listInvestigators(),
      stats: getFeedStats(),
    });
  });

  // ── POST /api/investigators/scan ──────────────────────────────────────────
  app.post('/api/investigators/scan', async (_req: Request, res: Response) => {
    try {
      const result = await runAllScans();
      res.json({
        schema: 'https://vitalcv.com/investigators-scan/v1',
        ...result,
      });
    } catch (err) {
      log('error', `[Findings] Scan failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Investigator scan failed' });
    }
  });
}
