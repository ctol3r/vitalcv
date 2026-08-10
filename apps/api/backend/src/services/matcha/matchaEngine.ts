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
 *   8. Historical outcome boost   — ±8 pts (from employer accept/reject patterns)
 */

import { randomUUID } from 'crypto';

import { isSpecialtyStated } from '../ingestion/types';
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
  ClaimLevel,
  SpecialtySource,
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

// ── Source-coverage honesty ───────────────────────────────────────────────────
//
// A fit reason is copy the clinician reads. It may only assert what the claim
// level actually supports:
//   L3 — confirmed against the issuing source        → "checked"
//   L2 — claimed/derived, NOT source-confirmed       → "on file, not source-checked"
//   L0/L1 — unknown                                  → "not checked"
// Never "verified": an active status means the record is current, not that any
// source confirmed it. See docs/architecture/vitalcv-knowledge-trust-graph.md.

function credentialCoverageLabel(requirementLabel: string, claimLevel: ClaimLevel): string {
  if (claimLevel === 'L3') return `${requirementLabel} checked`;
  if (claimLevel === 'L2') return `${requirementLabel} on file, not source-checked`;
  return `${requirementLabel} not checked`;
}

/**
 * Specialty coverage copy — same honesty contract as credentialCoverageLabel.
 * A specialty is "checked" ONLY when it was read from an authoritative source
 * (the clinician's NPPES primary taxonomy). A self-reported specialty, or an
 * unresolved default, is on file but not source-confirmed. Absent provenance is
 * treated as unverified, never as checked, so a caller that forgets to set
 * `specialtySource` can never over-claim (the bug class #712 fixed for
 * licensure). The "checked · NPPES" wording is what the deck's explanation
 * mapper keys on to route a specialty fit into its source-backed group.
 */
function specialtyCoverageLabel(specialty: string, source: SpecialtySource | undefined): string {
  if (source === 'nppes_taxonomy') return `${specialty} specialty checked · NPPES`;
  return `${specialty} specialty on file, not source-checked`;
}

/**
 * The clinician's licence claim for a specific state, if any. Licensure is a
 * credential fact — it is NEVER inferred from a practice address, and a remote
 * posting does not imply licensure in the posting's state.
 */
