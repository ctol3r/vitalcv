/**
 * trustDecision.ts — Shape-of-Truth Decision API
 *
 * Routes:
 *   GET  /api/trust-decision/:npi          — latest decision (re-evaluates if expired)
 *   POST /api/trust-decision/:npi/evaluate — force fresh evaluation
 *   GET  /api/trust-decision/:npi/history  — append-only decision audit log
 *   POST /api/trust-decision/batch         — bulk decision class lookup
 *
 * Decision classes returned:
 *   TRUSTED_CURRENT | TRUSTED_BUT_STALE_SOON | STALE_REVERIFY_REQUIRED |
 *   CONFLICT_REQUIRES_REVIEW | NEGATIVE_FINDING_BLOCK | INSUFFICIENT_EVIDENCE
 */

import type { Express, NextFunction, Request, Response } from 'express';
import {
  getOrEvaluateTrustDecision,
  runTrustDecision,
  getDecisionHistory,
  getDecisionClassBatch,
} from '../services/trust/trustDecisionService';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import type { WorkflowContext } from '../services/trust/trustRulesEngine';

const NPI_RE = /^\d{10}$/;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerTrustDecisionRoutes(app: Express): void {

  // ── GET /api/trust-decision/:npi ─────────────────────────────────────────
  app.get(
    '/api/trust-decision/:npi',
    asyncHandler(async (req, res) => {
      const { npi } = req.params;
      if (!NPI_RE.test(npi)) throw new HttpError(400, 'npi must be a 10-digit NPI.');

      const context = (req.query.context as WorkflowContext | undefined) ?? 'credentialing';
      if (context !== 'credentialing' && context !== 'accreditation') {
        throw new HttpError(400, 'context must be credentialing or accreditation.');
      }

      const artifact = await getOrEvaluateTrustDecision(npi, { context });
      res.json(artifact);
    }),
  );

  // ── POST /api/trust-decision/:npi/evaluate — force fresh ────────────────
  app.post(
    '/api/trust-decision/:npi/evaluate',
    asyncHandler(async (req, res) => {
      const { npi } = req.params;
      if (!NPI_RE.test(npi)) throw new HttpError(400, 'npi must be a 10-digit NPI.');

      const context = (req.body?.context as WorkflowContext | undefined) ?? 'credentialing';
      const artifact = await runTrustDecision(npi, { context });
      res.status(201).json(artifact);
    }),
  );

  // ── GET /api/trust-decision/:npi/history ─────────────────────────────────
  app.get(
    '/api/trust-decision/:npi/history',
    asyncHandler(async (req, res) => {
      const { npi } = req.params;
      if (!NPI_RE.test(npi)) throw new HttpError(400, 'npi must be a 10-digit NPI.');

      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const history = await getDecisionHistory(npi, limit);
      res.json({ npi, history });
    }),
  );

  // ── POST /api/trust-decision/batch ───────────────────────────────────────
  app.post(
    '/api/trust-decision/batch',
    asyncHandler(async (req, res) => {
      const { npis } = req.body as { npis?: unknown };
      if (!Array.isArray(npis)) throw new HttpError(400, 'npis must be an array.');
      if (npis.length > 200) throw new HttpError(400, 'Max 200 NPIs per batch.');

      const validNpis = npis.filter((n): n is string => typeof n === 'string' && NPI_RE.test(n));
      if (validNpis.length === 0) throw new HttpError(400, 'No valid NPIs provided.');

      const decisions = await getDecisionClassBatch(validNpis);
      res.json({ decisions });
    }),
  );

  log('info', 'trust_decision_routes_registered', {
    routes: [
      'GET  /api/trust-decision/:npi',
      'POST /api/trust-decision/:npi/evaluate',
      'GET  /api/trust-decision/:npi/history',
      'POST /api/trust-decision/batch',
    ],
  });
}
