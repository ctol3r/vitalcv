/**
 * Wave 239 — MATCHA Live Connection: Routes
 *
 * GET  /api/matcha/opportunities            — active opportunity registry
 * POST /api/matcha/opportunity             — create a registry opportunity
 * GET  /api/matcha/opportunities/:npi      — matched opportunities (LIVE via liveMatchaService)
 * POST /api/matcha/explain                 — explain a specific match (LIVE via liveMatchaService)
 * POST /api/matcha/intent                  — save / update candidate intent
 * GET  /api/matcha/instant-offer/:npi/:id  — check instant offer eligibility using real trust state
 * POST /api/marketplace/match              — trust-state-backed marketplace matching
 * GET  /api/marketplace/pool               — available credential-ready clinician pool
 * GET  /api/matcha/analytics               — aggregate analytics (operator)
 */

import type { Express, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import {
  getAvailability,
  searchAvailablePool,
} from '../services/matcha/availabilityRegistry';
import {
  buildDecisionAudit,
  checkInstantOfferEligibility,
  scoreOpportunity,
} from '../services/matcha/matchaEngine';
import type {
  CandidateIntent,
  ClaimLevel,
  ClinicianProfile,
  CredentialKey,
  CredentialStatus,
  HeldCredential,
  MatchExplanation,
  MatchBand,
  Opportunity,
} from '../services/matcha/matchaModels';
import {
  createOpportunity,
  getOpportunity,
  listActiveOpportunities,
  OPPORTUNITIES,
} from '../services/matcha/opportunityRegistry';
import {
  getLiveMatchesForNpi,
  scoreOpportunityForNpi,
} from '../services/matcha/liveMatchaService';
import type {
  CanonicalFactSummary,
  ClinicianTrustState,
} from '../services/trust/trustStateEngine';
import { getCachedTrustState } from '../services/trust/trustStateEngine';
import { sha256ForPayload } from '../utils/deterministic';

const NPI_RE = /^\d{10}$/;
const STATE_RE = /^[A-Z]{2}$/;
const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]);
const CLAIM_LEVEL_ORDER: Record<ClaimLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
} as Record<ClaimLevel, number>;

type MarketplaceMatchBand = 'GREEN' | 'YELLOW' | 'RED';
type MarketplaceMatchResponse = {
  opportunityId: string;
  title: string;
  organization: string;
  matchScore: number;
  matchBand: MarketplaceMatchBand;
  gapItems: string[];
  urgency: string;
  premiumRate?: number;
  capsuleCreated: boolean;
};

type MarketplaceMatchBody = {
  npi?: string;
  opportunityId?: string;
  specialty?: string;
  state?: string;
};

type CreateOpportunityBody = Partial<Opportunity> & {
  requirements?: Opportunity['requirements'];
};

// In-memory intent store — TODO: Wave 190+ migrate to DB
const intentStore = new Map<string, CandidateIntent>();

// In-memory decision audit log
const decisionLog: ReturnType<typeof buildDecisionAudit>[] = [];

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.trim();
  }

  return undefined;
}

function requireClerkUserId(req: Request, res: Response): string | null {
  const clerkUserId = getHeaderValue(req.headers['x-clerk-user-id']);
  if (!clerkUserId) {
    res.status(401).json({ error: 'Missing x-clerk-user-id header.' });
    return null;
  }

  return clerkUserId;
}

function normalizeState(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return STATE_RE.test(normalized) ? normalized : undefined;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function credentialStatusFromFactStatus(status: string): CredentialStatus {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'VERIFIED' || normalized === 'CLEAR') {
    return 'active';
  }
  if (normalized === 'EXPIRING') {
    return 'expiring';
  }
  if (
    normalized === 'EXPIRED'
    || normalized === 'REVOKED'
    || normalized === 'SUSPENDED'
    || normalized === 'INACTIVE'
  ) {
    return 'expired';
  }

  return 'pending';
}

function claimLevelFromTrustBand(trustBand: string): ClaimLevel {
  if (trustBand === 'L3') {
    return 'L3';
  }
  if (trustBand === 'L2') {
    return 'L2';
  }
  return 'L1';
}

