/**
 * Wave 239 — MATCHA Live Connection: Routes
 *
 * GET  /api/matcha/opportunities/:npi       — matched opportunities (LIVE via liveMatchaService)
 * POST /api/matcha/explain                  — explain a specific match (LIVE via liveMatchaService)
 * POST /api/matcha/intent                   — save / update candidate intent (in-memory, TODO: migrate to DB)
 * GET  /api/matcha/instant-offer/:npi/:id   — check instant offer eligibility (TODO: migrate to live)
 * GET  /api/matcha/analytics                — aggregate analytics (operator)
 */

import type { Express, Request, Response } from 'express';
import { scoreOpportunity, buildDecisionAudit, checkInstantOfferEligibility } from '../services/matcha/matchaEngine';
import { getMockProfile } from '../services/matcha/mockData';
import { OPPORTUNITIES, getOpportunity } from '../services/matcha/opportunityRegistry';
import { getLiveMatchesForNpi, scoreOpportunityForNpi } from '../services/matcha/liveMatchaService';
import type { CandidateIntent } from '../services/matcha/matchaModels';

// In-memory intent store — TODO: Wave 190+ migrate to DB
const intentStore = new Map<string, CandidateIntent>();

// In-memory decision audit log
const decisionLog: ReturnType<typeof buildDecisionAudit>[] = [];

export function registerMatchaRoutes(app: Express): void {

  /**
   * GET /api/matcha/opportunities/:npi
   * Returns ranked matched opportunities for a clinician via live DB + NPPES.
   * Query: specialty, state, hiringType
   */
  app.get('/api/matcha/opportunities/:npi', async (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      if (!npi || !/^\d{10}$/.test(npi)) {
        res.status(400).json({ error: 'Invalid NPI — expected 10 digits' });
        return;
      }

      const { specialty, state, hiringType } = req.query;
      const filters = {
        specialty: specialty as string | undefined,
        state: state as string | undefined,
        hiringType: hiringType as string | undefined,
      };

      const result = await getLiveMatchesForNpi(npi, filters);

      res.json({
        ...result,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[MATCHA] getLiveMatchesForNpi failed:', error);
      res.status(500).json({
        error: 'Failed to load MATCHA opportunities',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/matcha/explain
   * Body: { npi, opportunityId }
   * Returns MatchExplanation for a specific opportunity using live scoring.
   */
  app.post('/api/matcha/explain', async (req: Request, res: Response) => {
    const { npi, opportunityId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }

    try {
      const result = await scoreOpportunityForNpi(npi, opportunityId);
      if (!result) {
        res.status(404).json({ error: 'Opportunity not found' });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error('[MATCHA] scoreOpportunityForNpi failed:', error);
      res.status(500).json({
        error: 'Failed to score opportunity',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * POST /api/matcha/intent
   * Body: CandidateIntent
   * Saves / updates a clinician's job search preferences.
   * TODO: migrate to DB
   */
  app.post('/api/matcha/intent', (req: Request, res: Response) => {
    const body = req.body ?? {};
    if (!body.npi) {
      res.status(400).json({ error: 'npi required' });
      return;
    }

    const intent: CandidateIntent = {
      npi: body.npi,
      preferredStates: body.preferredStates,
      preferredSpecialties: body.preferredSpecialties,
      preferredHiringTypes: body.preferredHiringTypes,
      payMin: body.payMin,
      remoteOnly: body.remoteOnly,
      startUrgency: body.startUrgency,
      openToLocums: body.openToLocums,
      openToTelehealth: body.openToTelehealth,
      capturedAt: new Date().toISOString(),
    };

    intentStore.set(body.npi, intent);
    console.log(JSON.stringify({ event: 'matcha.intent.saved', npi: body.npi }));

    res.json({ success: true, intent });
  });

  /**
   * GET /api/matcha/instant-offer/:npi/:opportunityId
   * Returns instant offer eligibility.
   * TODO: migrate to liveMatchaService for real DB lookups
   */
  app.get('/api/matcha/instant-offer/:npi/:opportunityId', (req: Request, res: Response) => {
    const { npi, opportunityId } = req.params;
    const clinician = getMockProfile(npi);
    const intent = intentStore.get(npi) ?? null;
    const opp = getOpportunity(opportunityId);
    if (!opp) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const explanation = scoreOpportunity(clinician, intent, opp);
    const eligibility = checkInstantOfferEligibility(npi, opp, explanation);

    res.json(eligibility);
  });

  /**
   * GET /api/matcha/analytics
   * Returns aggregate MATCHA analytics from the decision log.
   */
  app.get('/api/matcha/analytics', (_req: Request, res: Response) => {
    const bandCounts = { CLEAR: 0, NEAR_CLEAR: 0, PARTIAL: 0, INELIGIBLE: 0 };
    const blockerFreq: Record<string, number> = {};

    for (const d of decisionLog) {
      bandCounts[d.band] = (bandCounts[d.band] ?? 0) + 1;
      for (const b of d.blockers) {
        blockerFreq[b] = (blockerFreq[b] ?? 0) + 1;
      }
    }

    const topBlockers = Object.entries(blockerFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    res.json({
      totalDecisions: decisionLog.length,
      bandDistribution: bandCounts,
      topBlockers,
      totalOpportunities: OPPORTUNITIES.filter(o => o.active).length,
      generatedAt: new Date().toISOString(),
    });
  });
}
