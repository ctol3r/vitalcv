/**
 * Wave 187 — MATCHA Refoundation: Core Scoring Engine
 *
 * Deterministic, explainable matching pipeline:
 *   clinicianProfile × intent × opportunities → OpportunityMatch[]
 *
 * Scoring dimensions (weights):
 *   1. Hard credential gating     — hard gate (fails = INELIGIBLE)
 *   2. State / specialty match    — 25 pts
 *   3. Schedule / location fit    — 15 pts
 *   4. Compensation fit           — 15 pts
 *   5. Intent fit                 — 20 pts
 *   6. Employer preference fit    — 15 pts
 *   7. Prequalification bonus     — 10 pts
 */

import { randomUUID } from 'crypto';
import type {
  ClinicianProfile,
  CandidateIntent,
  Opportunity,
  OpportunityMatch,
  MatchExplanation,
  MatchBand,
  MatchBlocker,
  FitReason,
  EligibilityDecision,
  InstantOfferEligibility,
  CredentialKey,
} from './matchaModels';

// ── Band thresholds ───────────────────────────────────────────────────────────

const BAND_THRESHOLDS: Record<MatchBand, number> = {
  CLEAR:      85,
  NEAR_CLEAR: 60,
  PARTIAL:    30,
  INELIGIBLE: 0,
};

