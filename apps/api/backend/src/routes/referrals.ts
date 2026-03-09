/**
 * Wave 191 — Referral Engine Routes
 *
 * POST /api/referrals/consent          — Capture consent before link creation
 * POST /api/referrals/create           — Create referral link
 * GET  /api/referrals/me               — Referrer dashboard
 * GET  /api/referrals/status/:id       — Attribution status
 * POST /api/referrals/track/:code      — Track click (anti-fraud)
 * POST /api/referrals/attribute        — Record signup attribution
 * POST /api/referrals/advance          — Advance referral status (internal)
 */

import type { Express, Request, Response } from 'express';
import {
  captureConsent,
  createReferralLink,
  trackReferralClick,
  createAttribution,
  advanceReferralStatus,
  getReferrerDashboard,
  getReferralStatus,
} from '../services/referral/referralService';

export function registerReferralRoutes(app: Express): void {

  /** POST /api/referrals/consent — { npi, ip? } */
  app.post('/api/referrals/consent', (req: Request, res: Response) => {
    const { npi } = req.body ?? {};
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket.remoteAddress ?? '0.0.0.0';
    const consent = captureConsent(npi, ip);
    res.status(201).json({ consent });
  });

  /** POST /api/referrals/create — { npi, type, targetOpportunityId?, targetEmployerSlug? } */
  app.post('/api/referrals/create', (req: Request, res: Response) => {
    const { npi, type, targetOpportunityId, targetEmployerSlug } = req.body ?? {};
    if (!npi || !type) { res.status(400).json({ error: 'npi and type required' }); return; }

    const result = createReferralLink({ referrerNpi: npi, type, targetOpportunityId, targetEmployerSlug });
    if ('error' in result) { res.status(400).json(result); return; }
    res.status(201).json({ link: result });
  });

  /** GET /api/referrals/me?npi= */
  app.get('/api/referrals/me', (req: Request, res: Response) => {
    const npi = req.query.npi as string;
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const dashboard = getReferrerDashboard(npi);
    res.json({ dashboard });
  });

  /** GET /api/referrals/status/:id */
  app.get('/api/referrals/status/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const attr = getReferralStatus(id);
    if (!attr) { res.status(404).json({ error: 'Attribution not found' }); return; }
    res.json({ attribution: attr });
  });

  /** POST /api/referrals/track/:code */
  app.post('/api/referrals/track/:code', (req: Request, res: Response) => {
    const { code } = req.params;
    const { link, fraudAlert } = trackReferralClick(code);
    if (!link) { res.status(404).json({ error: 'Referral link not found or inactive' }); return; }
    res.json({ link, fraudAlert });
  });

  /** POST /api/referrals/attribute — { linkId, refereeId } */
  app.post('/api/referrals/attribute', (req: Request, res: Response) => {
    const { linkId, refereeId } = req.body ?? {};
    if (!linkId || !refereeId) { res.status(400).json({ error: 'linkId and refereeId required' }); return; }
    const result = createAttribution({ linkId, refereeId });
    if ('error' in result) { res.status(400).json(result); return; }
    res.status(201).json({ attribution: result });
  });

  /** POST /api/referrals/advance — { attributionId, status } */
  app.post('/api/referrals/advance', (req: Request, res: Response) => {
    const { attributionId, status } = req.body ?? {};
    if (!attributionId || !status) { res.status(400).json({ error: 'attributionId and status required' }); return; }
    const attr = advanceReferralStatus(attributionId, status);
    if (!attr) { res.status(404).json({ error: 'Attribution not found' }); return; }
    res.json({ attribution: attr });
  });
}
