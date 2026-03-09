/**
 * Wave 190 — Verifier Pipeline Routes
 *
 * POST /api/widget/apply               — Apply with VitalCV (opportunity-specific)
 * GET  /api/verifier/candidates        — Candidate queue for verifier org
 * POST /api/verifier/offers/send       — Send instant offer
 * POST /api/verifier/offers/respond    — Holder accepts / declines offer
 * GET  /api/verifier/candidates/pool   — Prequalified instant-offer pool
 * GET  /api/holder/applications        — Holder's own application history
 */

import type { Express, Request, Response } from 'express';
import {
  applyToOpportunity,
  getCandidateQueue,
  getPrequalifiedPool,
  sendInstantOffer,
  respondToOffer,
  getApplicationsByNpi,
} from '../services/verifier/verifierPipelineService';

export function registerVerifierPipelineRoutes(app: Express): void {

  /**
   * POST /api/widget/apply
   * Body: { npi, opportunityId, verifierOrgId, matchScore?, matchBand?, instantOfferEligible? }
   */
  app.post('/api/widget/apply', (req: Request, res: Response) => {
    const { npi, opportunityId, verifierOrgId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }
    const record = applyToOpportunity({
      npi,
      opportunityId,
      verifierOrgId: verifierOrgId ?? 'UNKNOWN_ORG',
      source: 'widget',
      matchScore: req.body.matchScore,
      matchBand: req.body.matchBand,
      instantOfferEligible: req.body.instantOfferEligible ?? false,
    });
    res.status(201).json({ application: record });
  });

  /**
   * GET /api/verifier/candidates?opportunityId=
   * Query: opportunityId (optional filter)
   * Header: x-verifier-org-id
   */
  app.get('/api/verifier/candidates', (req: Request, res: Response) => {
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string) ?? 'DEMO_ORG';
    const opportunityId = req.query.opportunityId as string | undefined;
    const candidates = getCandidateQueue(verifierOrgId, opportunityId);
    res.json({ candidates, total: candidates.length });
  });

  /**
   * GET /api/verifier/candidates/pool
   * Returns only instant-offer eligible candidates.
   */
  app.get('/api/verifier/candidates/pool', (req: Request, res: Response) => {
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string) ?? 'DEMO_ORG';
    const pool = getPrequalifiedPool(verifierOrgId);
    res.json({ pool, total: pool.length });
  });

  /**
   * POST /api/verifier/offers/send
   * Body: { npi, opportunityId, verifierOrgId?, message?, expiresInHours? }
   */
  app.post('/api/verifier/offers/send', (req: Request, res: Response) => {
    const { npi, opportunityId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }
    const verifierOrgId = (req.headers['x-verifier-org-id'] as string)
      ?? req.body.verifierOrgId
      ?? 'DEMO_ORG';
    const offer = sendInstantOffer({
      npi,
      opportunityId,
      verifierOrgId,
      message: req.body.message,
      expiresInHours: req.body.expiresInHours,
    });
    res.status(201).json({ offer });
  });

  /**
   * POST /api/verifier/offers/respond
   * Body: { offerId, accept }
   */
  app.post('/api/verifier/offers/respond', (req: Request, res: Response) => {
    const { offerId, accept } = req.body ?? {};
    if (!offerId || accept === undefined) {
      res.status(400).json({ error: 'offerId and accept required' });
      return;
    }
    const offer = respondToOffer(offerId, Boolean(accept));
    if (!offer) { res.status(404).json({ error: 'Offer not found' }); return; }
    res.json({ offer });
  });

  /**
   * GET /api/holder/applications?npi=
   * Returns a holder's own application history.
   */
  app.get('/api/holder/applications', (req: Request, res: Response) => {
    const npi = req.query.npi as string;
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const applications = getApplicationsByNpi(npi);
    res.json({ applications, total: applications.length });
  });
}
