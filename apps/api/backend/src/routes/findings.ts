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
  recordFeedback,
  getFeedbackHistory,
  getFeedStats,
  listInvestigators,
  type FeedbackAction,
} from '../services/investigators/framework';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
  setInvestigatorFindingStatus,
} from '../services/investigators/investigatorEngineService';
import { isInvestigatorFindingStatus, normalizeInvestigatorFindingStatus } from '../../../../../core/investigators/investigatorTypes';
import { runAllScans } from '../services/investigators/orchestrator';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const VALID_FEEDBACK: FeedbackAction[] = ['acknowledge', 'dismiss', 'escalate', 'save', 'compare', 'follow_up'];

function normalizeListParam(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeListParam(entry));
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function summarizePersistentFindings(findings: Awaited<ReturnType<typeof listInvestigatorFindings>>['findings']) {
  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byType[finding.findingType] = (byType[finding.findingType] ?? 0) + 1;
    byStatus[finding.status] = (byStatus[finding.status] ?? 0) + 1;
  }

  return {
    total: findings.length,
    active: findings.filter((finding) => finding.status !== 'dismissed' && finding.status !== 'resolved').length,
    bySeverity,
    byCategory: byType,
    byStatus,
  };
}

export function registerFindingsRoutes(app: Express): void {

  // ── GET /api/findings ─────────────────────────────────────────────────────
  app.get('/api/findings', async (req: Request, res: Response) => {
    try {
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
      const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;
      const provider = typeof req.query.npi === 'string'
        ? req.query.npi
        : typeof req.query.provider === 'string'
          ? req.query.provider
          : null;
      const findings = await listInvestigatorFindings({
        severity: normalizeListParam(req.query.severity),
        findingType: normalizeListParam(req.query.type ?? req.query.findingType ?? req.query.category),
        status: normalizeListParam(req.query.status),
        investigatorId: normalizeListParam(req.query.investigatorId),
        provider,
        institution: typeof req.query.institution === 'string' ? req.query.institution : null,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : null,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : null,
        minConfidence: typeof req.query.minConfidence === 'string'
          ? Number.parseFloat(req.query.minConfidence)
          : null,
        limit,
        offset,
      });

      res.json({
        schema: 'https://vitalcv.com/findings/v2',
        count: findings.findings.length,
        total: findings.total,
        findings: findings.findings,
        stats: summarizePersistentFindings(findings.findings),
      });
    } catch (error) {
      log('error', '[Findings] list failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to load findings feed' });
    }
  });

  // ── GET /api/findings/stats ───────────────────────────────────────────────
  app.get('/api/findings/stats', async (_req: Request, res: Response) => {
    try {
      const result = await listInvestigatorFindings({ limit: 200, offset: 0 });
      res.json({ schema: 'https://vitalcv.com/findings-stats/v2', ...summarizePersistentFindings(result.findings) });
    } catch (error) {
      log('error', '[Findings] stats failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to load finding stats' });
    }
  });

  // ── GET /api/findings/feedback/history ────────────────────────────────────
  app.get('/api/findings/feedback/history', (req: Request, res: Response) => {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 50;
    res.json({ history: getFeedbackHistory(limit) });
  });

  // ── GET /api/findings/npi/:npi ────────────────────────────────────────────
  app.get('/api/findings/npi/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI' });
    }
    try {
      const results = await listInvestigatorFindings({ provider: npi, limit: 100, offset: 0 });
      res.json({ npi, count: results.findings.length, findings: results.findings });
    } catch (error) {
      log('error', '[Findings] provider list failed', { error: error instanceof Error ? error.message : String(error), npi });
      res.status(500).json({ error: 'Failed to load provider findings' });
    }
  });

  // ── GET /api/findings/:id ─────────────────────────────────────────────────
  app.get('/api/findings/:id', async (req: Request, res: Response) => {
    const finding = await getInvestigatorFinding(req.params.id);
    if (!finding) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    res.json({ finding });
  });

  app.patch('/api/findings/:id/status', async (req: Request, res: Response) => {
    const statusInput = typeof req.body?.status === 'string' ? req.body.status : null;
    if (!statusInput) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!isInvestigatorFindingStatus(statusInput)) {
      return res.status(400).json({ error: 'Invalid finding status' });
    }

    try {
      const finding = await setInvestigatorFindingStatus(
        req.params.id,
        normalizeInvestigatorFindingStatus(statusInput),
        {
        actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : null,
        note: typeof req.body?.note === 'string' ? req.body.note : null,
        },
      );
      res.json({ finding });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Finding not found' });
      }
      log('error', '[Findings] status update failed', { error: message, findingId: req.params.id });
      res.status(500).json({ error: 'Failed to update finding status' });
    }
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
