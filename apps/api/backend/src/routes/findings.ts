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
  type FeedbackAction,
} from '../services/investigators/framework';
import {
  recordOutcome,
  getCalibrationStats,
  getLearningLoopStats,
  getOutcomeHistory,
  isValidOutcome,
  isValidEvidenceQuality,
  VALID_OUTCOMES,
  VALID_EVIDENCE_QUALITIES,
} from '../services/investigators/learningLoopService';
import {
  getInvestigatorFinding,
  listInvestigatorFindings,
  runTargetedInvestigators,
  setInvestigatorFindingStatus,
} from '../services/investigators/investigatorEngineService';
import { buildFindingExplainPayload } from '../services/investigators/findingExplainService';
import { isInvestigatorFindingStatus, normalizeInvestigatorFindingStatus } from '../../../../../core/investigators/investigatorTypes';
import { log } from '../obs/logger';
import { listInvestigatorRuntimeSummaries } from '../services/investigation/investigatorRuntimeService';
import { IGNITION_INVESTIGATOR_IDS } from '../services/investigators/ignitionInvestigators';

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

  // ── GET /api/findings/:id/explain ─────────────────────────────────────────
  app.get('/api/findings/:id/explain', async (req: Request, res: Response) => {
    try {
      const payload = await buildFindingExplainPayload(req.params.id);
      if (!payload) {
        return res.status(404).json({ error: 'Finding not found' });
      }
      res.json(payload);
    } catch (error) {
      log('error', '[Findings] explain failed', {
        error: error instanceof Error ? error.message : String(error),
        findingId: req.params.id,
      });
      res.status(500).json({ error: 'Failed to explain finding' });
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
  app.get('/api/investigators', async (_req: Request, res: Response) => {
    try {
      const investigators = await listInvestigatorRuntimeSummaries();
      res.json({
        schema: 'https://vitalcv.com/investigators/runtime/v2',
        generatedAt: new Date().toISOString(),
        investigators,
        stats: {
          total: investigators.length,
          activeFindings: investigators.reduce((sum, investigator) => sum + investigator.activeFindingCount, 0),
          recentFindings: investigators.reduce((sum, investigator) => sum + investigator.recentFindingCount, 0),
        },
      });
    } catch (error) {
      log('error', '[Findings] investigator runtime list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load investigator runtime' });
    }
  });

  // ── POST /api/investigators/scan ──────────────────────────────────────────
  app.post('/api/investigators/scan', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      investigatorIds?: string[];
      entityType?: string;
      targetEntityIds?: string[];
      npi?: string | string[];
    };
    const investigatorIds = Array.isArray(body.investigatorIds) && body.investigatorIds.length > 0
      ? body.investigatorIds
      : [...IGNITION_INVESTIGATOR_IDS];
    const npis = typeof body.npi === 'string'
      ? [body.npi]
      : Array.isArray(body.npi)
        ? body.npi
        : [];
    const targetEntityIds = [...new Set([
      ...(Array.isArray(body.targetEntityIds) ? body.targetEntityIds : []),
      ...npis,
    ].filter((value) => /^\d{10}$/.test(value)))];

    try {
      const runs = await runTargetedInvestigators({
        entityType: body.entityType ?? 'provider',
        targetEntityIds,
        investigatorIds,
        trigger: 'manual',
        metadata: {
          source: 'api_investigators_scan',
        },
      });
      res.json({
        schema: 'https://vitalcv.com/investigators-scan/v2',
        investigatorIds,
        targetEntityIds,
        investigators: runs.map((run) => ({
          id: run.investigatorId,
          findings: run.persistedFindings.length,
          scannedNpis: run.coveredEntityIds.filter((entityId) => /^\d{10}$/.test(entityId)).length,
          durationMs: run.durationMs,
        })),
        totalFindings: runs.reduce((sum, run) => sum + run.persistedFindings.length, 0),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', `[Findings] Scan failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Investigator scan failed' });
    }
  });

  // ── Learning Loop ──────────────────────────────────────────────────────────

  // POST /api/findings/:id/outcome — Record analyst resolution outcome
  app.post('/api/findings/:id/outcome', async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as {
      outcome?: unknown;
      evidenceQuality?: unknown;
      falsePositiveReason?: string;
      missedSignals?: string[];
      analystNote?: string;
      resolvedBy?: string;
    };

    if (!isValidOutcome(body.outcome)) {
      return res.status(400).json({
        error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}`,
      });
    }
    if (!isValidEvidenceQuality(body.evidenceQuality)) {
      return res.status(400).json({
        error: `evidenceQuality must be one of: ${VALID_EVIDENCE_QUALITIES.join(', ')}`,
      });
    }

    try {
      const record = await recordOutcome(
        id,
        body.outcome,
        body.evidenceQuality,
        {
          falsePositiveReason: body.falsePositiveReason,
          missedSignals: body.missedSignals,
          analystNote: body.analystNote,
          resolvedBy: body.resolvedBy,
        },
      );

      if (!record) {
        return res.status(404).json({ error: 'Finding not found' });
      }

      res.json({ schema: 'https://vitalcv.com/finding-outcome/v1', ...record });
    } catch (err) {
      log('error', `[LearningLoop] Outcome recording failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Failed to record outcome' });
    }
  });

  // GET /api/findings/calibration — Investigator calibration stats
  app.get('/api/findings/calibration', (_req: Request, res: Response) => {
    try {
      const stats = getCalibrationStats();
      const summary = getLearningLoopStats();
      res.json({
        schema: 'https://vitalcv.com/calibration/v1',
        stats,
        summary,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', `[LearningLoop] Calibration stats failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Failed to get calibration stats' });
    }
  });

  // GET /api/findings/outcomes — Outcome history
  app.get('/api/findings/outcomes', (req: Request, res: Response) => {
    const { investigatorId, limit } = req.query as Record<string, string | undefined>;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 200) : 50;

    try {
      const history = getOutcomeHistory(parsedLimit, investigatorId);
      res.json({
        schema: 'https://vitalcv.com/outcome-history/v1',
        outcomes: history,
        total: history.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', `[LearningLoop] Outcome history failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Failed to get outcome history' });
    }
  });
}
