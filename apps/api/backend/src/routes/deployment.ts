/**
 * deployment.ts — Credential-based workforce deployment API
 *
 * POST /api/deploy/match              — find deployment matches for a facility requirement
 * GET  /api/deploy/pool               — deployment-ready clinician pool
 * POST /api/deploy/confirm            — confirm a match → generate DecisionCapsule
 * GET  /api/deploy/matches/:npi       — all deployment opportunities a clinician qualifies for
 * GET  /api/deploy/readiness/:npi     — single-clinician deployment readiness summary
 */

import { randomUUID } from 'crypto';
import type { Express, Request, Response } from 'express';
import { findDeploymentMatches, scoreDeploymentMatch } from '../services/matcha/deploymentMatchEngine';
import type { FacilityRequirement, DeploymentVerdict } from '../services/matcha/deploymentMatchEngine';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import { getCachedTrustState } from '../services/trust/trustStateEngine';
import { searchAvailablePool } from '../services/matcha/availabilityRegistry';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFacilityRequirement(body: Record<string, unknown>): FacilityRequirement | string {
  const facilityName = typeof body.facilityName === 'string' ? body.facilityName.trim() : '';
  const specialty    = typeof body.specialty    === 'string' ? body.specialty.trim()    : '';
  const state        = typeof body.state        === 'string' ? body.state.trim().toUpperCase() : '';

  if (!facilityName) return 'facilityName is required';
  if (!specialty)    return 'specialty is required';
  if (!state || state.length !== 2) return 'state must be a 2-letter US state code';

  const allowedMin = ['L1', 'L2', 'L3'] as const;
  const minBand = allowedMin.includes(body.minimumTrustBand as typeof allowedMin[number])
    ? (body.minimumTrustBand as 'L1' | 'L2' | 'L3')
    : 'L2';

  const allowedUrgency = ['immediate', 'within_30_days', 'within_90_days'] as const;
  const urgency = allowedUrgency.includes(body.urgency as typeof allowedUrgency[number])
    ? (body.urgency as typeof allowedUrgency[number])
    : undefined;

  const allowedDeplType = ['PERMANENT', 'LOCUM', 'TEMP', 'PRN'] as const;
  const deploymentType = allowedDeplType.includes(body.deploymentType as typeof allowedDeplType[number])
    ? (body.deploymentType as typeof allowedDeplType[number])
    : undefined;

  return {
    facilityName,
    facilityId: typeof body.facilityId === 'string' ? body.facilityId : undefined,
    specialty,
    state,
    minimumTrustBand: minBand,
    requiredCredentials: Array.isArray(body.requiredCredentials)
      ? body.requiredCredentials.filter((c): c is string => typeof c === 'string')
      : undefined,
    requiredPrivileges: Array.isArray(body.requiredPrivileges)
      ? body.requiredPrivileges.filter((p): p is string => typeof p === 'string')
      : undefined,
    availableBy: typeof body.availableBy === 'string' ? body.availableBy : undefined,
    urgency,
    deploymentType,
    maxDailyRate: typeof body.maxDailyRate === 'number' ? body.maxDailyRate : undefined,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerDeploymentRoutes(app: Express): void {

  /**
   * POST /api/deploy/match
   *
   * Find credential-compatible deployment matches for a facility requirement.
   *
   * Body: {
   *   facilityName: string        required
   *   specialty:    string        required
   *   state:        string        required (2-letter)
   *   minimumTrustBand?: L1|L2|L3           default L2
   *   requiredCredentials?: string[]         e.g. ['DEA', 'BOARD_CERTIFICATION']
   *   requiredPrivileges?:  string[]         e.g. ['ICU']
   *   availableBy?:         string           ISO date
   *   urgency?:             immediate|within_30_days|within_90_days
   *   deploymentType?:      PERMANENT|LOCUM|TEMP|PRN
   *   maxDailyRate?:        number
   *   limit?:               number           default 20
   *   verdicts?:            string[]         default ['READY', 'CREDENTIALING_REQUIRED']
   * }
   */
  app.post('/api/deploy/match', async (req: Request, res: Response) => {
    const body   = req.body as Record<string, unknown>;
    const parsed = parseFacilityRequirement(body);

    if (typeof parsed === 'string') {
      res.status(400).json({ error: parsed });
      return;
    }

    const limit    = Math.min(Number(body.limit ?? 20), 100);
    const rawVerd  = Array.isArray(body.verdicts) ? body.verdicts as string[] : undefined;
    const verdicts = rawVerd?.filter((v): v is DeploymentVerdict =>
      ['READY', 'CREDENTIALING_REQUIRED', 'INELIGIBLE'].includes(v)
    );

    const startMs = Date.now();
    try {
      const matches = await findDeploymentMatches(parsed, { limit, verdicts });

      res.json({
        facilityName:      parsed.facilityName,
        specialty:         parsed.specialty,
        state:             parsed.state,
        minimumTrustBand:  parsed.minimumTrustBand,
        searchedAt:        new Date().toISOString(),
        latencyMs:         Date.now() - startMs,
        total:             matches.length,
        readyCount:        matches.filter(m => m.verdict === 'READY').length,
        credentialingCount: matches.filter(m => m.verdict === 'CREDENTIALING_REQUIRED').length,
        matches,
      });
    } catch (err) {
      log('error', 'deploy/match: failed', { error: String(err) });
      res.status(500).json({ error: 'Deployment match failed' });
    }
  });

  /**
   * GET /api/deploy/pool
   * Deployment-ready clinician pool — returns only READY matches.
   *
   * Query: specialty, state, trustBand (L1|L2|L3), limit
   */
  app.get('/api/deploy/pool', async (req: Request, res: Response) => {
    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : '';
    const state     = typeof req.query.state     === 'string' ? req.query.state.toUpperCase() : '';
    const minBand   = ['L1', 'L2', 'L3'].includes(String(req.query.trustBand))
      ? (req.query.trustBand as 'L1' | 'L2' | 'L3') : 'L2';
    const limit     = Math.min(Number(req.query.limit ?? 50), 200);

    if (!specialty || !state) {
      res.status(400).json({ error: 'specialty and state are required' });
      return;
    }

    try {
      const pool = await searchAvailablePool({ specialty, state, trustBandMinimum: minBand });

      // Enrich with trust state for each pool member
      const enriched = await Promise.allSettled(
        pool.slice(0, limit).map(async c => {
          const ts = await getCachedTrustState(c.npi).catch(() => null);
          return {
            npi:           c.npi,
            specialty:     c.specialty,
            availability:  c.urgency,
            states:        c.locations,
            trustBand:     ts?.readiness_level ?? ts?.trustBand ?? c.trustBand ?? 'L0',
            readinessScore: ts?.readiness_score ?? ts?.trustScore ?? 0,
            availableFrom: c.availableFrom,
            passportUrl:   `https://vitalcv.com/p/${c.npi}`,
            verifyUrl:     `/api/verify-professional/${c.npi}?credentialType=general&jurisdiction=${state}`,
          };
        })
      );

      const clinicians = enriched
        .filter((r) => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<unknown>).value);

      res.json({
        specialty, state,
        minimumTrustBand: minBand,
        total: clinicians.length,
        clinicians,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'deploy/pool: failed', { error: String(err) });
      res.status(500).json({ error: 'Pool query failed' });
    }
  });

  /**
   * POST /api/deploy/confirm
   *
   * Confirm a deployment match and generate an auditable DecisionCapsule.
   *
   * Body: {
   *   npi:           string    (clinician)
   *   facilityName:  string
   *   facilityId?:   string
   *   specialty:     string
   *   state:         string
   *   deploymentType?: PERMANENT|LOCUM|TEMP|PRN
   *   confirmedBy?:  string    (verifier user ID or org)
   *   notes?:        string
   * }
   *
   * Returns: DeploymentConfirmation with capsuleId + artifactHash
   */
  app.post('/api/deploy/confirm', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;

    const npi          = typeof body.npi === 'string' ? body.npi.trim() : '';
    const facilityName = typeof body.facilityName === 'string' ? body.facilityName.trim() : '';
    const specialty    = typeof body.specialty === 'string' ? body.specialty.trim() : '';
    const state        = typeof body.state === 'string' ? body.state.trim().toUpperCase() : '';

    if (!NPI_RE.test(npi))   { res.status(400).json({ error: 'Valid 10-digit NPI required' }); return; }
    if (!facilityName)        { res.status(400).json({ error: 'facilityName required' }); return; }

    const deploymentId = randomUUID();
    const confirmedAt  = new Date().toISOString();

    try {
      // Score the match to get credential IDs + trust state hash
      const requirement: FacilityRequirement = {
        facilityName, specialty: specialty || 'general', state: state || 'US',
        facilityId: typeof body.facilityId === 'string' ? body.facilityId : undefined,
      };
      const match = await scoreDeploymentMatch(npi, requirement);

      const trustState = await getCachedTrustState(npi).catch(() => null);
      const trustBand  = trustState?.readiness_level ?? trustState?.trustBand ?? 'L0';

      if (!match && trustBand === 'L0') {
        res.status(422).json({
          error: 'Clinician not deployable — trust band L0 or not in availability pool',
          npi, trustBand,
        });
        return;
      }

      // Generate DecisionCapsule
      const capsuleResult = await capsuleEngine.createDecisionCapsule({
        subjectDid:        `did:vitalcv:${npi}`,
        subjectNpi:        npi,
        decisionType:      'DEPLOYMENT',
        decisionAction:    'APPROVE',
        verifierOrgId:     typeof body.facilityId === 'string' ? body.facilityId : null,
        triggerEvent:      'verifier_decision',
        sourceReferenceId: deploymentId,
        credentialIds:     match?.credentialIds ?? [],
        metadata: {
          deploymentId,
          facilityName,
          facilityId:      body.facilityId ?? null,
          specialty:       specialty || match?.specialty,
          state,
          deploymentType:  body.deploymentType ?? 'TEMP',
          confirmedBy:     body.confirmedBy ?? null,
          notes:           body.notes ?? null,
          matchScore:      match?.matchScore ?? 0,
          matchVerdict:    match?.verdict ?? 'UNKNOWN',
          trustBand,
          readinessScore:  trustState?.readiness_score ?? 0,
          trustStateHash:  match?.trustStateHash ?? '',
          decisionAction:  'APPROVE',
          organizationName: facilityName,
          confirmedAt,
        },
      });

      log('info', 'deploy/confirm: capsule created', {
        npi, facilityName, deploymentId,
        capsuleId: capsuleResult.id,
        matchScore: match?.matchScore,
      });

      res.status(201).json({
        deploymentId,
        capsuleId:       capsuleResult.id,
        artifactHash:    capsuleResult.artifactHash,
        npi,
        facilityName,
        specialty:       specialty || match?.specialty,
        state,
        trustBand,
        matchScore:      match?.matchScore ?? 0,
        matchVerdict:    match?.verdict ?? 'CONFIRMED_MANUAL',
        confirmedAt,
        auditTrailUrl:   `/api/decisions/${capsuleResult.id}/replay`,
        passportUrl:     `https://vitalcv.com/p/${npi}`,
      });
    } catch (err) {
      log('error', 'deploy/confirm: failed', { npi, facilityName, error: String(err) });
      res.status(500).json({ error: 'Deployment confirmation failed' });
    }
  });

  /**
   * GET /api/deploy/matches/:npi
   * All deployment matches for a clinician across facility requirements.
   * Useful for clinician-facing "where can I deploy?" view.
   *
   * Query: specialty, state, limit
   */
  app.get('/api/deploy/matches/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi }   = req.params;
    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : undefined;
    const state     = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : undefined;
    const limit     = Math.min(Number(req.query.limit ?? 20), 100);

    // Build a generic facility requirement from the clinician's own data
    const avail = await searchAvailablePool({
      specialty, state,
    }).then(pool => pool.find(c => c.npi === npi)).catch(() => null);

    if (!avail) {
      res.json({
        npi,
        message: 'Clinician not in availability pool. Run POST /api/deploy/availability to register.',
        matches: [],
      });
      return;
    }

    try {
      // Score against a generic requirement shaped by the clinician's own profile
      const req2: FacilityRequirement = {
        facilityName: 'Any Facility',
        specialty: specialty ?? avail.specialty,
        state: state ?? avail.locations[0] ?? 'CA',
        minimumTrustBand: 'L1',
      };
      const matches = await findDeploymentMatches(req2, { limit, verdicts: ['READY', 'CREDENTIALING_REQUIRED'] });
      const ownMatch = matches.find(m => m.npi === npi);

      res.json({
        npi,
        specialty: avail.specialty,
        states: avail.locations,
        availability: avail.urgency,
        ownReadiness: ownMatch ?? null,
        suggestedMatches: matches.filter(m => m.npi !== npi).slice(0, 5),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'deploy/matches: failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Failed to fetch deployment matches' });
    }
  });

  /**
   * GET /api/deploy/readiness/:npi
   * Single-clinician deployment readiness — quick summary for dashboards.
   */
  app.get('/api/deploy/readiness/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const state   = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : 'CA';

    try {
      const [trustState, avail] = await Promise.all([
        getCachedTrustState(npi).catch(() => null),
        searchAvailablePool({}).then(pool => pool.find(c => c.npi === npi)).catch(() => null),
      ]);

      const trustBand     = trustState?.readiness_level ?? trustState?.trustBand ?? 'L0';
      const readinessScore = trustState?.readiness_score ?? 0;

      const verdict =
        trustBand === 'L3' ? 'READY' :
        trustBand === 'L2' ? 'READY' :
        trustBand === 'L1' ? 'CREDENTIALING_REQUIRED' : 'INELIGIBLE';

      res.json({
        npi,
        trustBand,
        readinessScore,
        verdict,
        inPool:        !!avail,
        specialty:     avail?.specialty ?? null,
        states:        avail?.locations ?? [],
        availability:  avail?.urgency ?? null,
        passportUrl:   `https://vitalcv.com/p/${npi}`,
        verifyUrl:     `/api/verify-professional/${npi}`,
        matchUrl:      `/api/deploy/matches/${npi}`,
        generatedAt:   new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'deploy/readiness: failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Readiness check failed' });
    }
  });
}
