/**
 * Wave 192 — Ambassador Routes
 *
 * POST /api/ambassador/enroll          — Enroll in a track
 * GET  /api/ambassador/profile/:npi    — Get ambassador profile
 * POST /api/ambassador/placement       — Record a placement (internal)
 * GET  /api/ambassador/analytics       — Cohort analytics (operator)
 */

import type { Express, Request, Response } from 'express';
import {
  enrollAmbassador,
  recordPlacement,
  getAmbassadorProfile,
  listAmbassadors,
  getAmbassadorAnalytics,
  TRACK_META,
} from '../services/ambassador/ambassadorService';
import type { AmbassadorTrack } from '../services/ambassador/ambassadorService';

export function registerAmbassadorRoutes(app: Express): void {

  /** POST /api/ambassador/enroll — { npi, track } */
  app.post('/api/ambassador/enroll', (req: Request, res: Response) => {
    const { npi, track } = req.body ?? {};
    if (!npi || !track) { res.status(400).json({ error: 'npi and track required' }); return; }
    if (!Object.keys(TRACK_META).includes(track)) {
      res.status(400).json({ error: `Invalid track. Choose from: ${Object.keys(TRACK_META).join(', ')}` });
      return;
    }
    const profile = enrollAmbassador(npi, track as AmbassadorTrack);
    res.status(201).json({ profile });
  });

  /** GET /api/ambassador/profile/:npi */
  app.get('/api/ambassador/profile/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    const profile = getAmbassadorProfile(npi);
    if (!profile) { res.status(404).json({ error: 'Ambassador profile not found' }); return; }
    res.json({ profile, trackMeta: TRACK_META[profile.track] });
  });

  /** GET /api/ambassador/tracks */
  app.get('/api/ambassador/tracks', (_req: Request, res: Response) => {
    res.json({ tracks: TRACK_META });
  });

  /** POST /api/ambassador/placement — { npi } */
  app.post('/api/ambassador/placement', (req: Request, res: Response) => {
    const { npi } = req.body ?? {};
    if (!npi) { res.status(400).json({ error: 'npi required' }); return; }
    const profile = recordPlacement(npi);
    if (!profile) { res.status(404).json({ error: 'Ambassador not found' }); return; }
    res.json({ profile });
  });

  /** GET /api/ambassador/list?track= */
  app.get('/api/ambassador/list', (req: Request, res: Response) => {
    const track = req.query.track as AmbassadorTrack | undefined;
    const ambassadors = listAmbassadors(track);
    res.json({ ambassadors, total: ambassadors.length });
  });

  /** GET /api/ambassador/analytics */
  app.get('/api/ambassador/analytics', (_req: Request, res: Response) => {
    res.json(getAmbassadorAnalytics());
  });
}