function credentialKeyForFact(fact: CanonicalFactSummary): CredentialKey | null {
  const haystack = `${fact.factType} ${fact.source} ${fact.details ?? ''}`.toLowerCase();

  if (haystack.includes('board') || haystack.includes('certification')) {
    return 'board_cert';
  }
  if (haystack.includes('dea')) {
    return 'dea';
  }
  if (haystack.includes('malpractice') || haystack.includes('insurance')) {
    return 'malpractice';
  }
  if (haystack.includes('sanction') || haystack.includes('exclusion')) {
    return 'sanctions_clear';
  }
  if (haystack.includes('license')) {
    return 'state_license';
  }
  if (haystack.includes('identity') || haystack.includes('nppes') || haystack.includes('npi')) {
    return 'npi';
  }

  return null;
}

function extractStatesFromFacts(facts: CanonicalFactSummary[]): string[] {
  return [...new Set(facts.flatMap((fact) => {
    if (typeof fact.details !== 'string') {
      return [];
    }

    const matches = fact.details.match(/\b[A-Z]{2}\b/g) ?? [];
    return matches.filter((candidate) => US_STATE_CODES.has(candidate));
  }))];
}

function inferSpecialtyFromFacts(facts: CanonicalFactSummary[]): string | undefined {
  for (const fact of facts) {
    const details = typeof fact.details === 'string' ? fact.details : '';
    const boardMatch = details.match(/^(.+?)\s+(?:Board|Certification)/i);
    if (boardMatch?.[1]) {
      return boardMatch[1].trim();
    }
  }

  return undefined;
}

function mergeCredential(existing: HeldCredential | undefined, candidate: HeldCredential): HeldCredential {
  if (!existing) {
    return candidate;
  }

  const existingLevel = CLAIM_LEVEL_ORDER[existing.claimLevel];
  const candidateLevel = CLAIM_LEVEL_ORDER[candidate.claimLevel];
  if (candidateLevel > existingLevel) {
    return candidate;
  }
  if (candidateLevel < existingLevel) {
    return existing;
  }

  const statusPriority: Record<CredentialStatus, number> = {
    active: 4,
    expiring: 3,
    pending: 2,
    not_found: 1,
    expired: 0,
  };

  return statusPriority[candidate.status] > statusPriority[existing.status] ? candidate : existing;
}

function buildHeldCredentials(
  trustState: ClinicianTrustState,
  specialty: string,
  states: string[],
): HeldCredential[] {
  const credentials = new Map<string, HeldCredential>();
  const baseClaimLevel = claimLevelFromTrustBand(trustState.readiness_level);
  const stateHint = states[0];

  const fallbackCredentials: HeldCredential[] = [
    {
      key: 'npi',
      status: trustState.identityVerified ? 'active' : 'pending',
      claimLevel: baseClaimLevel,
      issuer: 'TRUST_STATE_ENGINE',
    },
  ];

  if (stateHint && trustState.licensureStatus !== 'unknown') {
    fallbackCredentials.push({
      key: 'state_license',
      status: trustState.licensureStatus === 'verified'
        ? 'active'
        : trustState.licensureStatus === 'expired'
          ? 'expired'
          : 'pending',
      claimLevel: trustState.licensureStatus === 'verified' ? baseClaimLevel : 'L2',
      issuer: `${stateHint} Medical Board`,
      state: stateHint,
    });
  }

  if (trustState.exclusionClear) {
    fallbackCredentials.push({
      key: 'sanctions_clear',
      status: 'active',
      claimLevel: baseClaimLevel,
      issuer: 'OIG / TRUST_STATE_ENGINE',
    });
  }

  for (const credential of fallbackCredentials) {
    const key = [credential.key, credential.state ?? '', credential.specialty ?? ''].join(':');
    credentials.set(key, mergeCredential(credentials.get(key), credential));
  }

  for (const fact of trustState.facts ?? []) {
    const key = credentialKeyForFact(fact);
    if (!key) {
      continue;
    }

    const credential: HeldCredential = {
      key,
      status: credentialStatusFromFactStatus(fact.status),
      claimLevel: baseClaimLevel,
      issuer: fact.source,
      expiresAt: fact.expiresAt,
    };

    if (key === 'state_license' && stateHint) {
      credential.state = stateHint;
    }
    if (key === 'board_cert') {
      credential.specialty = specialty;
    }

    const dedupeKey = [credential.key, credential.state ?? '', credential.specialty ?? ''].join(':');
    credentials.set(dedupeKey, mergeCredential(credentials.get(dedupeKey), credential));
  }

  return [...credentials.values()];
}