function stateLicenseClaim(
  clinician: ClinicianProfile,
  state: string,
): { held: boolean; sourceChecked: boolean } {
  const license = clinician.credentials.find(
    c =>
      c.key === 'state_license' &&
      c.state === state &&
      (c.status === 'active' || c.status === 'expiring'),
  );
  return {
    held: !!license,
    sourceChecked: !!license && levelNum(license.claimLevel) >= levelNum('L3'),
  };
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function scoreOpportunity(
  clinician: ClinicianProfile,
  intent: CandidateIntent | null,
  opp: Opportunity,
  options?: { historicalBoostScore?: number },
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
      fitReasons.push({
        dimension: 'credentials',
        label: `${credentialCoverageLabel(req.label, held.claimLevel)}, expiring soon`,
        positive: true,
      });
    } else {
      fitReasons.push({
        dimension: 'credentials',
        label: credentialCoverageLabel(req.label, held.claimLevel),
        positive: true,
      });
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

  const license = stateLicenseClaim(clinician, opp.state);
  const practicesInState = clinician.states.includes(opp.state);

  // Telehealth is practised where the PATIENT is: a remote posting does not
  // relax state licensure, it relocates it to the posting's state. Remote is
  // therefore NOT a licensure exemption and never grants state eligibility.
  //   CCHP: "When telehealth is used, it is considered to be rendered at the
  //   physical location of the patient, and therefore a provider typically
  //   needs to be licensed in the patient's state."
  //   FSMB: state boards require licensure where the patient is located, or
  //   registration under a state's interstate telehealth registry.
  // Eligibility comes from a licence claim for the state, or (weaker) an
  // NPPES practice address there. Compacts (IMLC), state telehealth
  // registries, and episodic/follow-up exceptions are real pathways we cannot
  // see, so a missing licence is a SOFT blocker — never INELIGIBLE.
  const stateEligible = license.held || practicesInState;
  /*
   * A feed listing carries a placeholder when the source published no
   * specialty. Comparing against it produced, in production, on all 454
   * ingested rows:
   *
   *   "Specialty mismatch (Not stated required)"
   *
   * — telling a clinician an employer requires a specialty called "Not
   * stated". The employer said nothing; the placeholder records that silence.
   * Publishing it as a requirement invents an employer statement, which is the
   * thing listingSource='public_feed' exists to prevent.
   */
  const specialtyStated = isSpecialtyStated(opp.specialty);
  const specialtyMatch = specialtyStated
    && (clinician.specialty.toLowerCase() === opp.specialty.toLowerCase()
      || opp.specialty === 'All Specialties');

  const licenseBlocker = (actionLabel: string): MatchBlocker => ({
    credentialKey: 'state_license',
    label: `${opp.state} medical license`,
    severity: 'soft',
    actionLabel,
    actionUrl: `/holder/readiness#state_license`,
  });

  if (stateEligible) {
    score += 15;
    if (license.sourceChecked) {
      fitReasons.push({ dimension: 'state', label: `${opp.state} license checked`, positive: true });
    } else if (license.held) {
      fitReasons.push({
        dimension: 'state',
        label: `${opp.state} license on file, not source-checked`,
        positive: true,
      });
      blockers.push(licenseBlocker(`Confirm ${opp.state} license`));
    } else {
      // An NPPES practice address in the state — a location signal, not licensure.
      fitReasons.push({
        dimension: 'state',
        label: `Practice address in ${opp.state} — license not checked`,
        positive: false,
      });
      blockers.push(licenseBlocker(`Add ${opp.state} license`));
    }
  } else {
    score += 3;
    fitReasons.push({
      dimension: 'state',
      label: opp.remote
        ? `Remote role — needs ${opp.state} license (telehealth is practiced where the patient is)`
        : `No ${opp.state} license on file`,
      positive: false,
    });
    blockers.push(licenseBlocker(`Apply for ${opp.state} license`));
  }

  if (specialtyMatch) {
    score += 10;
    fitReasons.push({
      dimension: 'specialty',
      label: specialtyCoverageLabel(clinician.specialty, clinician.specialtySource),
      positive: true,
    });
  } else if (!specialtyStated) {
    /*
     * Scored exactly as a mismatch is — no credit, but no worse either.
     *
     * Awarding nothing here ranked an unstated specialty BELOW a known
     * mismatch (70 vs 72): a role that might fit sorted under one that
     * demonstrably does not. Silence is not evidence of unfit. It earns no
     * credit, because nothing was matched, and takes no penalty, because
     * nothing failed.
     *
     * The reason names the LISTING's silence and attributes it to the listing,
     * never to the employer.
     */
    score += 2;
    fitReasons.push({
      dimension: 'specialty',
      label: 'This listing does not state a specialty',
      positive: false,
    });
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

  // ── 8. Historical outcome boost (±8 pts) ──────────────────────────────────
  // Baked into score from cached employer accept/reject patterns.
  // Never overrides hard credential gating — only adjusts soft ranking.

  const historicalBoost = options?.historicalBoostScore ?? 0;
  if (historicalBoost !== 0) {
    score += historicalBoost;
    fitReasons.push({
      dimension: 'historical',
      label: historicalBoost > 0
        ? `Employer has high accept rate for similar profiles (+${historicalBoost})`
        : `Employer has low accept rate for similar profiles (${historicalBoost})`,
      positive: historicalBoost > 0,
    });
  }

  // Cap at 100, floor at 0
  score = Math.max(0, Math.min(100, score));
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
  boostMap?: Map<string, number>,
): OpportunityMatch[] {
  return opportunities
    .filter(o => o.active)
    .map(opp => ({
      opportunity: opp,
      explanation: scoreOpportunity(clinician, intent, opp, {
        historicalBoostScore: boostMap?.get(opp.id) ?? 0,
      }),
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
