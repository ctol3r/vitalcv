/**
 * governance.ts — Wave 108: Trust Governance API Routes
 *
 * GET /api/governance/rules      — List all governance rules
 * GET /api/governance/rules/:id  — Get a specific governance rule by ID
 */

import type { Express, Request, Response } from 'express';
import {
  listGovernanceRules,
  getGovernanceRule,
} from '../services/governance/governanceRules';

export function registerGovernanceRoutes(app: Express): void {
  /**
   * GET /api/governance/rules
   * Returns all trust governance rules.
   */
  app.get('/api/governance/rules', (_req: Request, res: Response) => {
    try {
      const rules = listGovernanceRules();
      res.json({ rules, count: rules.length });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  });

  /**
   * GET /api/governance/rules/:id
   * Returns a specific governance rule by ID.
   */
  app.get('/api/governance/rules/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rule = getGovernanceRule(id);

      if (!rule) {
        res.status(404).json({ error: `Governance rule "${id}" not found` });
        return;
      }

      res.json(rule);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error', detail: String(err) });
    }
  });
}
