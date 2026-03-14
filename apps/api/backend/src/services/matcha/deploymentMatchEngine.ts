/**
 * deploymentMatchEngine.ts — Credential-based deployment matching
 *
 * Constraint-based matching engine that scores clinicians against
 * facility deployment requirements. Output feeds DecisionCapsule generation.
 *
 * Scoring (0–100):
 *   Specialty match        40 pts  exact=40, compatible=25, none=0
 *   License coverage       25 pts  active in required state=25, other state=10, none=0
 *   Trust band             20 pts  L3=20, L2=15, L1=5, L0=0
 *   Credential compat      10 pts  required creds present / total * 10
 *   Availability alignment  5 pts  immediate=5, within_30d=3, within_90d=1
 *
 * Verdict:
 *   READY                 score >= 70 + no blocking constraints
 *   CREDENTIALING_REQUIRED score 40–69 OR missing required creds
 *   INELIGIBLE            score < 40 OR trust band below minimum
 */

import prisma from '../../graphql/prisma_client';
import { getCachedTrustState } from '../trust/trustStateEngine';
import { searchAvailablePool } from './availabilityRegistry';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeploymentVerdict = 'READY' | 'CREDENTIALING_REQUIRED' | 'INELIGIBLE';

/** What a facility/hospital needs to deploy a clinician */
export interface FacilityRequirement {
  facilityName: string;
  facilityId?: string;

  // Credential constraints
  specialty: string;                          // required specialty
  state: string;                              // deployment state (2-letter)
  requiredCredentials?: string[];             // e.g. ['DEA', 'BOARD_CERTIFICATION', 'STATE_BOARD']
  requiredPrivileges?: string[];              // e.g. ['ICU', 'Emergency Medicine']
  minimumTrustBand?: 'L1' | 'L2' | 'L3';    // default L2

  // Availability constraints
  availableBy?: string;                       // ISO date — when they need the clinician
  urgency?: 'immediate' | 'within_30_days' | 'within_90_days';

  // Deployment context
  deploymentType?: 'PERMANENT' | 'LOCUM' | 'TEMP' | 'PRN';
  maxDailyRate?: number;
}

/** Per-constraint check result */
export interface ConstraintCheck {
  constraint: string;
  status: 'MET' | 'PARTIALLY_MET' | 'NOT_MET' | 'UNKNOWN';
  score: number;
  maxScore: number;
  detail: string;
}

/** Gap preventing immediate deployment */
export interface DeploymentGap {
  type: 'LICENSE' | 'CREDENTIAL' | 'PRIVILEGE' | 'TRUST_BAND' | 'AVAILABILITY' | 'SANCTION';
  description: string;
  estimatedDaysToResolve: number;
  blocking: boolean;
}

/** Full scored match for one clinician against one facility requirement */
export interface DeploymentMatch {
  npi: string;
  facilityName: string;

  // Scoring
  matchScore: number;                         // 0–100
  verdict: DeploymentVerdict;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // Trust state
  trustBand: string;
  readinessScore: number;

  // Constraint breakdown
  constraints: ConstraintCheck[];

  // Deployment readiness
  gaps: DeploymentGap[];
  estimatedDaysToDeploy: number | null;       // null = ineligible
  deployableBy: string | null;                // ISO date estimate

  // Clinician summary
  specialty: string;
  availableStates: string[];
  availability: string;

  // Artifacts for capsule generation
  credentialIds: string[];
  trustStateHash: string;
  computedAt: string;
}

// ── Specialty compatibility map ───────────────────────────────────────────────

