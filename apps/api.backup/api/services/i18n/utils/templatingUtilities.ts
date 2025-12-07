/**
 * B241B-I18N-020: I18nTemplatingUtilities
 *
 * Provides helper functions to interpolate variables within translation strings:
 * - Supports pluralisation rules
 * - Gender-specific forms (if applicable)
 * - Nested templates
 * - Includes tests
 */

export interface PluralRule {
  zero?: string;
  one?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface GenderForm {
  masculine?: string;
  feminine?: string;
  neuter?: string;
  other: string;
}

export interface TemplateContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface InterpolationOptions {
  strict?: boolean; // Throw error if variable is missing
  fallback?: string; // Fallback value for missing variables
  escapeHtml?: boolean; // Escape HTML in interpolated values
}

/**
 * I18n templating utilities
 * Provides functions for interpolation, pluralization, and nested templates
 */
export class I18nTemplatingUtilities {
  /**
   * Interpolate variables in a template string
   * Supports {variable} and {variable, format} patterns
   */
  interpolate(
    template: string,
    context: TemplateContext,
    options?: InterpolationOptions
  ): string {
    const opts: Required<InterpolationOptions> = {
      strict: false,
      fallback: '',
      escapeHtml: false,
      ...options,
    };

    return template.replace(/\{(\w+)(?:,\s*([^}]+))?\}/g, (match, key, format) => {
      const value = context[key];

      if (value === undefined || value === null) {
        if (opts.strict) {
          throw new Error(`Missing variable: ${key}`);
        }
        return opts.fallback || match;
      }

      let formattedValue = String(value);

      // Apply format if specified
      if (format) {
        formattedValue = this.applyFormat(formattedValue, format.trim(), context);
      }

      // Escape HTML if requested
      if (opts.escapeHtml) {
        formattedValue = this.escapeHtml(formattedValue);
      }

      return formattedValue;
    });
  }

  /**
   * Apply format to a value
   */
  private applyFormat(value: string, format: string, context: TemplateContext): string {
    switch (format) {
      case 'uppercase':
        return value.toUpperCase();
      case 'lowercase':
        return value.toLowerCase();
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case 'number':
        return this.formatNumber(parseFloat(value) || 0, context);
      case 'currency':
        return this.formatCurrency(parseFloat(value) || 0, context);
      case 'date':
        return this.formatDate(new Date(value), context);
      default:
        // Custom format function (e.g., "plural:count")
        if (format.startsWith('plural:')) {
          const countKey = format.split(':')[1] || 'count';
          const count = Number(context[countKey]) || 0;
          return this.applyPluralization(value, count, context);
        }
        return value;
    }
  }

  /**
   * Apply pluralization rules
   */
  applyPluralization(
    template: string,
    count: number,
    context: TemplateContext,
    locale: string = 'en-US'
  ): string {
    // Extract plural forms from template
    // Format: {count, plural, =0{zero} one{one} other{other}}
    const pluralRegex = /\{(\w+),\s*plural\s*,\s*([^}]+)\}/;
    const match = template.match(pluralRegex);

    if (!match) {
      // Simple pluralization: try to find plural rules in context
      const pluralKey = this.getPluralKey(count, locale);
      const pluralValue = context[`${template}_${pluralKey}`];
      if (pluralValue) {
        return this.interpolate(String(pluralValue), { ...context, count });
      }
      return this.interpolate(template, { ...context, count });
    }

    const fullMatch = match[0];
    const variableName = match[1];
    const rulesText = match[2];

