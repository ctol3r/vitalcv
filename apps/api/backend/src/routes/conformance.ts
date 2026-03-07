/**
 * conformance.ts — Wave 114: Conformance & Receipt API Routes
 *
 * GET  /api/conformance/report    — Run and return conformance suite results
 * GET  /api/conformance/last      — Return the last cached conformance report
 * GET  /api/audit/receipt/:id     — Get an audit receipt by ID
 * GET  /api/audit/receipts        — List audit receipts
 * GET  /api/audit/receipts/stats  — Receipt statistics
 */

import type { Express, Request, Response } from 'express';
import { runConformanceSuite, getLastConformanceReport } from '../services/conformance/conformanceSuite';
import { getReceipt, listReceipts, receiptStats } from '../services/audit/receiptGenerator';
import { log } from '../obs/logger';

export function registerConformanceRoutes(app: Express): void {

  // ── GET /api/conformance/report ───────────────────────────────────
  app.get('/api/conformance/report', async (_req: Request, res: Response) => {
    try {
      const report = await runConformanceSuite();
      const status = report.overallCompliant ? 200 : 422;
      res.status(status).json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'conformance_report_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/conformance/last ─────────────────────────────────────
  app.get('/api/conformance/last', (_req: Request, res: Response) => {
    try {
      const report = getLastConformanceReport();
      if (!report) {
        res.status(404).json({ error: 'No conformance report yet. GET /api/conformance/report to generate one.' });
        return;
      }
      res.json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/audit/receipts/stats ─────────────────────────────────
  // NOTE: must register /stats BEFORE /:id to avoid route collision
  app.get('/api/audit/receipts/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await receiptStats();
      const total = stats.ISSUANCE + stats.PRESENTATION + stats.VERIFICATION;
      res.json({ stats, total });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/audit/receipts ───────────────────────────────────────
  app.get('/api/audit/receipts', async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      const validTypes = ['ISSUANCE', 'PRESENTATION', 'VERIFICATION'];
      if (type && !validTypes.includes(type as string)) {
        res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` });
        return;
      }
      const receipts = await listReceipts(type as 'ISSUANCE' | 'PRESENTATION' | 'VERIFICATION' | undefined);
      res.json({ receipts, count: receipts.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/audit/receipt/:id ────────────────────────────────────
  app.get('/api/audit/receipt/:id', async (req: Request, res: Response) => {
    try {
      const receipt = await getReceipt(req.params.id);
      if (!receipt) {
        res.status(404).json({ error: `Receipt ${req.params.id} not found` });
        return;
      }
      res.json(receipt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