const COMPATIBLE_SPECIALTIES: Record<string, string[]> = {
  'internal medicine':     ['hospitalist', 'critical care', 'geriatrics', 'general medicine'],
  'emergency medicine':    ['urgent care', 'critical care', 'trauma surgery'],
  'family medicine':       ['internal medicine', 'general practice', 'hospitalist'],
  'critical care':         ['pulmonology', 'anesthesiology', 'emergency medicine', 'internal medicine'],
  'anesthesiology':        ['critical care', 'pain management'],
  'general surgery':       ['trauma surgery', 'surgical critical care'],
  'pediatrics':            ['neonatology', 'pediatric hospitalist'],
  'nursing':               ['rn', 'registered nurse', 'lpn', 'np', 'nurse practitioner'],
  'np':                    ['nurse practitioner', 'advanced practice', 'nursing'],
  'pa':                    ['physician assistant', 'advanced practice'],
};

function specialtyScore(clinicianSpecialty: string, required: string): number {
  const cs = clinicianSpecialty.toLowerCase().trim();
  const rs = required.toLowerCase().trim();
  if (cs === rs) return 40;
  const compatibles = COMPATIBLE_SPECIALTIES[rs] ?? COMPATIBLE_SPECIALTIES[cs] ?? [];
  if (compatibles.includes(cs) || compatibles.includes(rs)) return 25;
  // partial word match (e.g. "emergency" in "emergency medicine")
  if (cs.includes(rs) || rs.includes(cs)) return 15;
  return 0;
}

function trustBandScore(band: string): number {
  return band === 'L3' ? 20 : band === 'L2' ? 15 : band === 'L1' ? 5 : 0;
}

function availabilityScore(urgency: string | undefined): number {
  return urgency === 'immediate' ? 5 : urgency === 'within_30_days' ? 3 : urgency === 'within_90_days' ? 1 : 0;
}

function bandMeetsMinimum(band: string, min: string | undefined): boolean {
  const order: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };
  return (order[band] ?? 0) >= (order[min ?? 'L2'] ?? 2);
}

function estimateDaysForGapType(type: DeploymentGap['type']): number {
  return type === 'LICENSE' ? 45 : type === 'CREDENTIAL' ? 30 : type === 'PRIVILEGE' ? 21 :
         type === 'TRUST_BAND' ? 60 : type === 'SANCTION' ? 0 : 7;
}

