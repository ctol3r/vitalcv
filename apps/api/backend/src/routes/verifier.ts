/**
 * verifier.ts — Wave 99: Verifier Acceptance Flow API
 *
 * POST /api/verifier/accept        — Accept and evaluate a credential presentation
 * GET  /api/verifier/reports       — List acceptance reports
 * GET  /api/verifier/reports/:id   — Get a specific acceptance report
 */

import type { Express, Request, Response } from 'express';
import {
  acceptCredentialPresentation,
  getAcceptanceReport,
  listAcceptanceReports,
} from '../services/verifier/credentialAcceptance';
import { getPresentation } from '../services/credentials/credentialPresentation';
import { log } from '../obs/logger';

export function registerVerifierAcceptanceRoutes(app: Express): void {

  // ── POST /api/verifier/accept ──────────────────────────────────────
  app.post('/api/verifier/accept', async (req: Request, res: Response) => {
    try {
      const { presentationId, presentation: presentationBody } = req.body ?? {};

      // Resolve presentation — from ID or direct body
      let presentation = null;

      if (presentationId) {
        presentation = getPresentation(presentationId);
        if (!presentation) {
          res.status(404).json({ error: `Presentation ${presentationId} not found` });
          return;
        }
      } else if (presentationBody && typeof presentationBody === 'object') {
        presentation = presentationBody;
      } else {
        res.status(400).json({ error: 'Provide either presentationId or a presentation object' });
        return;
      }

      const report = await acceptCredentialPresentation(presentation);
      res.status(200).json({ report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_accept_failed', { error: msg });
      res.status(500).json({ error: 'Failed to evaluate presentation', detail: msg });
    }
  });

  // ── GET /api/verifier/reports ──────────────────────────────────────
  app.get('/api/verifier/reports', (_req: Request, res: Response) => {
    try {
      const reports = listAcceptanceReports();
      res.status(200).json({ reports, total: reports.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_reports_list_failed', { error: msg });
      res.status(500).json({ error: 'Failed to list reports', detail: msg });
    }
  });

  // ── GET /api/verifier/reports/:id ─────────────────────────────────
  app.get('/api/verifier/reports/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const report = getAcceptanceReport(id);

      if (!report) {
        res.status(404).json({ error: `Acceptance report ${id} not found` });
        return;
      }

      res.status(200).json({ report });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'verifier_report_get_failed', { error: msg });
      res.status(500).json({ error: 'Failed to retrieve report', detail: msg });
    }
  });
}
