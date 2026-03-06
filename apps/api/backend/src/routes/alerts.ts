/**
 * alerts.ts — Wave 97: Trust Alerts API Routes
 *
 * GET  /api/alerts                         — List trust alerts
 * POST /api/alerts/acknowledge             — Acknowledge an alert
 * POST /api/alerts/emit                    — Emit a new alert (internal/admin)
 * GET  /api/alerts/summary                 — Unacknowledged count by severity
 */

import type { Express, Request, Response } from 'express';
import {
  listAlerts,
  acknowledgeAlert,
  emitAlert,
  unacknowledgedCount,
  type TrustAlertSeverity,
  type TrustAlertType,
} from '../services/alerts/trustAlerts';
import { log } from '../obs/logger';

export function registerTrustAlertRoutes(app: Express): void {

  // ── GET /api/alerts ────────────────────────────────────────────────
  app.get('/api/alerts', (req: Request, res: Response) => {
    try {
      const { severity, acknowledged, limit } = req.query;

      const alerts = listAlerts({
        severity: severity as TrustAlertSeverity | undefined,
        acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.status(200).json({
        alerts,
        total: alerts.length,
        unacknowledged: unacknowledgedCount(),
        retrievedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'alerts_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list alerts', detail: msg });
    }
  });

  // ── GET /api/alerts/summary ────────────────────────────────────────
  app.get('/api/alerts/summary', (_req: Request, res: Response) => {
    try {
      const all = listAlerts();
      const unacked = all.filter((a) => !a.acknowledged);

      const summary = {
        total: all.length,
        unacknowledged: unacked.length,
        bySeverity: {
          CRITICAL: unacked.filter((a) => a.severity === 'CRITICAL').length,
          WARNING: unacked.filter((a) => a.severity === 'WARNING').length,
          INFO: unacked.filter((a) => a.severity === 'INFO').length,
        },
        retrievedAt: new Date().toISOString(),
      };

      res.status(200).json(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'alerts_summary_failed', { error: msg });
      res.status(500).json({ error: 'Failed to summarize alerts', detail: msg });
    }
  });

  // ── POST /api/alerts/acknowledge ───────────────────────────────────
  app.post('/api/alerts/acknowledge', (req: Request, res: Response) => {
    try {
      const { alertId } = req.body ?? {};

      if (!alertId || typeof alertId !== 'string') {
        res.status(400).json({ error: 'alertId is required' });
        return;
      }

      const updated = acknowledgeAlert(alertId);
      if (!updated) {
        res.status(404).json({ error: `Alert ${alertId} not found` });
        return;
      }

      res.status(200).json({ alert: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'alerts_acknowledge_failed', { error: msg });
      res.status(500).json({ error: 'Failed to acknowledge alert', detail: msg });
    }
  });

  // ── POST /api/alerts/emit (admin/internal) ─────────────────────────
  app.post('/api/alerts/emit', (req: Request, res: Response) => {
    try {
      const {
        type,
        severity,
        title,
        description,
        credentialId,
        issuerId,
        subject,
        recommendedAction,
      } = req.body ?? {};

      const validTypes: TrustAlertType[] = [
        'credential_expiring',
        'credential_revoked',
        'issuer_trust_degradation',
        'verification_failure',
      ];

      if (!type || !validTypes.includes(type)) {
        res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` });
        return;
      }
      if (!title || typeof title !== 'string') {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      if (!description || typeof description !== 'string') {
        res.status(400).json({ error: 'description is required' });
        return;
      }

      const alert = emitAlert({
        type,
        severity: severity ?? 'WARNING',
        title,
        description,
        credentialId,
        issuerId,
        subject,
        recommendedAction: recommendedAction ?? 'Review and take appropriate action.',
      });

      res.status(201).json({ alert });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'alerts_emit_failed', { error: msg });
      res.status(500).json({ error: 'Failed to emit alert', detail: msg });
    }
  });
}
