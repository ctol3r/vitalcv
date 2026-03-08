/**
 * complianceCopilot.ts — Wave 157: Compliance Co-Pilot API Routes
 *
 * POST /api/ai/compliance-check — Run compliance check
 * GET  /api/ai/compliance-rules  — List available rule sets
 */

import type { Express, Request, Response } from 'express';
import { complianceCheck, listComplianceRuleSets } from '../services/ai/complianceRAG';
import { log } from '../obs/logger';

export function registerComplianceCopilotRoutes(app: Express): void {
  app.post('/api/ai/compliance-check', async (req: Request, res: Response) => {
    try {
      const { npi, targetState, targetFacility } = req.body as {
        npi?: string;
        targetState?: string;
        targetFacility?: string;
      };

      if (!npi || !targetState || !targetFacility) {
        res.status(400).json({ error: 'Missing npi, targetState, or targetFacility' });
        return;
      }

      const result = await complianceCheck({ npi, targetState, targetFacility });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', 'compliance_check_route_error', { error: message });
      if (message.includes('disabled')) {
        res.status(403).json({ error: message });
        return;
      }
      res.status(500).json({ error: 'Compliance check failed' });
    }
  });

  app.get('/api/ai/compliance-rules', (_req: Request, res: Response) => {
    try {
      const rules = listComplianceRuleSets();
      res.json({ ruleSets: rules, count: rules.length });
    } catch (err) {
      log('error', 'compliance_rules_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to list rule sets' });
    }
  });
}
