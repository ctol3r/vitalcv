import type { LicenseCandidate } from '../models';

const EDUCATION_PATTERNS = [
  /\beducation\b/i,
  /\buniversity\b/i,
  /\bcollege\b/i,
  /\bmedical school\b/i,
  /\bbachelor\b/i,
  /\bmaster\b/i,
  /\bdoctor\b/i,
] as const;

const TRAINING_PATTERNS = [
  /\btraining\b/i,
  /\bresidency\b/i,
  /\bfellowship\b/i,
  /\binternship\b/i,
  /\bclinical rotation\b/i,
] as const;

const LICENSURE_PATTERNS = [
  /\blicense\b/i,
  /\blicensed\b/i,
  /\bboard certified\b/i,
  /\bnpi\b/i,
  /\bdea\b/i,
  /\brn\b/i,
  /\bmd\b/i,
  /\bdo\b/i,
] as const;

const EMPLOYMENT_PATTERNS = [
  /\bexperience\b/i,
  /\bemployment\b/i,
  /\bhospital\b/i,
  /\bclinic\b/i,
  /\bmedical center\b/i,
  /\bhealth\b/i,
  /(19|20)\d{2}/,
] as const;

const US_STATE_ABBR = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
] as const;

const US_STATE_FULL: Record<string, (typeof US_STATE_ABBR)[number]> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  'WEST VIRGINIA': 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
};

const US_STATE_PATTERN = new RegExp(`\\b(${US_STATE_ABBR.join('|')})\\b`, 'i');
const LICENSE_NUMBER_PATTERN =
  /\b(?:licen(?:s|c)e(?:\s*(?:no|#|number))?[:\s-]*)([A-Za-z0-9-]{4,})/i;

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toUniqueSorted(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort(
      (left, right) => left.localeCompare(right),
    ),
  );
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function extractCategory(lines: readonly string[], patterns: readonly RegExp[]): readonly string[] {
  return toUniqueSorted(lines.filter((line) => matchesAny(line, patterns)));
}

function normalizeUsState(value: string): string | null {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) return null;

  if (US_STATE_ABBR.includes(normalized as (typeof US_STATE_ABBR)[number])) {
    return normalized;
  }

  return US_STATE_FULL[normalized] ?? null;
}

function detectNameHint(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    if (line.length > 60) continue;
    if (/\d/.test(line)) continue;
    if (matchesAny(line, [...EDUCATION_PATTERNS, ...TRAINING_PATTERNS, ...LICENSURE_PATTERNS])) {
      continue;
    }

    const words = line
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    if (words.length >= 2 && words.length <= 4) {
      return words
        .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
        .join(' ');
    }
  }

  return undefined;
}

export type ParseResumeOutput = Readonly<{
  normalized_text: string;
  lines: readonly string[];
  education: readonly string[];
  training: readonly string[];
  licensure_mentions: readonly string[];
  licenses: readonly LicenseCandidate[];
  employment_timeline: readonly string[];
  name_hint?: string;
  pre_psv_confidence_score: number;
}>;

export type ConfidenceScoreInput = Readonly<{
  education: readonly string[];
  training: readonly string[];
  licensure_mentions: readonly string[];
  licenses: readonly LicenseCandidate[];
  employment_timeline: readonly string[];
  name_hint?: string;
}>;

export function normalizeStates(states: readonly string[]): readonly string[] {
  const normalized = states
    .map((state) => normalizeUsState(state))
    .filter((state): state is string => Boolean(state));

  return Object.freeze([...new Set(normalized)].sort((left, right) => left.localeCompare(right)));
}

export function detectLicenses(input: {
  lines: readonly string[];
  source: 'resume' | 'npi';
}): readonly LicenseCandidate[] {
  const dedup = new Map<string, LicenseCandidate>();

  for (const rawLine of input.lines) {
    const line = normalizeString(rawLine);
    if (!line) continue;

    if (input.source === 'resume' && !matchesAny(line, LICENSURE_PATTERNS)) continue;

    const stateMatch = line.match(US_STATE_PATTERN);
    const state = stateMatch ? normalizeUsState(stateMatch[1]) : null;
    const numberMatch = line.match(LICENSE_NUMBER_PATTERN);
    const number = numberMatch ? numberMatch[1].trim() : undefined;

    const normalizedState = state ?? 'UNKNOWN';
    const key = `${normalizedState}:${number ?? ''}:${input.source}`;

    if (!dedup.has(key)) {
      dedup.set(
        key,
        Object.freeze({
          state: normalizedState,
          ...(number ? { number } : {}),
          source: input.source,
          status: 'UNVERIFIED' as const,
        }),
      );
    }
  }

  return Object.freeze(
    [...dedup.values()].sort((left, right) => {
      if (left.state !== right.state) return left.state.localeCompare(right.state);
      return String(left.number ?? '').localeCompare(String(right.number ?? ''));
    }),
  );
}

export function confidenceScore(input: ConfidenceScoreInput): number {
  let score = 0;

  if (input.education.length > 0) score += 20;
  if (input.training.length > 0) score += 20;
  if (input.licensure_mentions.length > 0) score += 20;
  if (input.licenses.length > 0) score += 20;
  if (input.employment_timeline.length > 0) score += 20;
  if (input.name_hint) score += 5;

  return Math.min(100, score);
}

export function parseResume(input: { text: string }): ParseResumeOutput {
  const text = normalizeString(input.text)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const lines = toUniqueSorted(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );

  const education = extractCategory(lines, EDUCATION_PATTERNS);
  const training = extractCategory(lines, TRAINING_PATTERNS);
  const licensure_mentions = extractCategory(lines, LICENSURE_PATTERNS);
  const licenses = detectLicenses({ lines, source: 'resume' });
  const employment_timeline = extractCategory(lines, EMPLOYMENT_PATTERNS);
  const name_hint = detectNameHint(lines);

  const pre_psv_confidence_score = confidenceScore({
    education,
    training,
    licensure_mentions,
    licenses,
    employment_timeline,
    name_hint,
  });

  return Object.freeze({
    normalized_text: text,
    lines,
    education,
    training,
    licensure_mentions,
    licenses,
    employment_timeline,
    ...(name_hint ? { name_hint } : {}),
    pre_psv_confidence_score,
  });
}
