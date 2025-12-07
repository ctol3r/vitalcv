/**
 * B242B-ACC-020: Language & Culture Inclusivity Service
 *
 * Provides guidance on cultural inclusivity: gender-neutral pronouns,
 * respectful translations, local customs.
 * Hooks into Internationalisation services.
 * Supplies examples and recommended practices.
 */

export interface CulturalGuideline {
  /** Guideline identifier */
  id: string;
  /** Region or culture */
  region: string;
  /** Language code */
  language: string;
  /** Guideline title */
  title: string;
  /** Detailed description */
  description: string;
  /** Examples */
  examples: Array<{
    avoid: string;
    use: string;
    reason: string;
  }>;
  /** Category */
  category: 'pronouns' | 'greetings' | 'titles' | 'dates' | 'numbers' | 'colors' | 'other';
}

export interface TranslationGuidance {
  /** Source language */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Term or phrase */
  term: string;
  /** Recommended translation */
  recommendedTranslation: string;
  /** Alternative translations */
  alternatives?: string[];
  /** Cultural context notes */
  culturalNotes: string;
  /** Gender considerations */
  genderNeutral?: boolean;
  /** Formality level */
  formality?: 'formal' | 'informal' | 'neutral';
}

export interface LocalCustom {
  /** Region identifier */
  region: string;
  /** Custom description */
  description: string;
  /** What to do */
  do: string[];
  /** What to avoid */
  avoid: string[];
  /** Examples */
  examples: string[];
}

/**
 * Cultural guidelines by region
 */
export const CULTURAL_GUIDELINES: Record<string, CulturalGuideline[]> = {
  'en-US': [
    {
      id: 'pronouns-en',
      region: 'United States',
      language: 'en',
      title: 'Gender-Neutral Pronouns',
      description: 'Use gender-neutral pronouns and terms when referring to people.',
      category: 'pronouns',
      examples: [
        {
          avoid: 'he/she',
          use: 'they',
          reason: 'Singular they is widely accepted and gender-neutral',
        },
        {
          avoid: 'guys',
          use: 'everyone, team, folks',
          reason: 'Gender-neutral collective terms',
        },
        {
          avoid: 'mankind',
          use: 'humanity, people',
          reason: 'More inclusive term',
        },
      ],
    },
  ],
  'es-ES': [
    {
      id: 'pronouns-es',
      region: 'Spain',
      language: 'es',
      title: 'Gender-Inclusive Spanish',
      description: 'Guidelines for inclusive language in Spanish.',
      category: 'pronouns',
      examples: [
        {
          avoid: 'todos',
          use: 'todas y todos, todes',
          reason: 'Inclusive forms acknowledging all genders',
        },
        {
          avoid: 'señores y señoras',
          use: 'personas, estimados/as',
          reason: 'More inclusive greeting',
        },
      ],
    },
  ],
  'fr-FR': [
    {
      id: 'pronouns-fr',
      region: 'France',
      language: 'fr',
      title: 'Gender-Inclusive French',
      description: 'Guidelines for inclusive language in French.',
      category: 'pronouns',
      examples: [
        {
          avoid: 'tous',
          use: 'toutes et tous, tou·te·s',
          reason: 'Inclusive writing in French',
        },
      ],
    },
  ],
};

/**
 * Translation guidance database
 */
export const TRANSLATION_GUIDANCE: TranslationGuidance[] = [
  {
    sourceLanguage: 'en',
    targetLanguage: 'es',
    term: 'everyone',
    recommendedTranslation: 'todas y todos',
    alternatives: ['todes', 'todas las personas'],
    culturalNotes: 'In Spanish, use inclusive forms that acknowledge all genders. "Todas y todos" is widely accepted, while "todes" is used in more progressive contexts.',
    genderNeutral: true,
    formality: 'neutral',
  },
  {
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    term: 'everyone',
    recommendedTranslation: 'toutes et tous',
    alternatives: ['tou·te·s', 'toutes les personnes'],
    culturalNotes: 'French inclusive writing uses various forms. "Toutes et tous" is traditional, while "tou·te·s" uses inclusive writing with middle dots.',
    genderNeutral: true,
    formality: 'neutral',
  },
  {
    sourceLanguage: 'en',
    targetLanguage: 'de',
    term: 'everyone',
    recommendedTranslation: 'alle',
    alternatives: ['alle Personen'],
    culturalNotes: 'German "alle" is already gender-neutral, but "alle Personen" is more explicit and inclusive.',
    genderNeutral: true,
    formality: 'neutral',
  },
];

/**
 * Local customs by region
 */
export const LOCAL_CUSTOMS: Record<string, LocalCustom> = {
  'en-US': {
    region: 'United States',
    description: 'Cultural considerations for US English',
    do: [
      'Use person-first language (person with disability)',
      'Respect preferred pronouns',
      'Use inclusive collective terms',
      'Consider regional variations',
    ],
    avoid: [
      'Assumptions about gender',
      'Cultural stereotypes',
      'Idioms that don\'t translate well',
      'Exclusive language',
    ],
    examples: [
      'Use "they" for singular gender-neutral references',
      'Use "team" or "everyone" instead of "guys"',
    ],
  },
  'ar-SA': {
    region: 'Saudi Arabia',
    description: 'Cultural considerations for Arabic',
    do: [
      'Use appropriate formality levels',
      'Respect religious and cultural references',
      'Consider right-to-left text direction',
    ],
    avoid: [
      'Casual language in formal contexts',
      'Inappropriate cultural references',
    ],
    examples: [
      'Use formal greetings in business contexts',
      'Respect religious observances in scheduling',
    ],
  },
  'ja-JP': {
    region: 'Japan',
    description: 'Cultural considerations for Japanese',
    do: [
      'Use appropriate honorifics',
      'Respect hierarchical relationships',
      'Consider formality levels',
    ],
    avoid: [
      'Overly casual language',
      'Direct translations of idioms',
    ],
    examples: [
      'Use appropriate keigo (honorific language)',
      'Consider context for formality',
    ],
  },
};

