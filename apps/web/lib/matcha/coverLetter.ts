/**
 * MATCHA cover-letter drafting — prompt construction.
 *
 * Truth rule: the draft is grounded ONLY in what the clinician has stated about their own
 * preferences and the public opportunity details. The system prompt forbids inventing
 * credentials, licenses, board certifications, employers, dates, or metrics. The result is an
 * editable DRAFT the clinician reviews — clearly labeled as AI-generated in the UI.
 *
 * Pure and testable — the API route (app/api/matcha/cover-letter) builds messages from here and
 * calls the model. No network in this module.
 */

import type { MatchaPreferences } from './preferences';

export interface CoverLetterOpportunity {
  title?: string;
  organization?: string;
  specialty?: string;
  location?: string;
}

const HIGH_INTEREST = new Set(['interested', 'passionate']);
const HIGH_IMPORTANCE = new Set(['high']);

/**
 * Turn stated preferences into a factual bullet list for the prompt. Only answered fields are
 * included, and only preference facts — never credential or verification claims.
 */
export function summarizeProfileForLetter(prefs: MatchaPreferences, name?: string): string {
  const lines: string[] = [];
  if (name?.trim()) lines.push(`Name: ${name.trim()}`);

  if (prefs.currentSpecialties?.length) lines.push(`Practices: ${prefs.currentSpecialties.join(', ')}`);
  if (prefs.desiredSpecialties?.length) lines.push(`Wants to move toward: ${prefs.desiredSpecialties.join(', ')}`);
  if (prefs.careerDirection) lines.push(`Career direction: ${prefs.careerDirection}`);
  if (prefs.careerGoals?.length) lines.push(`Goals: ${prefs.careerGoals.join(', ')}`);
  if (prefs.preferredStates?.length) lines.push(`Prefers to work in: ${prefs.preferredStates.join(', ')}`);
  if (prefs.employmentTypes?.length) lines.push(`Open to: ${prefs.employmentTypes.join(', ').replace(/_/g, ' ')}`);
  if (prefs.favoriteProcedures?.length) lines.push(`Enjoys: ${prefs.favoriteProcedures.join(', ')}`);
  if (prefs.populationPreferences?.length) lines.push(`Patient focus: ${prefs.populationPreferences.join(', ')}`);
  if (prefs.languagesSpoken && prefs.languagesSpoken.length > 1) lines.push(`Languages: ${prefs.languagesSpoken.join(', ')}`);

  const values: string[] = [];
  if (HIGH_IMPORTANCE.has(prefs.workLifeBalanceImportance ?? '')) values.push('work–life balance');
  if (HIGH_IMPORTANCE.has(prefs.missionDrivenImportance ?? '')) values.push('mission-driven work');
  if (prefs.teachingInterest && HIGH_INTEREST.has(prefs.teachingInterest)) values.push('teaching & mentorship');
  if (prefs.researchInterest && HIGH_INTEREST.has(prefs.researchInterest)) values.push('research');
  if (prefs.leadershipAspiration && HIGH_INTEREST.has(prefs.leadershipAspiration)) values.push('leadership');
  if (values.length) lines.push(`Values: ${values.join(', ')}`);

  return lines.join('\n');
}

export interface CoverLetterMessages {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = [
  'You draft short, professional cover-letter DRAFTS for clinicians applying to healthcare roles.',
  '',
  'Hard rules:',
  '- Use ONLY the facts provided below. Do NOT invent or imply any credential, license, board',
  '  certification, NPI, degree, years of experience, past employer, publication, date, or metric',
  '  that is not explicitly given.',
  '- Do NOT claim anything is "verified" or make guarantees about the clinician.',
  '- If a detail is not provided, leave it out — keep the letter general rather than fabricating.',
  '- Warm, concise, first person, ~150–190 words. No greeting placeholders like "[Hiring Manager]"',
  '  unless natural; prefer "Dear Hiring Team,".',
  '- Output ONLY the letter text. No preamble, no notes, no markdown headers.',
].join('\n');

/** Build the system + user messages for the cover-letter request. */
export function buildCoverLetterMessages(input: {
  profileSummary: string;
  opportunity: CoverLetterOpportunity;
}): CoverLetterMessages {
  const opp = input.opportunity;
  const oppLines = [
    opp.title ? `Role: ${opp.title}` : null,
    opp.organization ? `Organization: ${opp.organization}` : null,
    opp.specialty ? `Specialty: ${opp.specialty}` : null,
    opp.location ? `Location: ${opp.location}` : null,
  ].filter(Boolean).join('\n');

  const profile = input.profileSummary.trim() || '(No preferences shared yet — keep the letter general.)';

  const user = [
    'Draft a cover letter for this opportunity.',
    '',
    'Opportunity:',
    oppLines || '(No opportunity details provided.)',
    '',
    'What the clinician has shared about themselves (the only facts you may use):',
    profile,
  ].join('\n');

  return { system: SYSTEM_PROMPT, user };
}
