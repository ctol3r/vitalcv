/**
 * B252B-I18N-017: PluralizationService
 *
 * Handles plural forms for languages:
 * - Uses rules defined per language (e.g., en, ru)
 * - Provides function formatPlural(count, key, languageCode)
 */

export interface PluralRule {
  (count: number): string;
}

export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

/**
 * PluralizationService
 *
 * Service for handling plural forms in different languages
 */
export class PluralizationService {
  private pluralRules: Map<string, PluralRule> = new Map();

  constructor() {
    this.initializePluralRules();
  }

  /**
   * Format plural string based on count and language
   */
  formatPlural(
    count: number,
    key: string,
    languageCode: string,
    forms: PluralForms
  ): string {
    const rule = this.getPluralRule(languageCode);
    const form = rule(count);

    // Get the appropriate form
    switch (form) {
      case 'zero':
        return forms.zero || forms.other;
      case 'one':
        return forms.one;
      case 'two':
        return forms.two || forms.other;
      case 'few':
        return forms.few || forms.other;
      case 'many':
        return forms.many || forms.other;
      default:
        return forms.other;
    }
  }

  /**
   * Get plural rule for a language
   */
  private getPluralRule(languageCode: string): PluralRule {
    // Extract base language code (e.g., 'en' from 'en-US')
    const baseCode = languageCode.split('-')[0].toLowerCase();

    const rule = this.pluralRules.get(baseCode);
    if (rule) {
      return rule;
    }

    // Default to English rule
    return this.pluralRules.get('en')!;
  }

  /**
   * Initialize plural rules for different languages
   */
  private initializePluralRules(): void {
    // English: one vs other
    this.pluralRules.set('en', (count: number) => {
      return count === 1 ? 'one' : 'other';
    });

    // Spanish, French, German: one vs other
    this.pluralRules.set('es', (count: number) => {
      return count === 1 ? 'one' : 'other';
    });

    this.pluralRules.set('fr', (count: number) => {
      return count === 1 ? 'one' : 'other';
    });

    this.pluralRules.set('de', (count: number) => {
      return count === 1 ? 'one' : 'other';
    });

    // Russian: complex rules
    this.pluralRules.set('ru', (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (mod10 === 1 && mod100 !== 11) {
        return 'one';
      } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return 'few';
      } else if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 19)) {
        return 'many';
      } else {
        return 'other';
      }
    });

    // Polish: complex rules
    this.pluralRules.set('pl', (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (count === 1) {
        return 'one';
      } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return 'few';
      } else {
        return 'many';
      }
    });

    // Czech, Slovak: complex rules
    this.pluralRules.set('cs', (count: number) => {
      if (count === 1) {
        return 'one';
      } else if (count >= 2 && count <= 4) {
        return 'few';
      } else {
        return 'other';
      }
    });

    this.pluralRules.set('sk', (count: number) => {
      if (count === 1) {
        return 'one';
      } else if (count >= 2 && count <= 4) {
        return 'few';
      } else {
        return 'other';
      }
    });

    // Arabic: complex rules
    this.pluralRules.set('ar', (count: number) => {
      if (count === 0) {
        return 'zero';
      } else if (count === 1) {
        return 'one';
      } else if (count === 2) {
        return 'two';
      } else if (count % 100 >= 3 && count % 100 <= 10) {
        return 'few';
      } else if (count % 100 >= 11 && count % 100 <= 99) {
        return 'many';
      } else {
        return 'other';
      }
    });

    // Japanese, Korean, Chinese: no plural forms
    this.pluralRules.set('ja', (count: number) => 'other');
    this.pluralRules.set('ko', (count: number) => 'other');
    this.pluralRules.set('zh', (count: number) => 'other');
  }

  /**
   * Register custom plural rule for a language
   */
  registerPluralRule(languageCode: string, rule: PluralRule): void {
    this.pluralRules.set(languageCode.toLowerCase(), rule);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.pluralRules.keys());
  }
}