function scoreToBand(score: number, hardBlocked: boolean): MatchBand {
  if (hardBlocked) return 'INELIGIBLE';
  if (score >= BAND_THRESHOLDS.CLEAR) return 'CLEAR';
  if (score >= BAND_THRESHOLDS.NEAR_CLEAR) return 'NEAR_CLEAR';
  if (score >= BAND_THRESHOLDS.PARTIAL) return 'PARTIAL';
  return 'INELIGIBLE';
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function scoreOpportunity(
  clinician: ClinicianProfile,
  intent: CandidateIntent | null,
  opp: Opportunity,
): MatchExplanation {
  const fitReasons: FitReason[] = [];
  const blockers: MatchBlocker[] = [];
  const missingCredentials: CredentialKey[] = [];
  let score = 0;
  let hardBlocked = false;

  // ── 1. Hard credential gating (required L3 creds must be active) ─────────

  const heldMap = new Map(clinician.credentials.map(c => [c.key, c]));

  for (const req of opp.requirements) {
    if (req.priority !== 'required') continue;
    const held = heldMap.get(req.key);

    const stateMatch = !req.state || (held?.state === req.state);
    const specialtyMatch = !req.specialty || (held?.specialty?.toLowerCase() === req.specialty.toLowerCase());
    const levelSufficient = held && levelNum(held.claimLevel) >= levelNum(req.level);
    const statusOk = held && (held.status === 'active' || held.status === 'expiring');

    if (!held || !levelSufficient || !statusOk || !stateMatch || !specialtyMatch) {
      hardBlocked = true;
      missingCredentials.push(req.key);
      blockers.push({
        credentialKey: req.key,
        label: req.label + (req.state ? ` (${req.state})` : ''),
        severity: 'hard',
        actionLabel: held ? `Upgrade ${req.label}` : `Add ${req.label}`,
        actionUrl: `/holder/readiness#${req.key}`,
      });
    } else if (held.status === 'expiring') {
      blockers.push({
        credentialKey: req.key,
        label: `${req.label} expiring soon`,
        severity: 'soft',
        actionLabel: `Renew ${req.label}`,
        actionUrl: `/holder/readiness#${req.key}`,
      });
      fitReasons.push({ dimension: 'credentials', label: `${req.label} active (expiring)`, positive: true });
    } else {
      fitReasons.push({ dimension: 'credentials', label: `${req.label} verified`, positive: true });
    }
  }

  if (hardBlocked) {
    return {
      matchBand: 'INELIGIBLE',
      matchScore: 0,
      confidence: 0.95,
      fitReasons,
      blockers,
      missingCredentials,
      instantOfferEligible: false,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 2. State / specialty eligibility (25 pts) ────────────────────────────

  const stateEligible = clinician.states.includes(opp.state) || opp.remote;
  const specialtyMatch = clinician.specialty.toLowerCase() === opp.specialty.toLowerCase()
    || opp.specialty === 'All Specialties';

  if (stateEligible) {
    score += 15;
    fitReasons.push({ dimension: 'state', label: `Licensed in ${opp.state}`, positive: true });
  } else {
    score += 3;
    fitReasons.push({ dimension: 'state', label: `Not yet licensed in ${opp.state}`, positive: false });
    blockers.push({
      credentialKey: 'state_license',
      label: `${opp.state} medical license`,
      severity: 'soft',
      actionLabel: `Apply for ${opp.state} license`,
      actionUrl: `/holder/readiness#state_license`,
    });
  }

  if (specialtyMatch) {
    score += 10;
    fitReasons.push({ dimension: 'specialty', label: `Specialty match: ${clinician.specialty}`, positive: true });
  } else {
    score += 2;
    fitReasons.push({ dimension: 'specialty', label: `Specialty mismatch (${opp.specialty} required)`, positive: false });
  }

  // ── 3. Schedule / location fit (15 pts) ──────────────────────────────────

  const intHiringTypes = intent?.preferredHiringTypes ?? [];
  const hiringMatch = intHiringTypes.length === 0 || intHiringTypes.includes(opp.hiringType);
  const remoteMatch = !intent?.remoteOnly || opp.remote;

  if (hiringMatch) {
    score += 8;
    fitReasons.push({ dimension: 'schedule', label: `${capitalize(opp.hiringType)} role matches preference`, positive: true });
  } else {
    score += 2;
    fitReasons.push({ dimension: 'schedule', label: `Hiring type ${opp.hiringType} not preferred`, positive: false });
  }

  if (remoteMatch) {
    score += 7;
    if (opp.remote) fitReasons.push({ dimension: 'location', label: 'Remote / telehealth eligible', positive: true });
  } else {
    score += 1;
    fitReasons.push({ dimension: 'location', label: 'Remote-only preference not met', positive: false });
  }

  // ── 4. Compensation fit (15 pts) ─────────────────────────────────────────

  if (intent?.payMin && opp.payMax) {
    if (opp.payMax >= intent.payMin) {
      score += 15;
      fitReasons.push({ dimension: 'pay', label: `Pay range meets minimum ($${intent.payMin}/hr)`, positive: true });
    } else {
      score += 2;
      fitReasons.push({ dimension: 'pay', label: 'Pay range below minimum preference', positive: false });
    }
  } else if (opp.payRange) {
    score += 10; // pay disclosed, no preference set
    fitReasons.push({ dimension: 'pay', label: `Pay range disclosed: ${opp.payRange}`, positive: true });
  } else {
    score += 5; // no data
  }

  // ── 5. Intent fit (20 pts) ────────────────────────────────────────────────

  const stateIntentMatch = !intent?.preferredStates?.length
    || intent.preferredStates.includes(opp.state)
    || opp.remote;

  if (stateIntentMatch) {
    score += 10;
    fitReasons.push({ dimension: 'intent', label: `${opp.state} is in preferred locations`, positive: true });
  } else {
    score += 2;
  }

  const urgencyMatch = !intent?.startUrgency || intent.startUrgency === opp.startUrgency
    || intent.startUrgency === 'flexible';

  if (urgencyMatch) {
    score += 10;
    fitReasons.push({ dimension: 'intent', label: `Start timing aligns`, positive: true });
  } else {
    score += 3;
  }

  // ── 6. Employer preference fit (15 pts) ──────────────────────────────────

  const prefCreds = clinician.credentials.filter(c => c.status === 'active' && c.claimLevel === 'L3');
  const credRatio = prefCreds.length / Math.max(opp.requirements.length, 1);
  const empScore = Math.round(credRatio * 15);
  score += empScore;
  if (credRatio >= 0.8) {
    fitReasons.push({ dimension: 'employer', label: `${Math.round(credRatio * 100)}% of requirements met at L3`, positive: true });
  }

  // ── 7. Prequalification bonus (10 pts) ───────────────────────────────────

  let prequalBonus = 0;
  if (clinician.prequalified) {
    prequalBonus += 5;
    fitReasons.push({ dimension: 'prequalification', label: 'Clinician is prequalified', positive: true });
  }
  if (clinician.interviewComplete) {
    prequalBonus += 3;
    fitReasons.push({ dimension: 'prequalification', label: 'AI interview complete', positive: true });
  }
  if (clinician.assessmentsComplete?.length) {
    prequalBonus += 2;
    fitReasons.push({
      dimension: 'prequalification',
      label: `${clinician.assessmentsComplete.length} assessment(s) complete`,
      positive: true,
    });
  }
  score += prequalBonus;

  // Cap at 100
  score = Math.min(100, score);
  const band = scoreToBand(score, false);

  // Instant offer: CLEAR band + prequalified + no soft blockers
  const softBlockers = blockers.filter(b => b.severity === 'soft').length;
  const instantOfferEligible = band === 'CLEAR' && !!clinician.prequalified && softBlockers === 0;

  return {
    matchBand: band,
    matchScore: score,
    confidence: 0.87,
    fitReasons,
    blockers,
    missingCredentials,
    instantOfferEligible,
    generatedAt: new Date().toISOString(),
  };
}

// ── Batch match ───────────────────────────────────────────────────────────────

export function matchOpportunities(
  clinician: ClinicianProfile,
  intent: CandidateIntent | null,
  opportunities: Opportunity[],
): OpportunityMatch[] {
  return opportunities
    .filter(o => o.active)
    .map(opp => ({
      opportunity: opp,
      explanation: scoreOpportunity(clinician, intent, opp),
    }))
    .sort((a, b) => b.explanation.matchScore - a.explanation.matchScore);
}

// ── Audit record ──────────────────────────────────────────────────────────────

export function buildDecisionAudit(
  npi: string,
  opp: Opportunity,
  explanation: MatchExplanation,
): EligibilityDecision {
  return {
    decisionId: randomUUID(),
    npi,
    opportunityId: opp.id,
    band: explanation.matchBand,
    score: explanation.matchScore,
    blockers: explanation.blockers.map(b => b.label),
    decidedAt: new Date().toISOString(),
    version: '187.1',
  };
}

// ── Instant offer check ───────────────────────────────────────────────────────

export function checkInstantOfferEligibility(
  npi: string,
  opp: Opportunity,
  explanation: MatchExplanation,
): InstantOfferEligibility {
  return {
    npi,
    opportunityId: opp.id,
    eligible: explanation.instantOfferEligible,
    score: explanation.matchScore,
    reason: explanation.instantOfferEligible
      ? 'All credentials verified, prequalified, no blockers'
      : explanation.blockers.map(b => b.label).join('; ') || 'Score below instant-offer threshold',
    checkedAt: new Date().toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelNum(level: string): number {
  return parseInt(level.replace('L', '')) || 0;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}
