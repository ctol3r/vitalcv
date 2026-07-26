/**
 * Grounded prompt for the OPTIONAL MATCHA match-explanation AI.
 *
 * Feeds the model ONLY the deterministic match facts (the engine's fit reasons,
 * blockers, band) plus the clinician's own stated summary. The model personalizes
 * the *tone*; it must not invent credentials, scores, employers, salary, or any
 * fact not given, and it must stay honest (a source-backed match is never a job
 * guarantee). Same grounding discipline as lib/matcha/coverLetter.ts. When no
 * ANTHROPIC_API_KEY is set the feature is off entirely and the UI keeps showing
 * the deterministic reasons unchanged.
 */

export interface MatchExplanationOpportunity {
  title?: string;
  organization?: string;
  specialty?: string;
  location?: string;
}

export interface MatchExplanationInput {
  opportunity: MatchExplanationOpportunity;
  matchBand?: string;
  fitReasons?: Array<{ label: string; positive: boolean }>;
  blockers?: Array<{ label: string; severity?: string }>;
  /** Clinician's own self-stated summary (never source-verified facts). */
  profileSummary?: string;
}

export function buildMatchExplanationMessages(input: MatchExplanationInput): {
  system: string;
  user: string;
} {
  const system = [
    'You write a short, warm, honest "why this role could fit you" note for a clinician viewing a role VitalCV matched them to.',
    'Rules, strictly:',
    '- Use ONLY the fit signals, blockers, and facts provided below. Never invent a credential, score, employer, salary, or any fact that is not given.',
    '- 2-3 sentences, second person ("you"), plain and specific. No hype, no emojis, no exclamation points.',
    '- If blockers are listed, name them honestly as the next steps — do not gloss over them.',
    '- This is a source-backed match, not a job offer or guarantee. Never promise a role, interview, or outcome.',
    '- Weave the signals into natural language; do not just restate the raw labels.',
  ].join('\n');

  const opp = input.opportunity ?? {};
  const header =
    `Role: ${opp.title ?? 'Clinical role'}` +
    (opp.organization ? ` at ${opp.organization}` : '') +
    (opp.specialty ? ` · ${opp.specialty}` : '') +
    (opp.location ? ` · ${opp.location}` : '');

  const reasons =
    (input.fitReasons ?? [])
      .filter((r) => r.positive)
      .map((r) => `- ${r.label}`)
      .join('\n') || '- (no specific fit signals provided)';

  const blockers =
    (input.blockers ?? [])
      .map((b) => `- ${b.label}${b.severity ? ` (${b.severity})` : ''}`)
      .join('\n') || '- (none)';

  const user = [
    header,
    input.matchBand ? `Match band: ${input.matchBand}` : '',
    input.profileSummary ? `About you (self-stated, not source-verified): ${input.profileSummary}` : '',
    `Fit signals:\n${reasons}`,
    `What's still needed / blockers:\n${blockers}`,
    '',
    'Write the note now.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}
