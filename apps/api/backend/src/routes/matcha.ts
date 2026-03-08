/**
 * Wave 187 — MATCHA Refoundation: Routes
 *
 * GET  /api/matcha/opportunities/:npi       — matched opportunities for a clinician
 * POST /api/matcha/explain                  — explain a specific match
 * POST /api/matcha/intent                   — save / update candidate intent
 * GET  /api/matcha/instant-offer/:npi/:id   — check instant offer eligibility
 * GET  /api/matcha/analytics                — aggregate analytics (operator)
 */

import type { Express, Request, Response } from 'express';
import { matchOpportunities, scoreOpportunity, buildDecisionAudit, checkInstantOfferEligibility } from '../services/matcha/matchaEngine';
import { getMockProfile } from '../services/matcha/mockData';
import { OPPORTUNITIES, getOpportunity, listOpportunities } from '../services/matcha/opportunityRegistry';
import type { CandidateIntent } from '../services/matcha/matchaModels';

// In-memory intent store — Wave 190 migrates to DB
const intentStore = new Map<string, CandidateIntent>();

// In-memory decision audit log
const decisionLog: ReturnType<typeof buildDecisionAudit>[] = [];

export function registerMatchaRoutes(app: Express): void {

  /**
   * GET /api/matcha/opportunities/:npi
   * Returns ranked matched opportunities for a clinician.
   * Query: specialty, state, hiringType, remote
   */
  app.get('/api/matcha/opportunities/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !/^\d{10}$/.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI — expected 10 digits' });
      return;
    }

    const clinician = getMockProfile(npi);
    const intent = intentStore.get(npi) ?? null;

    const { specialty, state, hiringType, remote } = req.query;
    const filtered = listOpportunities({
      specialty: specialty as string | undefined,
      state: state as string | undefined,
      hiringType: hiringType as string | undefined,
      remote: remote === 'true' ? true : remote === 'false' ? false : undefined,
    });

    const matches = matchOpportunities(clinician, intent, filtered);

    // Persist audit records
    for (const m of matches) {
      decisionLog.push(buildDecisionAudit(npi, m.opportunity, m.explanation));
    }

    res.json({
      npi,
      clinician: { name: clinician.name, specialty: clinician.specialty },
      totalOpportunities: matches.length,
      clearToStart: matches.filter(m => m.explanation.matchBand === 'CLEAR').length,
      nearClear: matches.filter(m => m.explanation.matchBand === 'NEAR_CLEAR').length,
      instantOfferEligible: matches.filter(m => m.explanation.instantOfferEligible).length,
      opportunities: matches.map(m => ({
        ...m.opportunity,
        matchScore: m.explanation.matchScore,
        matchBand: m.explanation.matchBand,
        confidence: m.explanation.confidence,
        instantOfferEligible: m.explanation.instantOfferEligible,
        blockerCount: m.explanation.blockers.length,
        fitSummary: m.explanation.fitReasons.filter(r => r.positive).slice(0, 3).map(r => r.label),
        topBlocker: m.explanation.blockers[0]?.label ?? null,
      })),
      generatedAt: new Date().toISOString(),
    });
  });

  /**
   * POST /api/matcha/explain
   * Body: { npi, opportunityId }
   * Returns full MatchExplanation for a specific opportunity.
   */
  app.post('/api/matcha/explain', (req: Request, res: Response) => {
    const { npi, opportunityId } = req.body ?? {};
    if (!npi || !opportunityId) {
      res.status(400).json({ error: 'npi and opportunityId required' });
      return;
    }

    const clinician = getMockProfile(npi);
    const intent = intentStore.get(npi) ?? null;
    const opp = getOpportunity(opportunityId);
    if (!opp) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const explanation = scoreOpportunity(clinician, intent, opp);
    const audit = buildDecisionAudit(npi, opp, explanation);
    decisionLog.push(audit);

    res.json({
      npi,
      opportunity: opp,
      explanation,
      auditRef: audit.decisionId,
    });
  });

  /**
   * POST /api/matcha/intent
   * Body: CandidateIntent
   * Saves / updates a clinician's job search preferences.
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
   * Returns instant offer eligibility for a specific opportunity.
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