function mapAvailabilityUrgencyToIntentUrgency(
  urgency?: 'immediate' | 'within_30_days' | 'within_90_days' | 'exploring',
): CandidateIntent['startUrgency'] {
  if (urgency === 'immediate') {
    return 'immediate';
  }
  if (urgency === 'within_30_days') {
    return 'within_month';
  }
  return 'flexible';
}

async function buildClinicianProfileFromTrustState(
  npi: string,
  trustState: ClinicianTrustState,
  specialtyHint?: string,
): Promise<ClinicianProfile> {
  const [profile, availability] = await Promise.all([
    prisma.personProfile.findUnique({
      where: { npi },
      select: {
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
      },
    }),
    getAvailability(npi).catch(() => null),
  ]);

  const specialty = specialtyHint?.trim()
    || availability?.specialty
    || profile?.specialty
    || inferSpecialtyFromFacts(trustState.facts ?? [])
    || 'Medicine';
  const states = uniqueStrings([
    ...(availability?.locations ?? []),
    profile?.stateOfPractice,
    ...extractStatesFromFacts(trustState.facts ?? []),
  ]).map((state) => state.toUpperCase());

  return {
    npi,
    name: uniqueStrings([profile?.firstName, profile?.lastName]).join(' ') || `Clinician ${npi}`,
    specialty,
    states,
    credentials: buildHeldCredentials(trustState, specialty, states),
    prequalified: trustState.readiness_level === 'L3',
    interviewComplete: trustState.readiness_score >= 80,
    assessmentsComplete: (trustState.facts ?? [])
      .filter((fact) => credentialKeyForFact(fact) !== null)
      .map((fact) => fact.factType),
  };
}

async function buildCandidateIntent(
  npi: string,
  specialty?: string,
  state?: string,
): Promise<CandidateIntent | null> {
  const availability = await getAvailability(npi).catch(() => null);
  const preferredStates = uniqueStrings([...(availability?.locations ?? []), state]);
  const preferredSpecialties = uniqueStrings([availability?.specialty, specialty]);
  const payMin = availability?.rateFloor;
  const startUrgency = mapAvailabilityUrgencyToIntentUrgency(availability?.urgency);

  if (
    preferredStates.length === 0
    && preferredSpecialties.length === 0
    && typeof payMin !== 'number'
    && !availability
  ) {
    return intentStore.get(npi) ?? null;
  }

  return {
    ...(intentStore.get(npi) ?? {}),
    npi,
    preferredStates: preferredStates.length > 0 ? preferredStates : undefined,
    preferredSpecialties: preferredSpecialties.length > 0 ? preferredSpecialties : undefined,
    payMin,
    startUrgency,
    capturedAt: new Date().toISOString(),
  };
}

function toMarketplaceBand(
  explanation: MatchExplanation,
  trustBand: string,
): MarketplaceMatchBand {
  if (explanation.matchBand === 'INELIGIBLE') {
    return 'RED';
  }
  if (trustBand === 'L3' && explanation.matchBand === 'CLEAR') {
    return 'GREEN';
  }
  if (explanation.matchBand === 'CLEAR' || explanation.matchBand === 'NEAR_CLEAR' || explanation.matchBand === 'PARTIAL') {
    return 'YELLOW';
  }

  return 'RED';
}

function organizationNameForOpportunity(opportunity: Opportunity): string {
  return opportunity.organization ?? opportunity.facility;
}

function gapItemsForExplanation(explanation: MatchExplanation): string[] {
  return explanation.blockers.map((blocker) => blocker.label);
}

function buildTimeToStart(
  trustState: ClinicianTrustState,
  topMatch?: MarketplaceMatchResponse,
): { estimated: string; bottleneck: string } {
  const bottleneck = topMatch?.gapItems[0] ?? trustState.gap_summary[0];

  if (!bottleneck && trustState.readiness_level === 'L3') {
    return {
      estimated: '2-4 hours',
      bottleneck: 'None — ready to start',
    };
  }

  if (trustState.readiness_level === 'L3' || trustState.readiness_level === 'L2') {
    return {
      estimated: '1-3 days',
      bottleneck: bottleneck ?? 'Minor credential review remaining',
    };
  }

  return {
    estimated: '1-2 weeks',
    bottleneck: bottleneck ?? 'Credential verification pending',
  };
}