function sha256Short(input: string): string {
  const { createHash } = require('crypto') as typeof import('crypto');
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

// ── Core scoring function ─────────────────────────────────────────────────────

export async function scoreDeploymentMatch(
  npi: string,
  req: FacilityRequirement,
): Promise<DeploymentMatch | null> {
  const computedAt = new Date().toISOString();

  // Trust state
  const trustState = await getCachedTrustState(npi).catch(() => null);
  const trustBand = trustState?.readiness_level ?? trustState?.trustBand ?? 'L0';
  const readinessScore = trustState?.readiness_score ?? 0;

  // Availability
  const pool = await searchAvailablePool({ specialty: req.specialty, state: req.state });
  const avail = pool.find(c => c.npi === npi);
  // If no availability record, clinician isn't in the pool for this spec/state
  if (!avail) return null;

  // Credentials
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active' },
    select: { id: true, source: true, status: true, expiresAt: true },
  });
  const activeArtifacts = artifacts.filter(a =>
    a.status === 'VERIFIED' || a.status === 'ACTIVE' || a.status === 'active'
  );
  const credentialIds = activeArtifacts.map(a => a.id);

  // ── Constraint: Specialty ───────────────────────────────────────────────────
  const specScore = specialtyScore(avail.specialty, req.specialty);
  const specConstraint: ConstraintCheck = {
    constraint: 'Specialty Match',
    status: specScore === 40 ? 'MET' : specScore > 0 ? 'PARTIALLY_MET' : 'NOT_MET',
    score: specScore, maxScore: 40,
    detail: specScore === 40
      ? `Exact specialty match: ${avail.specialty}`
      : specScore > 0 ? `Compatible specialty: ${avail.specialty} ↔ ${req.specialty}`
      : `No specialty match — clinician: ${avail.specialty}, required: ${req.specialty}`,
  };

  // ── Constraint: License Coverage ───────────────────────────────────────────
  const licSources   = ['STATE_BOARD', 'NURSYS'];
  const stateLicenses = artifacts.filter(a =>
    licSources.includes(a.source) &&
    (a.status === 'VERIFIED' || a.status === 'ACTIVE')
  );
  const hasLicenseInState = avail.locations.includes(req.state.toUpperCase());
  const hasAnyLicense     = stateLicenses.length > 0;
  const licScore = hasLicenseInState ? 25 : hasAnyLicense ? 10 : 0;
  const licConstraint: ConstraintCheck = {
    constraint: 'License Coverage',
    status: hasLicenseInState ? 'MET' : hasAnyLicense ? 'PARTIALLY_MET' : 'NOT_MET',
    score: licScore, maxScore: 25,
    detail: hasLicenseInState
      ? `Active license verified in ${req.state}`
      : hasAnyLicense ? `Licensed in other states — ${req.state} license needed`
      : 'No active state license found',
  };

  // ── Constraint: Trust Band ──────────────────────────────────────────────────
  const minBand   = req.minimumTrustBand ?? 'L2';
  const bandMet   = bandMeetsMinimum(trustBand, minBand);
  const tbScore   = trustBandScore(trustBand);
  const tbConstraint: ConstraintCheck = {
    constraint: 'Trust Band',
    status: bandMet ? 'MET' : 'NOT_MET',
    score: tbScore, maxScore: 20,
    detail: `Trust band ${trustBand} (score ${readinessScore}) — minimum required: ${minBand}`,
  };

  // ── Constraint: Credential Compatibility ───────────────────────────────────
  const requiredCreds = req.requiredCredentials ?? [];
  let credScore = 10;
  const missingCreds: string[] = [];
  if (requiredCreds.length > 0) {
    const presentSources = new Set(activeArtifacts.map(a => a.source));
    const metCount = requiredCreds.filter(c => presentSources.has(c)).length;
    missingCreds.push(...requiredCreds.filter(c => !presentSources.has(c)));
    credScore = Math.round((metCount / requiredCreds.length) * 10);
  }
  const credConstraint: ConstraintCheck = {
    constraint: 'Credential Compatibility',
    status: missingCreds.length === 0 ? 'MET' : credScore > 0 ? 'PARTIALLY_MET' : 'NOT_MET',
    score: credScore, maxScore: 10,
    detail: missingCreds.length === 0
      ? 'All required credentials present'
      : `Missing: ${missingCreds.join(', ')}`,
  };

  // ── Constraint: Availability Alignment ────────────────────────────────────
  const aScore = availabilityScore(avail.urgency);
  const urgencyMet = !req.urgency || avail.urgency === 'immediate' ||
    (req.urgency === 'within_30_days' && avail.urgency !== 'within_90_days' && avail.urgency !== 'exploring') ||
    (req.urgency !== 'immediate');
  const availConstraint: ConstraintCheck = {
    constraint: 'Availability Alignment',
    status: urgencyMet ? 'MET' : 'PARTIALLY_MET',
    score: aScore, maxScore: 5,
    detail: `Clinician: ${avail.urgency}, Facility needs: ${req.urgency ?? 'flexible'}`,
  };

  const constraints = [specConstraint, licConstraint, tbConstraint, credConstraint, availConstraint];
  const totalScore  = constraints.reduce((sum, c) => sum + c.score, 0);

  // ── Gaps ───────────────────────────────────────────────────────────────────
  const gaps: DeploymentGap[] = [];

  if (!hasLicenseInState) {
    gaps.push({
      type: 'LICENSE',
      description: `${req.state} state license required — clinician is not licensed in this state`,
      estimatedDaysToResolve: 45,
      blocking: req.specialty !== 'general',
    });
  }
  for (const cred of missingCreds) {
    gaps.push({
      type: 'CREDENTIAL',
      description: `Missing required credential: ${cred}`,
      estimatedDaysToResolve: estimateDaysForGapType('CREDENTIAL'),
      blocking: cred === 'DEA' || cred === 'BOARD_CERTIFICATION',
    });
  }
  if (!bandMet) {
    gaps.push({
      type: 'TRUST_BAND',
      description: `Trust band ${trustBand} below minimum ${minBand} — more verification needed`,
      estimatedDaysToResolve: 60,
      blocking: true,
    });
  }

  // Sanction check
  const oigArtifact = artifacts.find(a =>
    ['OIG_LEIE', 'OIG', 'LEIE'].includes(a.source) &&
    (a.status === 'SUSPENDED' || a.status === 'REVOKED')
  );
  if (oigArtifact) {
    gaps.push({
      type: 'SANCTION',
      description: 'OIG/LEIE exclusion active — clinician is not deployable',
      estimatedDaysToResolve: 0,
      blocking: true,
    });
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const hasBlockingGap = gaps.some(g => g.blocking);
  const verdict: DeploymentVerdict =
    hasBlockingGap            ? 'INELIGIBLE' :
    totalScore >= 70          ? 'READY' :
    totalScore >= 40          ? 'CREDENTIALING_REQUIRED' : 'INELIGIBLE';

  const maxGapDays = gaps.length === 0 ? 0
    : Math.max(...gaps.map(g => g.estimatedDaysToResolve));

  const estimatedDaysToDeploy = verdict === 'INELIGIBLE' ? null
    : verdict === 'READY' ? 2 : maxGapDays;

  const deployableBy = estimatedDaysToDeploy !== null
    ? new Date(Date.now() + estimatedDaysToDeploy * 86_400_000).toISOString()
    : null;

  const confidence: DeploymentMatch['confidence'] =
    (verdict === 'READY' && trustBand === 'L3') ? 'HIGH' :
    (verdict === 'INELIGIBLE' || trustBand === 'L0') ? 'LOW' : 'MEDIUM';

  const trustStateHash = sha256Short(JSON.stringify({
    npi, trustBand, readinessScore, computedAt,
  }));

  return {
    npi,
    facilityName: req.facilityName,
    matchScore: totalScore,
    verdict,
    confidence,
    trustBand,
    readinessScore,
    constraints,
    gaps,
    estimatedDaysToDeploy,
    deployableBy,
    specialty: avail.specialty,
    availableStates: avail.locations,
    availability: avail.urgency,
    credentialIds,
    trustStateHash,
    computedAt,
  };
}