    // Parse plural rules
    const rules: Record<string, string> = {};
    const ruleRegex = /(\w+)\{([^}]+)\}/g;
    let ruleMatch;

    while ((ruleMatch = ruleRegex.exec(rulesText)) !== null) {
      rules[ruleMatch[1]] = ruleMatch[2];
    }

    // Select rule based on count and locale
    const pluralKey = this.getPluralKey(count, locale);
    const selectedRule = rules[pluralKey] || rules.other || rules.one || '';

    // Replace the plural block with selected rule
    const result = template.replace(fullMatch, selectedRule);

    // Interpolate with count
    return this.interpolate(result, { ...context, [variableName]: count, count });
  }

  /**
   * Get plural key for a count and locale
   */
  private getPluralKey(count: number, locale: string): string {
    // Simplified plural rules (ICU MessageFormat style)
    // In a real implementation, use proper CLDR plural rules

    if (count === 0) {
      return 'zero';
    }

    if (count === 1) {
      return 'one';
    }

    // Language-specific rules
    const language = locale.split('-')[0];

    // Russian, Polish, etc. have more complex rules
    if (['ru', 'pl', 'cs', 'sk'].includes(language)) {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (mod10 === 1 && mod100 !== 11) {
        return 'one';
      }
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return 'few';
      }
      if (mod10 === 0 || (mod10 >= 5 && mod10 <= 9) || (mod100 >= 11 && mod100 <= 19)) {
        return 'many';
      }
    }

    // French, Portuguese, etc.
    if (['fr', 'pt'].includes(language)) {
      if (count <= 1) {
        return 'one';
      }
    }

    return 'other';
  }

  /**
   * Apply gender-specific forms
   */
  applyGender(
    template: string,
    gender: 'masculine' | 'feminine' | 'neuter' | 'other',
    context: TemplateContext
  ): string {
    // Extract gender forms from template
    // Format: {variable, gender, masculine{masc} feminine{fem} other{other}}
    const genderRegex = /\{(\w+),\s*gender\s*,\s*([^}]+)\}/;
    const match = template.match(genderRegex);

    if (!match) {
      // Simple gender: try to find gender forms in context
      const genderValue = context[`${template}_${gender}`];
      if (genderValue) {
        return this.interpolate(String(genderValue), context);
      }
      return this.interpolate(template, context);
    }

    const fullMatch = match[0];
    const variableName = match[1];
    const formsText = match[2];

    // Parse gender forms
    const forms: Record<string, string> = {};
    const formRegex = /(\w+)\{([^}]+)\}/g;
    let formMatch;

    while ((formMatch = formRegex.exec(formsText)) !== null) {
      forms[formMatch[1]] = formMatch[2];
    }

    // Select form based on gender
    const selectedForm = forms[gender] || forms.other || '';

    // Replace the gender block with selected form
    const result = template.replace(fullMatch, selectedForm);

    // Interpolate
    return this.interpolate(result, context);
  }

  /**
   * Process nested templates
   */
  processNestedTemplates(
    template: string,
    context: TemplateContext,
    options?: InterpolationOptions
  ): string {
    let result = template;
    let maxDepth = 10; // Prevent infinite recursion
    let depth = 0;

    while (result.includes('{') && depth < maxDepth) {
      result = this.interpolate(result, context, options);
      depth++;
    }

    return result;
  }

  /**
   * Format number (basic implementation)
   */
  private formatNumber(value: number, context: TemplateContext): string {
    const locale = (context.locale as string) || 'en-US';
    const decimals = context.decimals ? Number(context.decimals) : 2;
    return value.toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /**
   * Format currency (basic implementation)
   */
  private formatCurrency(value: number, context: TemplateContext): string {
    const locale = (context.locale as string) || 'en-US';
    const currency = (context.currency as string) || 'USD';
    return value.toLocaleString(locale, {
      style: 'currency',
      currency,
    });
  }

  /**
   * Format date (basic implementation)
   */
  private formatDate(date: Date, context: TemplateContext): string {
    const locale = (context.locale as string) || 'en-US';
    return date.toLocaleDateString(locale);
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for unmatched braces
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Unmatched braces in template');
    }

    // Check for nested braces (which might indicate issues)
    const nestedRegex = /\{[^}]*\{/;
    if (nestedRegex.test(template)) {
      // This might be intentional for nested templates, so just warn
      // errors.push('Nested braces detected (may be intentional)');
    }

    // Check for invalid placeholder syntax
    const invalidPlaceholderRegex = /\{[^}]*[^a-zA-Z0-9_,\s\}][^}]*\}/;
    if (invalidPlaceholderRegex.test(template)) {
      errors.push('Invalid placeholder syntax detected');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