function shouldCreateCapsule(
  band: MarketplaceMatchBand,
  trustState: ClinicianTrustState,
): boolean {
  return band === 'GREEN' && trustState.readiness_level === 'L3';
}

function triggerDecisionCapsule(input: {
  npi: string;
  opportunity: Opportunity;
  explanation: MatchExplanation;
  band: MarketplaceMatchBand;
  clerkUserId: string;
  trustState: ClinicianTrustState;
  triggerContext: 'instant_offer' | 'marketplace_match';
}): boolean {
  if (input.band !== 'GREEN' && input.band !== 'YELLOW') {
    return false;
  }

  const trustStateHash = sha256ForPayload({
    trust_state_snapshot: input.trustState,
  });

  void capsuleEngine.createDecisionCapsule({
    subjectDid: `did:vitalcv:${input.npi}`,
    subjectNpi: input.npi,
    decisionType: 'HIRING',
    decisionAction: 'APPROVE',
    verifierOrgId: input.opportunity.organizationId ?? null,
    triggerEvent: 'verifier_decision',
    sourceReferenceId: input.opportunity.id,
    metadata: {
      verifierClerkUserId: input.clerkUserId,
      organizationId: input.opportunity.organizationId ?? null,
      opportunityId: input.opportunity.id,
      organization: organizationNameForOpportunity(input.opportunity),
      matchScore: input.explanation.matchScore,
      matchBand: input.band,
      triggerContext: input.triggerContext,
      trustStateHash,
    },
  }).catch((error: unknown) => {
    log('warn', 'matcha: capsule_create_failed', {
      npi: input.npi,
      opportunityId: input.opportunity.id,
      error: String(error),
    });
  });

  return true;
}

function addDecisionAudit(
  npi: string,
  opportunity: Opportunity,
  explanation: MatchExplanation,
): void {
  decisionLog.push(buildDecisionAudit(npi, opportunity, explanation));
}

