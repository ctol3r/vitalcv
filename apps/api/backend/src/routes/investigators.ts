import type { Express, Request, Response } from 'express';
import {
  acknowledgeInvestigatorFinding,
  dismissInvestigatorFinding,
  escalateInvestigatorFinding,
  getInvestigatorFinding,
  listInvestigatorFindings,
  setInvestigatorFindingStatus,
} from '../services/investigators/investigatorEngineService';
import { log } from '../obs/logger';
import {
  isInvestigatorFindingStatus,
  normalizeInvestigatorFindingStatus,
} from '../../../../../core/investigators/investigatorTypes';
import { getInvestigatorRuntimeDetail } from '../services/investigation/investigatorRuntimeService';
import { buildFindingsBusDispatchBundle } from '../services/investigation/findingsBus';

function normalizeListParam(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeListParam(entry))
      .filter((entry, index, items) => items.indexOf(entry) === index);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseUnitIntervalParam(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(parsed, 1));
}

function statusBody(req: Request): { actorId?: string | null; note?: string | null } {
  const body = req.body as { actorId?: unknown; note?: unknown } | undefined;
  return {
    actorId: typeof body?.actorId === 'string' ? body.actorId : null,
    note: typeof body?.note === 'string' ? body.note : null,
  };
}

export function registerInvestigatorRoutes(app: Express): void {
  app.get('/api/investigators/findings', async (req: Request, res: Response) => {
    try {
      const parsedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
      const parsedOffset = typeof req.query.offset === 'string' ? Number.parseInt(req.query.offset, 10) : undefined;
      const limit = typeof parsedLimit === 'number' && Number.isFinite(parsedLimit) ? parsedLimit : undefined;
      const offset = typeof parsedOffset === 'number' && Number.isFinite(parsedOffset) ? parsedOffset : undefined;
      const findingType = normalizeListParam(req.query.type ?? req.query.findingType);
      const minConfidence = parseUnitIntervalParam(req.query.minConfidence);

      const result = await listInvestigatorFindings({
        severity: normalizeListParam(req.query.severity),
        findingType,
        investigatorId: normalizeListParam(req.query.investigatorId),
        status: normalizeListParam(req.query.status),
        provider: typeof req.query.provider === 'string' ? req.query.provider : null,
        institution: typeof req.query.institution === 'string' ? req.query.institution : null,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : null,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : null,
        minConfidence,
        limit,
        offset,
      });

      res.json({
        schema: 'https://vitalcv.com/investigators/findings/v1',
        total: result.total,
        findings: result.findings,
        filters: {
          severity: normalizeListParam(req.query.severity),
          type: findingType,
          findingType,
          investigatorId: normalizeListParam(req.query.investigatorId),
          status: normalizeListParam(req.query.status),
          provider: typeof req.query.provider === 'string' ? req.query.provider : null,
          institution: typeof req.query.institution === 'string' ? req.query.institution : null,
          dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : null,
          dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : null,
          minConfidence,
        },
      });
    } catch (error) {
      log('error', 'investigators: findings list failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load investigator findings' });
    }
  });

  app.get('/api/investigators/findings/:id', async (req: Request, res: Response) => {
    try {
      const finding = await getInvestigatorFinding(req.params.id);
      if (!finding) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/investigators/finding-detail/v1',
        finding,
      });
    } catch (error) {
      log('error', 'investigators: finding detail failed', {
        error: error instanceof Error ? error.message : String(error),
        findingId: req.params.id,
      });
      res.status(500).json({ error: 'Failed to load investigator finding' });
    }
  });

  app.patch('/api/investigators/findings/:id/status', async (req: Request, res: Response) => {
    const body = req.body as { status?: unknown; actorId?: unknown; note?: unknown } | undefined;
    const rawStatus = typeof body?.status === 'string' ? body.status : null;
    const normalizedStatus = normalizeInvestigatorFindingStatus(rawStatus);

    if (!rawStatus || !isInvestigatorFindingStatus(rawStatus)) {
      res.status(400).json({
        error: 'status must be one of: new, acknowledged, investigating, resolved, dismissed',
      });
      return;
    }

    try {
      const finding = await setInvestigatorFindingStatus(req.params.id, normalizedStatus, statusBody(req));
      res.json({ finding });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update finding status';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }
      log('error', 'investigators: status update failed', { error: message, findingId: req.params.id });
      res.status(500).json({ error: 'Failed to update finding status' });
    }
  });

  app.post('/api/investigators/findings/:id/acknowledge', async (req: Request, res: Response) => {
    try {
      const finding = await acknowledgeInvestigatorFinding(req.params.id, statusBody(req));
      res.json({ finding });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to acknowledge finding';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }
      log('error', 'investigators: acknowledge failed', { error: message, findingId: req.params.id });
      res.status(500).json({ error: 'Failed to acknowledge finding' });
    }
  });

  app.post('/api/investigators/findings/:id/dismiss', async (req: Request, res: Response) => {
    try {
      const finding = await dismissInvestigatorFinding(req.params.id, statusBody(req));
      res.json({ finding });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dismiss finding';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }
      log('error', 'investigators: dismiss failed', { error: message, findingId: req.params.id });
      res.status(500).json({ error: 'Failed to dismiss finding' });
    }
  });

  app.post('/api/investigators/findings/:id/escalate', async (req: Request, res: Response) => {
    try {
      const finding = await escalateInvestigatorFinding(req.params.id, statusBody(req));
      res.json({ finding });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to escalate finding';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Finding not found' });
        return;
      }
      log('error', 'investigators: escalate failed', { error: message, findingId: req.params.id });
      res.status(500).json({ error: 'Failed to escalate finding' });
    }
  });

  app.get('/api/investigators/:id', async (req: Request, res: Response) => {
    try {
      const detail = await getInvestigatorRuntimeDetail(req.params.id);
      if (!detail) {
        res.status(404).json({ error: 'Investigator not found' });
        return;
      }

      const recentBusEvents = detail.recentFindings.map((finding) => buildFindingsBusDispatchBundle(finding));
      res.json({
        schema: 'https://vitalcv.com/investigators/runtime-detail/v2',
        ...detail,
        recentBusEvents,
      });
    } catch (error) {
      log('error', 'investigators: runtime detail failed', {
        error: error instanceof Error ? error.message : String(error),
        investigatorId: req.params.id,
      });
      res.status(500).json({ error: 'Failed to load investigator runtime detail' });
    }
  });
}
