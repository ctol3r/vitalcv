import type { Express, Request, Response } from 'express';

import { computeEligibility } from '../services/matcha/eligibility';
import { getMockProfile, MOCK_JOBS } from '../services/matcha/mockData';

export function registerMatchaRoutes(app: Express): void {
  /**
   * GET /api/matcha/opportunities/:npi
   *
   * Returns job opportunities matched against the clinician's verified credentials.
   * Currently uses mock data; swap getMockProfile for a real data source later.
   */
  app.get('/api/matcha/opportunities/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    const profile = getMockProfile(npi);
    const matches = computeEligibility(profile, MOCK_JOBS);

    // Best matches first
    matches.sort((a, b) => b.matchConfidence - a.matchConfidence);

    return res.json({
      npi,
      clinician: {
        name: profile.name,
        specialty: profile.specialty,
        credentialCount: profile.credentials.length,
      },
      totalOpportunities: matches.length,
      clearToStart: matches.filter((m) => m.matchBand === 'CLEAR').length,
      opportunities: matches,
      generatedAt: new Date().toISOString(),
    });
  });
}
