/**
 * opportunityFit — grounded reasons an opportunity does (or doesn't) fit a clinician's
 * stated preferences. Every reason is computed from BOTH the opportunity and a real
 * preference the clinician entered, so the "why it fits" copy is never fabricated.
 *
 * This complements the engine's MatchExplanation. The engine scores credential eligibility;
 * this explains preference alignment in the clinician's own terms.
 */

import type { ExplanationReason } from '@/components/matcha/MatchaExplanation';
import { type MatchaPreferences } from './preferences';

/** The opportunity fields this module reasons over (subset of the engine Opportunity). */
export interface FitOpportunity {
  state?: string;
  specialty?: string;
  remote?: boolean;
  payMin?: number;
  payMax?: number;
  hiringType?: string;
  employerType?: string;
}

const HIRING_TYPE_TO_EMPLOYMENT: Record<string, string> = {
  perm: 'full_time',
  'part-time': 'part_time',
  prn: 'per_diem',
  'short-term': 'contract',
  locums: 'locums',
  telehealth: 'telehealth',
};

function includesCaseInsensitive(list: string[] | undefined, value: string | undefined): boolean {
  if (!list || !value) return false;
  const needle = value.trim().toLowerCase();
  return list.some((item) => item.trim().toLowerCase() === needle);
}

/**
 * Produce preference-grounded reasons and concerns. Positive reasons are alignments;
 * negative reasons are honest mismatches. Only emits a reason when both sides are present.
 */
export function preferenceMatchReasons(
  prefs: MatchaPreferences,
  opp: FitOpportunity,
): ExplanationReason[] {
  const reasons: ExplanationReason[] = [];

  // Location
  if (opp.state && prefs.preferredStates?.length) {
    if (includesCaseInsensitive(prefs.preferredStates, opp.state)) {
      reasons.push({ label: `In ${opp.state}, one of your preferred locations`, positive: true, source: 'your preferences' });
    } else {
      reasons.push({ label: `In ${opp.state}, which isn't on your preferred list`, positive: false, source: 'your preferences' });
    }
  }

  // Remote
  if (opp.remote && (prefs.remoteInterest === 'interested' || prefs.remoteInterest === 'passionate')) {
    reasons.push({ label: 'Remote, which you said you want', positive: true, source: 'your preferences' });
  }

  // Specialty
  const wantedSpecialties = [...(prefs.desiredSpecialties ?? []), ...(prefs.currentSpecialties ?? [])];
  if (opp.specialty && wantedSpecialties.length) {
    if (includesCaseInsensitive(wantedSpecialties, opp.specialty)) {
      reasons.push({ label: `${opp.specialty} matches your specialty focus`, positive: true, source: 'your preferences' });
    }
  }

  // Compensation
  if (typeof opp.payMax === 'number' && typeof prefs.minimumSalary === 'number') {
    if (opp.payMax >= prefs.minimumSalary) {
      reasons.push({ label: 'Compensation meets your minimum', positive: true, source: 'your preferences' });
    } else {
      reasons.push({ label: 'Compensation is below your stated minimum', positive: false, source: 'your preferences' });
    }
  }

  // Arrangement
  if (opp.hiringType && prefs.employmentTypes?.length) {
    const mapped = HIRING_TYPE_TO_EMPLOYMENT[opp.hiringType];
    if (mapped && (prefs.employmentTypes as string[]).includes(mapped)) {
      reasons.push({ label: `${opp.hiringType.replace(/-/g, ' ')} matches how you want to work`, positive: true, source: 'your preferences' });
    }
  }

  return reasons;
}

/**
 * An honest, qualitative estimate of time-to-credential based only on how many hard
 * requirements are unmet. Always labeled as an estimate by the caller — never a promise.
 */
export function estimateTimeToCredential(missingHardCount: number): string {
  if (missingHardCount <= 0) return 'Ready now — no gating items outstanding';
  if (missingHardCount === 1) return 'About 1–2 weeks — one item to resolve';
  if (missingHardCount <= 3) return 'A few weeks — a handful of items to resolve';
  return 'Several weeks — multiple items to resolve';
}

/** Human label + tone for an engine match band. */
export function matchBandDisplay(band: string): { label: string; tone: 'go' | 'near' | 'partial' | 'blocked' } {
  switch (band) {
    case 'CLEAR': return { label: 'Cleared to apply', tone: 'go' };
    case 'NEAR_CLEAR': return { label: 'Nearly there', tone: 'near' };
    case 'PARTIAL': return { label: 'Partial fit', tone: 'partial' };
    case 'INELIGIBLE': return { label: 'Requirements missing', tone: 'blocked' };
    default: return { label: 'Reviewing', tone: 'partial' };
  }
}
