/**
 * MATCHA Profile derivation — "MATCHA understands you".
 *
 * Turns stated preferences into a reflected profile. This is the honest core of the
 * intelligence layer: MATCHA never claims to *know* something the clinician didn't tell it.
 * Every {@link MatchaInsight} records the exact preference fields it was derived from, so the
 * UI can show provenance ("because you told us X") next to every statement.
 *
 * Rules:
 *  - An insight is only produced when its source fields are answered.
 *  - No insight asserts a verified fact; they are reflections of stated preferences.
 *  - Confidence == preference completeness (see completenessPercent). It is a measure of how
 *    much MATCHA has been told, not a claim about match quality.
 */

import {
  type Importance,
  type Interest,
  type MatchaPreferences,
  type PreferenceField,
  completenessPercent,
  isFieldAnswered,
} from './preferences';

export type InsightCategory =
  | 'career_dna'
  | 'value'
  | 'strength'
  | 'ideal_organization'
  | 'ideal_team'
  | 'ideal_location'
  | 'ideal_compensation'
  | 'ideal_schedule'
  | 'career_direction';

export interface MatchaInsight {
  category: InsightCategory;
  /** Short human-readable statement, e.g. "Drawn to teaching hospitals". */
  label: string;
  /** The preference fields this was derived from — the provenance trail. */
  provenance: PreferenceField[];
}