// ── Pool-level matching ───────────────────────────────────────────────────────

export async function findDeploymentMatches(
  req: FacilityRequirement,
  options: { limit?: number; verdicts?: DeploymentVerdict[] } = {},
): Promise<DeploymentMatch[]> {
  const limit    = options.limit ?? 50;
  const verdicts = options.verdicts ?? ['READY', 'CREDENTIALING_REQUIRED'];

  // Get available pool first (fast DB query)
  const pool = await searchAvailablePool({
    specialty:          req.specialty,
    state:              req.state,
    trustBandMinimum:   req.minimumTrustBand ?? 'L1',
    availableBy:        req.availableBy,
  });

  // Score all candidates in parallel (batch)
  const scored = await Promise.allSettled(
    pool.map(c => scoreDeploymentMatch(c.npi, req))
  );

  const matches: DeploymentMatch[] = scored
    .filter((r): r is PromiseFulfilledResult<DeploymentMatch | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((m): m is DeploymentMatch => m !== null && verdicts.includes(m.verdict))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  log('info', 'deploymentMatch: pool scored', {
    facility: req.facilityName,
    specialty: req.specialty,
    state: req.state,
    poolSize: pool.length,
    matchCount: matches.length,
    readyCount: matches.filter(m => m.verdict === 'READY').length,
  });

  return matches;
}