export function registerMatchaRoutes(app: Express): void {
  app.get('/api/matcha/opportunities', (req: Request, res: Response) => {
    const { specialty, state, hiringType, employerSlug, remote } = req.query;
    const opportunities = listActiveOpportunities({
      specialty: specialty as string | undefined,
      state: normalizeState(state as string | undefined),
      hiringType: hiringType as string | undefined,
      employerSlug: employerSlug as string | undefined,
      remote: typeof remote === 'string' ? remote === 'true' : undefined,
    });

    res.json({
      total: opportunities.length,
      opportunities,
      generatedAt: new Date().toISOString(),
    });
  });

  app.post('/api/matcha/opportunity', (req: Request, res: Response) => {
    const clerkUserId = requireClerkUserId(req, res);
    if (!clerkUserId) {
      return;
    }

    const body = (req.body ?? {}) as CreateOpportunityBody;
    if (
      !body.title
      || !body.employerSlug
      || !body.facility
      || !body.location
      || !body.state
      || !body.specialty
      || !body.hiringType
      || !body.employerType
      || !body.startUrgency
      || !Array.isArray(body.requirements)
      || body.requirements.length === 0
    ) {
      res.status(400).json({
        error: 'title, employerSlug, facility, location, state, specialty, hiringType, employerType, startUrgency, and requirements are required.',
      });
      return;
    }

    const opportunity = createOpportunity({
      id: typeof body.id === 'string' ? body.id : undefined,
      title: body.title,
      organization: typeof body.organization === 'string' ? body.organization : undefined,
      organizationId: typeof body.organizationId === 'string' ? body.organizationId : undefined,
      employerSlug: body.employerSlug,
      facility: body.facility,
      location: body.location,
      state: normalizeState(body.state) ?? body.state,
      specialty: body.specialty,
      department: typeof body.department === 'string' ? body.department : undefined,
      hiringType: body.hiringType,
      employerType: body.employerType,
      startUrgency: body.startUrgency,
      urgency: body.urgency,
      payRange: typeof body.payRange === 'string' ? body.payRange : undefined,
      payMin: typeof body.payMin === 'number' ? body.payMin : undefined,
      payMax: typeof body.payMax === 'number' ? body.payMax : undefined,
      premiumRate: typeof body.premiumRate === 'number' ? body.premiumRate : undefined,
      remote: Boolean(body.remote),
      requirements: body.requirements,
      postedAt: typeof body.postedAt === 'string' ? body.postedAt : undefined,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      active: body.active ?? true,
      recentHires: typeof body.recentHires === 'number' ? body.recentHires : undefined,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === 'string')
        : undefined,
      minimumTrustBand: body.minimumTrustBand,
      credentialRequirements: Array.isArray(body.credentialRequirements)
        ? body.credentialRequirements.filter((item): item is string => typeof item === 'string')
        : undefined,
    });

    log('info', 'matcha: opportunity_created', {
      clerkUserId,
      opportunityId: opportunity.id,
      employerSlug: opportunity.employerSlug,
      minimumTrustBand: opportunity.minimumTrustBand,
    });

    res.status(201).json(opportunity);
  });

  /**
   * GET /api/matcha/opportunities/:npi
   * Returns ranked matched opportunities for a clinician via live DB + NPPES.
   * Query: specialty, state, hiringType
   */
  app.get('/api/matcha/opportunities/:npi', async (req: Request, res: Response) => {
    try {
      const { npi } = req.params;
      if (!npi || !NPI_RE.test(npi)) {
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
      log('error', 'matcha: live_matches_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
      log('error', 'matcha: score_opportunity_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
    log('info', 'matcha: intent_saved', { npi: body.npi });

    res.json({ success: true, intent });
  });

  /**
   * GET /api/matcha/instant-offer/:npi/:opportunityId
   * Returns instant offer eligibility using cached trust state.
   */
  app.get('/api/matcha/instant-offer/:npi/:opportunityId', async (req: Request, res: Response) => {
    const { npi, opportunityId } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI — expected 10 digits' });
      return;
    }

    const trustState = await getCachedTrustState(npi).catch(() => null);
    if (!trustState) {
      res.status(404).json({ error: 'Trust state not found for NPI. Activate clinician first.' });
      return;
    }

    const intent = await buildCandidateIntent(npi);
    const opportunity = getOpportunity(opportunityId);
    if (!opportunity) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const clinician = await buildClinicianProfileFromTrustState(npi, trustState, opportunity.specialty);
    const explanation = scoreOpportunity(clinician, intent, opportunity);
    addDecisionAudit(npi, opportunity, explanation);

    const eligibility = checkInstantOfferEligibility(npi, opportunity, explanation);
    const band = toMarketplaceBand(explanation, trustState.readiness_level);
    const capsuleCreated = eligibility.eligible
      ? triggerDecisionCapsule({
        npi,
        opportunity,
        explanation,
        band,
        clerkUserId: getHeaderValue(req.headers['x-clerk-user-id']) ?? 'system',
        trustState,
        triggerContext: 'instant_offer',
      })
      : false;

    res.json({
      ...eligibility,
      band,
      capsuleCreated,
    });
  });

  app.post('/api/marketplace/match', async (req: Request, res: Response) => {
    const clerkUserId = requireClerkUserId(req, res);
    if (!clerkUserId) {
      return;
    }

    const body = (req.body ?? {}) as MarketplaceMatchBody;
    if (!body.npi || !NPI_RE.test(body.npi)) {
      res.status(400).json({ error: 'npi must be exactly 10 digits.' });
      return;
    }

    const trustState = await getCachedTrustState(body.npi).catch(() => null);
    if (!trustState) {
      res.status(404).json({ error: 'Trust state not found for NPI. Activate clinician first.' });
      return;
    }

    const clinician = await buildClinicianProfileFromTrustState(body.npi, trustState, body.specialty);
    const intent = await buildCandidateIntent(body.npi, body.specialty, body.state);

    const opportunities = body.opportunityId
      ? (() => {
        const opportunity = getOpportunity(body.opportunityId);
        return opportunity ? [opportunity] : [];
      })()
      : listActiveOpportunities({
        specialty: body.specialty,
        state: normalizeState(body.state),
      });

    if (body.opportunityId && opportunities.length === 0) {
      res.status(404).json({ error: 'Opportunity not found' });
      return;
    }

    const scoredMatches = opportunities
      .map((opportunity) => {
        const explanation = scoreOpportunity(clinician, intent, opportunity);
        return { opportunity, explanation };
      })
      .sort((left, right) => right.explanation.matchScore - left.explanation.matchScore);

    if (body.opportunityId && scoredMatches[0]) {
      addDecisionAudit(body.npi, scoredMatches[0].opportunity, scoredMatches[0].explanation);
    }

    const matches: MarketplaceMatchResponse[] = scoredMatches.map(({ opportunity, explanation }, index) => {
      const band = toMarketplaceBand(explanation, trustState.readiness_level);
      const capsuleCreated = index === 0 && shouldCreateCapsule(band, trustState)
        ? triggerDecisionCapsule({
          npi: body.npi as string,
          opportunity,
          explanation,
          band,
          clerkUserId,
          trustState,
          triggerContext: 'marketplace_match',
        })
        : false;

      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        organization: organizationNameForOpportunity(opportunity),
        matchScore: explanation.matchScore,
        matchBand: band,
        gapItems: gapItemsForExplanation(explanation),
        urgency: opportunity.urgency,
        premiumRate: opportunity.premiumRate,
        capsuleCreated,
      };
    });

    res.json({
      npi: body.npi,
      trustBand: trustState.readiness_level,
      readinessScore: trustState.readiness_score,
      matches,
      timeToStart: buildTimeToStart(trustState, matches[0]),
    });
  });

  app.get('/api/marketplace/pool', async (req: Request, res: Response) => {
    const clerkUserId = requireClerkUserId(req, res);
    if (!clerkUserId) {
      return;
    }

    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const trustBandMinimum = req.query.trustBand;
    const urgency = typeof req.query.urgency === 'string' ? req.query.urgency : undefined;
    const availableBy = typeof req.query.availableBy === 'string' ? req.query.availableBy : undefined;

    const pool = await searchAvailablePool({
      specialty,
      state,
      urgency,
      availableBy,
      trustBandMinimum:
        trustBandMinimum === 'L1' || trustBandMinimum === 'L2' || trustBandMinimum === 'L3'
          ? trustBandMinimum
          : undefined,
    });

    const rankedPool = (await Promise.all(pool.map(async (availability) => {
      const trustState = await getCachedTrustState(availability.npi).catch(() => null);
      if (!trustState) {
        return null;
      }

      return {
        npi: availability.npi,
        specialty: availability.specialty,
        locations: availability.locations,
        trustBand: trustState.readiness_level,
        readinessScore: trustState.readiness_score,
        availableFrom: availability.availableFrom,
        urgency: availability.urgency,
        passportUrl: `https://vitalcv.com/p/${availability.npi}`,
      };
    })))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => right.readinessScore - left.readinessScore);

    log('info', 'matcha: marketplace_pool_queried', {
      clerkUserId,
      specialty,
      state,
      total: rankedPool.length,
    });

    res.json({
      total: rankedPool.length,
      pool: rankedPool,
    });
  });

  /**
   * GET /api/matcha/analytics
   * Returns aggregate MATCHA analytics from the decision log.
   */
  app.get('/api/matcha/analytics', (_req: Request, res: Response) => {
    const bandCounts: Record<MatchBand, number> = {
      CLEAR: 0,
      NEAR_CLEAR: 0,
      PARTIAL: 0,
      INELIGIBLE: 0,
    };
    const blockerFreq: Record<string, number> = {};

    for (const decision of decisionLog) {
      bandCounts[decision.band] = (bandCounts[decision.band] ?? 0) + 1;
      for (const blocker of decision.blockers) {
        blockerFreq[blocker] = (blockerFreq[blocker] ?? 0) + 1;
      }
    }

    const topBlockers = Object.entries(blockerFreq)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    res.json({
      totalDecisions: decisionLog.length,
      bandDistribution: bandCounts,
      topBlockers,
      totalOpportunities: OPPORTUNITIES.filter((opportunity) => opportunity.active).length,
      generatedAt: new Date().toISOString(),
    });
  });
}