/**
 * Language & Culture Inclusivity Service
 */
export class LanguageCultureInclusivityService {
  /**
   * Get cultural guidelines for a region
   */
  getGuidelines(region: string): CulturalGuideline[] {
    return CULTURAL_GUIDELINES[region] || [];
  }

  /**
   * Get guidelines by category
   */
  getGuidelinesByCategory(
    region: string,
    category: CulturalGuideline['category']
  ): CulturalGuideline[] {
    return this.getGuidelines(region).filter((g) => g.category === category);
  }

  /**
   * Get translation guidance
   */
  getTranslationGuidance(
    sourceLanguage: string,
    targetLanguage: string,
    term: string
  ): TranslationGuidance | undefined {
    return TRANSLATION_GUIDANCE.find(
      (tg) =>
        tg.sourceLanguage === sourceLanguage &&
        tg.targetLanguage === targetLanguage &&
        tg.term.toLowerCase() === term.toLowerCase()
    );
  }

  /**
   * Get all translation guidance for a language pair
   */
  getTranslationGuidanceForLanguagePair(
    sourceLanguage: string,
    targetLanguage: string
  ): TranslationGuidance[] {
    return TRANSLATION_GUIDANCE.filter(
      (tg) =>
        tg.sourceLanguage === sourceLanguage &&
        tg.targetLanguage === targetLanguage
    );
  }

  /**
   * Get local customs for a region
   */
  getLocalCustoms(region: string): LocalCustom | undefined {
    return LOCAL_CUSTOMS[region];
  }

  /**
   * Validate text for cultural inclusivity
   */
  validateCulturalInclusivity(
    text: string,
    region: string,
    language: string
  ): {
    isValid: boolean;
    issues: Array<{
      text: string;
      suggestion: string;
      reason: string;
      guideline: string;
    }>;
  } {
    const guidelines = this.getGuidelines(region);
    const issues: Array<{
      text: string;
      suggestion: string;
      reason: string;
      guideline: string;
    }> = [];

    for (const guideline of guidelines) {
      for (const example of guideline.examples) {
        const pattern = new RegExp(example.avoid, 'gi');
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          issues.push({
            text: match[0],
            suggestion: example.use,
            reason: example.reason,
            guideline: guideline.title,
          });
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get gender-neutral alternatives
   */
  getGenderNeutralAlternatives(
    term: string,
    language: string
  ): string[] {
    const guidance = TRANSLATION_GUIDANCE.find(
      (tg) =>
        tg.sourceLanguage === language &&
        tg.term.toLowerCase() === term.toLowerCase() &&
        tg.genderNeutral
    );

    if (guidance) {
      return [guidance.recommendedTranslation, ...(guidance.alternatives || [])];
    }

    // Default English alternatives
    if (language === 'en') {
      const alternatives: Record<string, string[]> = {
        'guys': ['everyone', 'team', 'folks', 'people'],
        'he/she': ['they'],
        'mankind': ['humanity', 'people'],
        'manpower': ['workforce', 'staff'],
      };

      return alternatives[term.toLowerCase()] || [];
    }

    return [];
  }

  /**
   * Get recommended practices for a region
   */
  getRecommendedPractices(region: string): {
    do: string[];
    avoid: string[];
    examples: string[];
  } {
    const customs = this.getLocalCustoms(region);
    if (customs) {
      return {
        do: customs.do,
        avoid: customs.avoid,
        examples: customs.examples,
      };
    }

    return {
      do: [],
      avoid: [],
      examples: [],
    };
  }

  /**
   * Suggest inclusive translation
   */
  suggestInclusiveTranslation(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string
  ): {
    original: string;
    suggested: string;
    notes: string;
    alternatives?: string[];
  } | null {
    const guidance = this.getTranslationGuidance(
      sourceLanguage,
      targetLanguage,
      sourceText
    );

    if (guidance) {
      return {
        original: sourceText,
        suggested: guidance.recommendedTranslation,
        notes: guidance.culturalNotes,
        alternatives: guidance.alternatives,
      };
    }

    return null;
  }
}

/**
 * Singleton instance
 */
export const languageCultureInclusivityService =
  new LanguageCultureInclusivityService();

/**
 * Integration with i18n services
 */
export function integrateWithI18n(i18nService: {
  translate: (key: string, locale: string) => string;
  getLocale: () => string;
}) {
  return {
    /**
     * Get inclusive translation
     */
    translateInclusive: (key: string, locale?: string): string => {
      const targetLocale = locale || i18nService.getLocale();
      const [language, region] = targetLocale.split('-');

      const translation = i18nService.translate(key, targetLocale);

      // Check for cultural guidelines
      const guidelines = languageCultureInclusivityService.getGuidelines(
        targetLocale
      );

      // Apply inclusive language rules
      let inclusiveTranslation = translation;
      for (const guideline of guidelines) {
        for (const example of guideline.examples) {
          const pattern = new RegExp(example.avoid, 'gi');
          inclusiveTranslation = inclusiveTranslation.replace(
            pattern,
            example.use
          );
        }
      }

      return inclusiveTranslation;
    },
  };
}

/**
 * Default export
 */
export default languageCultureInclusivityService;

