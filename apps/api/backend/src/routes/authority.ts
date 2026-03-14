/**
 * authority.ts — Wave 29: Professional Authority State (PAS) Engine
 *
 * GET /api/authority/state/:npi
 *
 * PAS is derived from persisted pilot-truthful sources only:
 *   - PsvReceipt
 *   - canonicalFactStore
 *   - verification artifacts
 *   - credential artifacts
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { buildPASObject } from '../services/pas/pasBuilder';

export type {
  PASCredential,
  PASObject,
  PASPsvReceipt,
} from '../services/pas/pasBuilder';

export function registerAuthorityRoutes(app: Express): void {
  app.get(
    '/api/authority/state/:npi',
    publicApiRateLimit,
    (req: Request, res: Response): void => {
      const { npi } = req.params;

      if (typeof npi !== 'string' || !/^\d{10}$/.test(npi)) {
        res.status(400).json({ error: 'NPI must be exactly 10 digits.' });
        return;
      }

      buildPASObject(npi)
        .then((pas): void => {
          res.setHeader('cache-control', 'public, max-age=30, stale-while-revalidate=120');
          res.setHeader('x-pas-status', pas.authority_state.status);
          res.setHeader('x-pas-score', String(pas.authority_state.score));
          res.json(pas);
        })
        .catch((err: unknown): void => {
          log('error', 'PAS build failed', { npi, err: String(err) });
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to build PAS object' });
          }
        });
    },
  );
}
