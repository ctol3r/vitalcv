/**
 * B242B-ACC-011: Inclusive Language Guide
 *
 * Defines guidelines and helper functions for inclusive language across the platform.
 * Replaces terms like 'guys' with 'everyone', avoids idioms, provides translation notes.
 * Loaded during content creation.
 */

export interface InclusiveLanguageRule {
  /** Pattern to match (can be regex or string) */
  pattern: string | RegExp;
  /** Replacement text */
  replacement: string;
  /** Reason for the replacement */
  reason: string;
  /** Whether this is a regex pattern */
  isRegex?: boolean;
}

export interface TranslationNote {
  /** The term or phrase */
  term: string;
  /** Notes for translators about cultural context */
  notes: string;
  /** Recommended alternatives */
  alternatives?: string[];
}

/**
 * Common inclusive language replacements
 */
export const INCLUSIVE_LANGUAGE_RULES: InclusiveLanguageRule[] = [
  {
    pattern: /\bguys\b/gi,
    replacement: 'everyone',
    reason: 'Gender-neutral alternative',
    isRegex: true,
  },
  {
    pattern: /\bhe\/she\b/gi,
    replacement: 'they',
    reason: 'Gender-neutral pronoun',
    isRegex: true,
  },
  {
    pattern: /\bmanpower\b/gi,
    replacement: 'workforce',
    reason: 'Gender-neutral alternative',
    isRegex: true,
  },
  {
    pattern: /\bman-hours\b/gi,
    replacement: 'person-hours',
    reason: 'Gender-neutral alternative',
    isRegex: true,
  },
  {
    pattern: /\bblacklist\b/gi,
    replacement: 'blocklist',
    reason: 'Avoids negative racial connotations',
    isRegex: true,
  },
  {
    pattern: /\bwhitelist\b/gi,
    replacement: 'allowlist',
    reason: 'Avoids negative racial connotations',
    isRegex: true,
  },
  {
    pattern: /\bmaster\b/gi,
    replacement: 'main',
    reason: 'Avoids negative historical connotations',
    isRegex: true,
  },
  {
    pattern: /\bslave\b/gi,
    replacement: 'replica',
    reason: 'Avoids negative historical connotations',
    isRegex: true,
  },
];

/**
 * Idioms to avoid (with alternatives)
 */
export const IDIOMS_TO_AVOID: Map<string, string> = new Map([
  ['fall through the cracks', 'be overlooked'],
  ['blind spot', 'gap in knowledge'],
  ['tone deaf', 'insensitive'],
  ['crazy', 'unexpected or unusual'],
  ['insane', 'remarkable or extraordinary'],
  ['lame', 'disappointing or inadequate'],
  ['dumb', 'unclear or confusing'],
]);

/**
 * Translation notes for culturally sensitive terms
 */
export const TRANSLATION_NOTES: TranslationNote[] = [
  {
    term: 'everyone',
    notes: 'Use gender-neutral collective term. In some languages, ensure plural form is used.',
    alternatives: ['all', 'people', 'team'],
  },
  {
    term: 'they',
    notes: 'Singular they is preferred for gender-neutral references. Some languages may need context-specific alternatives.',
  },
  {
    term: 'person-first language',
    notes: 'Use "person with disability" rather than "disabled person" in English. Adapt to local conventions.',
    alternatives: ['person-first', 'identity-first'],
  },
];

/**
 * Check text for potentially non-inclusive language
 */
export function checkInclusiveLanguage(text: string): {
  issues: Array<{
    original: string;
    suggested: string;
    reason: string;
    position?: number;
  }>;
  cleaned: string;
} {
  const issues: Array<{
    original: string;
    suggested: string;
    reason: string;
    position?: number;
  }> = [];
  let cleaned = text;

  // Check against rules
  for (const rule of INCLUSIVE_LANGUAGE_RULES) {
    const pattern = rule.isRegex
      ? (rule.pattern as RegExp)
      : new RegExp(rule.pattern, 'gi');

    const matches = cleaned.matchAll(pattern);
    for (const match of matches) {
      if (match.index !== undefined) {
        issues.push({
          original: match[0],
          suggested: rule.replacement,
          reason: rule.reason,
          position: match.index,
        });
      }
    }

    cleaned = cleaned.replace(pattern, rule.replacement);
  }

  // Check for idioms
  for (const [idiom, alternative] of IDIOMS_TO_AVOID.entries()) {
    const pattern = new RegExp(idiom, 'gi');
    const matches = cleaned.matchAll(pattern);
    for (const match of matches) {
      if (match.index !== undefined) {
        issues.push({
          original: match[0],
          suggested: alternative,
          reason: 'Idiom may not translate well or may be insensitive',
          position: match.index,
        });
      }
    }
    cleaned = cleaned.replace(pattern, alternative);
  }

  return { issues, cleaned };
}

/**
 * Replace non-inclusive language in text
 */
export function makeInclusive(text: string): string {
  const { cleaned } = checkInclusiveLanguage(text);
  return cleaned;
}

/**
 * Get translation notes for a term
 */
export function getTranslationNotes(term: string): TranslationNote | undefined {
  return TRANSLATION_NOTES.find(
    (note) => note.term.toLowerCase() === term.toLowerCase()
  );
}

/**
 * Validate content for inclusive language before publishing
 */
export function validateContent(content: string): {
  isValid: boolean;
  issues: Array<{
    original: string;
    suggested: string;
    reason: string;
  }>;
} {
  const { issues } = checkInclusiveLanguage(content);
  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Get inclusive alternatives for a term
 */
export function getInclusiveAlternatives(term: string): string[] {
  // Check rules
  const rule = INCLUSIVE_LANGUAGE_RULES.find((r) => {
    const pattern = r.isRegex
      ? (r.pattern as RegExp)
      : new RegExp(r.pattern, 'gi');
    return pattern.test(term);
  });

  if (rule) {
    return [rule.replacement];
  }

  // Check idioms
  if (IDIOMS_TO_AVOID.has(term.toLowerCase())) {
    return [IDIOMS_TO_AVOID.get(term.toLowerCase())!];
  }

  // Check translation notes
  const note = getTranslationNotes(term);
  if (note?.alternatives) {
    return note.alternatives;
  }

  return [];
}

/**
 * Inclusive language guide configuration
 */
export const InclusiveLanguageGuide = {
  check: checkInclusiveLanguage,
  makeInclusive,
  validate: validateContent,
  getAlternatives: getInclusiveAlternatives,
  getTranslationNotes,
  rules: INCLUSIVE_LANGUAGE_RULES,
  idioms: IDIOMS_TO_AVOID,
  translationNotes: TRANSLATION_NOTES,
} as const;