export interface MatchaDerivedProfile {
  insights: MatchaInsight[];
  /** 0–100. Equals preference completeness — how much MATCHA has been told. */
  confidenceScore: number;
  /** 0–100. Same signal, framed as onboarding progress for the UI. */
  learningProgress: number;
  /** A single, plain-language summary when enough is known; null otherwise. */
  dreamRole: string | null;
  dreamEmployer: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const HIGH: ReadonlySet<Importance | Interest> = new Set(['high', 'interested', 'passionate']);
const STRONG: ReadonlySet<Interest> = new Set(['passionate']);

function has(prefs: MatchaPreferences, field: PreferenceField): boolean {
  return isFieldAnswered(prefs[field]);
}

function push(
  out: MatchaInsight[],
  category: InsightCategory,
  label: string,
  provenance: PreferenceField[],
): void {
  out.push({ category, label, provenance });
}

// ── Derivation ────────────────────────────────────────────────────────────────

/**
 * Derive the reflected profile from stated preferences. Pure and deterministic:
 * same input always yields the same output, and every insight is traceable.
 */
export function deriveMatchaProfile(prefs: MatchaPreferences): MatchaDerivedProfile {
  const insights: MatchaInsight[] = [];

  // ── Career DNA & direction ──────────────────────────────────────────────
  if (has(prefs, 'careerDirection')) {
    push(insights, 'career_direction', String(prefs.careerDirection), ['careerDirection']);
  }
  if (has(prefs, 'careerGoals')) {
    push(insights, 'career_dna', `Focused on: ${prefs.careerGoals!.join(', ')}`, ['careerGoals']);
  }
  if (prefs.leadershipAspiration && HIGH.has(prefs.leadershipAspiration)) {
    push(insights, 'career_dna', 'Aiming toward leadership', ['leadershipAspiration']);
  }
  if (prefs.newGraduate === true) {
    push(insights, 'career_dna', 'Early-career clinician', ['newGraduate']);
  }
  if (isFieldAnswered(prefs.yearsExperience) && (prefs.yearsExperience as number) >= 10) {
    push(insights, 'career_dna', 'Seasoned practitioner', ['yearsExperience']);
  }

  // ── Values ──────────────────────────────────────────────────────────────
  if (prefs.workLifeBalanceImportance === 'high') {
    push(insights, 'value', 'Values work–life balance', ['workLifeBalanceImportance']);
  }
  if (prefs.missionDrivenImportance === 'high') {
    push(insights, 'value', 'Mission-driven', ['missionDrivenImportance']);
  }
  if (prefs.diversityImportance === 'high') {
    push(insights, 'value', 'Values diverse teams', ['diversityImportance']);
  }
  if (prefs.teachingInterest && HIGH.has(prefs.teachingInterest)) {
    push(insights, 'value', 'Values teaching & mentorship', ['teachingInterest']);
  }

  // ── Strengths (reflected from experience + capabilities) ─────────────────
  if (has(prefs, 'currentSpecialties')) {
    push(insights, 'strength', `Practices ${prefs.currentSpecialties!.join(', ')}`, ['currentSpecialties']);
  }
  if (has(prefs, 'favoriteProcedures')) {
    push(insights, 'strength', `Skilled in ${prefs.favoriteProcedures!.join(', ')}`, ['favoriteProcedures']);
  }
  if (has(prefs, 'languagesSpoken') && prefs.languagesSpoken!.length > 1) {
    push(insights, 'strength', `Multilingual: ${prefs.languagesSpoken!.join(', ')}`, ['languagesSpoken']);
  }
  if (has(prefs, 'certifications')) {
    push(insights, 'strength', `Certified: ${prefs.certifications!.join(', ')}`, ['certifications']);
  }

  // ── Ideal organization ───────────────────────────────────────────────────
  const orgFields: Array<[PreferenceField, string]> = [
    ['academicHospitalInterest', 'academic hospitals'],
    ['communityHospitalInterest', 'community hospitals'],
    ['privatePracticeInterest', 'private practice'],
    ['largeHealthSystemInterest', 'large health systems'],
    ['startupInterest', 'startups'],
  ];
  const idealOrgs = orgFields.filter(([f]) => {
    const v = prefs[f] as Interest | undefined;
    return v !== undefined && HIGH.has(v);
  });
  if (idealOrgs.length) {
    push(
      insights,
      'ideal_organization',
      `Drawn to ${idealOrgs.map(([, label]) => label).join(', ')}`,
      idealOrgs.map(([f]) => f),
    );
  }

  // ── Ideal team ────────────────────────────────────────────────────────────
  if (has(prefs, 'teamSizePreference') && prefs.teamSizePreference !== 'no_preference') {
    push(insights, 'ideal_team', `Prefers a ${prefs.teamSizePreference} team`, ['teamSizePreference']);
  }
  if (has(prefs, 'culturePreference')) {
    push(insights, 'ideal_team', `Culture: ${prefs.culturePreference!.join(', ')}`, ['culturePreference']);
  }

  // ── Ideal location ──────────────────────────────────────────────────────
  if (has(prefs, 'preferredStates')) {
    push(insights, 'ideal_location', `Wants to work in ${prefs.preferredStates!.join(', ')}`, ['preferredStates']);
  }
  if (prefs.remoteInterest && STRONG.has(prefs.remoteInterest)) {
    push(insights, 'ideal_location', 'Strongly prefers remote', ['remoteInterest']);
  } else if (prefs.remoteInterest && HIGH.has(prefs.remoteInterest)) {
    push(insights, 'ideal_location', 'Open to remote', ['remoteInterest']);
  }
  if (isFieldAnswered(prefs.commuteRadiusMiles)) {
    push(insights, 'ideal_location', `Commute up to ${prefs.commuteRadiusMiles} mi`, ['commuteRadiusMiles']);
  }

  // ── Ideal compensation ──────────────────────────────────────────────────
  if (isFieldAnswered(prefs.desiredSalary)) {
    push(
      insights,
      'ideal_compensation',
      `Target ~$${(prefs.desiredSalary as number).toLocaleString()}`,
      ['desiredSalary'],
    );
  } else if (isFieldAnswered(prefs.minimumSalary)) {
    push(
      insights,
      'ideal_compensation',
      `Floor $${(prefs.minimumSalary as number).toLocaleString()}`,
      ['minimumSalary'],
    );
  }
  const benefitPriorities: Array<[PreferenceField, string]> = [
    ['signOnBonusImportance', 'sign-on bonus'],
    ['ptoImportance', 'PTO'],
    ['retirementImportance', 'retirement'],
    ['healthInsuranceImportance', 'health insurance'],
  ];
  const topBenefits = benefitPriorities.filter(([f]) => prefs[f] === 'high');
  if (topBenefits.length) {
    push(
      insights,
      'ideal_compensation',
      `Prioritizes ${topBenefits.map(([, l]) => l).join(', ')}`,
      topBenefits.map(([f]) => f),
    );
  }

  // ── Ideal schedule ──────────────────────────────────────────────────────
  if (has(prefs, 'shiftPreference')) {
    push(insights, 'ideal_schedule', `Prefers ${prefs.shiftPreference} shifts`, ['shiftPreference']);
  }
  if (has(prefs, 'employmentTypes')) {
    push(insights, 'ideal_schedule', `Open to ${prefs.employmentTypes!.join(', ').replace(/_/g, ' ')}`, ['employmentTypes']);
  }
  if (prefs.scheduleFlexibility === 'high') {
    push(insights, 'ideal_schedule', 'Needs schedule flexibility', ['scheduleFlexibility']);
  }

  // ── Dream role / employer (only when the signal is unambiguous) ──────────
  const dreamRole = deriveDreamRole(prefs);
  const dreamEmployer = deriveDreamEmployer(prefs, idealOrgs.map(([, l]) => l));

  const confidenceScore = completenessPercent(prefs);
  return {
    insights,
    confidenceScore,
    learningProgress: confidenceScore,
    dreamRole,
    dreamEmployer,
  };
}

function deriveDreamRole(prefs: MatchaPreferences): string | null {
  const specialty = prefs.desiredSpecialties?.[0] ?? prefs.currentSpecialties?.[0];
  if (!specialty) return null;
  const setting =
    prefs.academicHospitalInterest && HIGH.has(prefs.academicHospitalInterest)
      ? 'academic'
      : prefs.startupInterest && HIGH.has(prefs.startupInterest)
        ? 'startup'
        : null;
  const leading = prefs.leadershipAspiration && HIGH.has(prefs.leadershipAspiration);
  const parts = [leading ? 'Lead' : null, setting, specialty, 'role'].filter(Boolean);
  return parts.join(' ');
}

function deriveDreamEmployer(prefs: MatchaPreferences, idealOrgLabels: string[]): string | null {
  if (!idealOrgLabels.length) return null;
  const location = prefs.preferredStates?.[0];
  const base = idealOrgLabels[0];
  return location ? `${base} in ${location}` : base;
}
