/**
 * acceptance.ts — Predictive Acceptance API
 *
 * GET /api/acceptance/predict
 *   Query: employerId (UUID), state?, specialty?, readinessBand?,
 *          credentialTypes? (comma-separated)
 *   Returns: AcceptancePrediction — confidence band, rate, gap boosts.
 *
 * Reads from DecisionLearningCapsule. No writes.
 */

import type { Express, Request, Response } from 'express';
import { predictAcceptance, type PassportState } from '../services/intelligence/acceptanceGraph';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_BANDS = new Set(['L0', 'L1', 'L2', 'L3']);

function parseList(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function registerAcceptanceRoutes(app: Express): void {
  app.get('/api/acceptance/predict', async (req: Request, res: Response) => {
    const employerId = typeof req.query.employerId === 'string' ? req.query.employerId.trim() : '';
    if (!UUID_RE.test(employerId)) {
      res.status(400).json({ error: 'employerId must be a valid UUID' });
      return;
    }

    const band = typeof req.query.readinessBand === 'string' ? req.query.readinessBand.trim() : undefined;
    if (band && !VALID_BANDS.has(band)) {
      res.status(400).json({ error: 'readinessBand must be L0 | L1 | L2 | L3' });
      return;
    }

    const passport: PassportState = {
      readinessBand: band as PassportState['readinessBand'],
      state: typeof req.query.state === 'string' ? req.query.state.trim() : undefined,
      specialty: typeof req.query.specialty === 'string' ? req.query.specialty.trim() : undefined,
      credentialTypes: parseList(req.query.credentialTypes),
      gaps: parseList(req.query.gaps),
    };

    try {
      const prediction = await predictAcceptance(passport, employerId);
      res.json({ employerId, passport, prediction });
    } catch (err) {
      log('error', 'acceptance_predict: failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to compute acceptance prediction' });
    }
  });
}
